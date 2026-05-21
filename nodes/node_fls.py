"""
© 2026 blacksnowskill (BSS). All rights reserved.
Developed by: blacksnowskill (BSS)

nodes/node_fls.py
FLSampler — Foveated Latent Sampler for ComfyUI.

Injects stochastic noise and local sharpness/contrast boost selectively
into high-activity areas (fovea zones) during the denoising steps.
Provides enhanced micro-details, crisp boundaries, and texture control.
"""

import logging
import torch
import torch.nn.functional as F
import comfy.sample
import comfy.samplers
import comfy.utils
import comfy.model_management
import latent_preview

logger = logging.getLogger("BSS_FLSAMPLER.node")


class FLSSamplerNodeV4:
    """
    Foveated Latent Sampler (FLS) by BSS.

    Analyzes latent changes between denoising steps to generate an active
    momentum focus mask (Fovea). Applies selective high-frequency local contrast
    boosting (sharpness) and stochastic noise injection (texture grain) inside the fovea zone.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "seed": (
                    "INT",
                    {
                        "default": 0,
                        "min": 0,
                        "max": 0xFFFFFFFFFFFFFFFF,
                        "control_after_generate": True,
                    },
                ),
                "steps": (
                    "INT",
                    {"default": 20, "min": 1, "max": 10000},
                ),
                "cfg": (
                    "FLOAT",
                    {"default": 8.0, "min": 0.0, "max": 100.0, "step": 0.1, "round": 0.01},
                ),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS,),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS,),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "latent_image": ("LATENT",),
                "denoise": (
                    "FLOAT",
                    {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01},
                ),
                "fovea_strength": (
                    "FLOAT",
                    {
                        "default": 3.0,
                        "min": 0.0,
                        "max": 10.0,
                        "step": 0.1,
                        "display": "slider",
                    },
                ),
                "sharpness": (
                    "FLOAT",
                    {
                        "default": 0.5,
                        "min": 0.0,
                        "max": 3.0,
                        "step": 0.05,
                        "display": "slider",
                    },
                ),
                "mask_inertia": (
                    "FLOAT",
                    {
                        "default": 0.85,
                        "min": 0.0,
                        "max": 0.99,
                        "step": 0.01,
                        "display": "slider",
                    },
                ),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("LATENT", "IMAGE")
    RETURN_NAMES = ("latent", "fovea_mask")
    FUNCTION = "sample_fls"
    CATEGORY = "BSS/FLSampler"
    DESCRIPTION = (
        "FLSampler (Foveated Latent Sampling): Интеллектуальный семплер от BSS. "
        "Анализирует динамику изменений на каждом шаге денойзинга, создавая мягкую карту фокуса (Fovea). "
        "Выборочно добавляет текстурный микро-шум и локальную резкость краев только в активных зонах."
    )

    def sample_fls(
        self,
        model,
        seed,
        steps,
        cfg,
        sampler_name,
        scheduler,
        positive,
        negative,
        latent_image,
        denoise,
        fovea_strength,
        sharpness,
        mask_inertia,
        prompt=None,
        extra_pnginfo=None,
    ):
        # 1. Подготовка латента и маски шума (важно для Inpainting!)
        latent_dict = latent_image.copy()
        latent = latent_dict["samples"]
        latent = comfy.sample.fix_empty_latent_channels(model, latent)
        latent_dict["samples"] = latent

        noise_mask = latent_dict.get("noise_mask")  # Извлекаем маску, если она есть

        device = comfy.model_management.get_torch_device()
        noise = comfy.sample.prepare_noise(latent, seed)

        # Переменные состояния для коллбэка
        self.previous_pred = None
        self.accumulated_mask = torch.zeros(
            (latent.shape[0], 1, latent.shape[-2], latent.shape[-1]), device=device
        )
        self.momentum_mask = None

        # Live preview callback (same as KSampler)
        preview_callback = latent_preview.prepare_callback(model, steps)

        def fls_callback(step, x0, x, total_steps):
            # Разогрев 10% - даем структуре сформироваться
            if step < total_steps * 0.10:
                self.previous_pred = x0
                preview_callback(step, x0, x, total_steps)
                return

            if self.previous_pred is None:
                self.previous_pred = x0
                preview_callback(step, x0, x, total_steps)
                return

            # === 1. Создание маски ===
            delta = torch.abs(x0 - self.previous_pred)
            delta_map = torch.mean(delta, dim=1, keepdim=True)  # shape: (B, 1, H, W) or (B, 1, T, H, W)

            # Сглаживание карты изменений (avg_pool2d требует 4D тензор)
            orig_shape = delta_map.shape
            if len(orig_shape) == 5:
                # [B, 1, T, H, W] -> [B*T, 1, H, W]
                delta_map = delta_map.reshape(-1, 1, orig_shape[3], orig_shape[4])

            delta_smooth = F.avg_pool2d(delta_map, kernel_size=5, stride=1, padding=2)

            if len(orig_shape) == 5:
                delta_smooth = delta_smooth.view(orig_shape)

            # Адаптивный порог
            mean_val = delta_smooth.mean()
            std_val = delta_smooth.std()
            threshold = mean_val + (std_val * 0.5)

            # Генерация "мягкой" маски
            current_mask = torch.sigmoid((delta_smooth - threshold) / (std_val + 1e-6) * 2.0)
            # Отсечение слабого шума
            current_mask = torch.where(
                current_mask < 0.2, torch.tensor(0.0, device=x.device), current_mask
            )

            # Инерция (Momentum) - плавное изменение зоны фокуса
            if self.momentum_mask is None:
                self.momentum_mask = current_mask
            else:
                self.momentum_mask = (
                    self.momentum_mask * mask_inertia + current_mask * (1.0 - mask_inertia)
                )

            active_mask = self.momentum_mask

            # Накопление маски для визуализации
            if self.accumulated_mask.device != active_mask.device:
                self.accumulated_mask = self.accumulated_mask.to(active_mask.device)
            if len(active_mask.shape) == 5:
                self.accumulated_mask += active_mask.squeeze(2)
            else:
                self.accumulated_mask += active_mask

            # === 2. ВОЗДЕЙСТВИЕ НА ЛАТЕНТ ===
            progress = step / total_steps
            decay = 1.0 - progress  # Воздействие уменьшается к концу генерации

            # А. ЛОКАЛЬНЫЙ КОНТРАСТ (SHARPNESS)
            if sharpness > 0:
                x0_4d = (
                    x0.view(-1, x0.shape[-3], x0.shape[-2], x0.shape[-1])
                    if len(x0.shape) == 5
                    else x0
                )
                blurred_x0 = F.avg_pool2d(x0_4d, kernel_size=3, stride=1, padding=1)
                if len(x0.shape) == 5:
                    blurred_x0 = blurred_x0.view(x0.shape)

                high_freq = x0 - blurred_x0
                # Усиливаем края только в активной зоне (фовеа)
                contrast_boost = high_freq * active_mask * (sharpness * 0.1 * decay)
                x += contrast_boost

            # Б. СТОХАСТИЧЕСКИЙ ШУМ (TEXTURE)
            if fovea_strength > 0:
                injection_noise = torch.randn_like(x)
                noise_scale = fovea_strength * 0.02 * decay
                perturbation = injection_noise * active_mask * noise_scale

                # Safety Clamp (чтобы не сжечь картинку артефактами)
                perturbation = torch.clamp(perturbation, -0.15, 0.15)
                x += perturbation

            self.previous_pred = x0
            preview_callback(step, x0, x, total_steps)

        logger.info(
            f"[FLSampler] Running sampling | Steps: {steps} | CFG: {cfg} | "
            f"Fovea Strength: {fovea_strength} | Sharpness: {sharpness} | Inertia: {mask_inertia}"
        )

        # Запуск сэмплинга (передаем noise_mask для корректной работы inpaint)
        samples = comfy.sample.sample(
            model,
            noise,
            steps,
            cfg,
            sampler_name,
            scheduler,
            positive,
            negative,
            latent,
            denoise=denoise,
            disable_noise=False,
            start_step=None,
            last_step=None,
            force_full_denoise=True,
            noise_mask=noise_mask,
            callback=fls_callback,
            disable_pbar=False,
            seed=seed,
        )

        # === 3. Пост-процессинг маски для вывода ===
        out_mask = self.accumulated_mask.cpu()
        if out_mask.max() > 0:
            out_mask = out_mask / out_mask.max()

        # Upscale маски до размера пикселей (x8 для SD/SDXL)
        target_h = latent.shape[-2] * 8
        target_w = latent.shape[-1] * 8
        out_mask = F.interpolate(out_mask, size=(target_h, target_w), mode="bilinear")

        # Конвертация в формат IMAGE (RGB)
        mask_image = out_mask.permute(0, 2, 3, 1).repeat(1, 1, 1, 3).clamp(0, 1)

        # Чистим память
        del self.accumulated_mask
        del self.momentum_mask
        self.previous_pred = None

        # Inject FLS parameters into prompt metadata so CivitAI/parsers
        # can read them (they look for KSampler node entries)
        if prompt is not None:
            # Find our own node ID in the prompt and patch class_type to KSampler
            for node_id, node_data in prompt.items():
                if node_data.get("class_type") == "FLS_SamplerV4":
                    node_data["class_type"] = "KSampler"
                    break

        # Preserve all metadata from input latent (batch_index, noise_mask, etc.)
        out_latent = latent_dict.copy()
        out_latent.pop("downscale_ratio_spacial", None)
        out_latent["samples"] = samples
        return (out_latent, mask_image)
