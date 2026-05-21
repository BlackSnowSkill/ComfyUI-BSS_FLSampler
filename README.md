# FLSampler (Foveated Latent Sampler) (BSS)

🇷🇺 [Читать на русском языке](README_RU.md)

**FLSampler (BSS)** is a high-performance custom sampler for ComfyUI, inspired by the physiology of human sight (**Foveated Vision**). It is engineered to deliver stunning cinematic clarity, rich micro-textures, and precise depth-of-detail control directly within the latent space, without adding any overhead to generation times.

> [!IMPORTANT]
> **Author and Developer:** **blacksnowskill (BSS)**  
> **© 2026 blacksnowskill (BSS). All rights reserved.**  
> This project is protected by copyright. Any unauthorized copying, modification without attribution, or representing this code as your own product is strictly prohibited.

---

## 🔬 Physics & Mathematics of the Process

Standard samplers (KSampler) apply noise injection and denoising uniformly across the entire latent space, which often results in either blurred micro-textures (plastic look) or over-sharpened artifacts (burnt images).

**FLSampler** resolves this bottleneck through intelligent, selective latent modification:

1. **Differential Latent Analysis (Focus Detection):**
   At each denoising step, the sampler computes the absolute difference $\Delta = |x_{0, t} - x_{0, t-1}|$ between the current predicted clean image $x_0$ and its state from the previous step. This mathematically pinpoints the exact regions where geometry, object boundaries, and fine structures are currently forming.
2. **Adaptive Fovea Map with Inertia (Momentum Mask):**
   The raw difference map is smoothed using a 2D average pooling operator (`avg_pool2d`), after which a dynamic threshold is calculated based on its mean and standard deviation:
   $$Threshold = \mu + 0.5 \cdot \sigma$$
   A soft, organic focus mask (**Fovea Mask**) is then generated using a sigmoid activation. To prevent erratic focal jumps between steps, a momentum coefficient (**Momentum** / `mask_inertia`) is applied, ensuring a smooth, natural transition of detail zones.
3. **Local Contrast (Sharpness Boost):**
   Inside the high-activity Fovea zone, an **Unsharp Masking** operation is performed directly on the latent tensor. High frequencies are extracted by subtracting a blurred version of the latent from the original, and then selectively amplified. This produces incredibly crisp object boundaries and realistic cinematic depth of field.
4. **Stochastic Texture Injection (Micro-Grain):**
   During the early-to-mid stages of generation, a controlled micro-noise tensor is injected solely into the active Fovea zones. The subsequent denoising steps naturally resolve this noise into ultra-fine high-frequency textures (skin pores, clothing fabrics, wood grains, foliage, hair, or fur), preventing flat plastic surfaces. The injection smoothly decays towards the final steps, guaranteeing a clean, high-fidelity output.

---

## 🎨 BSS Premium UI

The node comes integrated with the luxurious **BSS Premium UI** design system, fully synchronized with the **ANIMA_BOOSTER** aesthetic:
* **Luxury Matte Theme:** A deep, matte ultra-dark graphite body (`#0f0f0eff`) that seamlessly blends inputs, outputs, and the node itself.
* **Rich Gold Accents:** Harmonious gold sliders (`#d4af37`), gold knobs (`#e5c158`), gold dropdown arrowheads, and gold-trimmed numeric input borders.
* **Complete Silence:** Absolute suppression of annoying hover tooltips during widget adjustment and node dragging.
* **Branding:** A fine gold divider bar situated above the first widget and a sharp, metallic `"BSS OPTIMIZED"` branding engraving in the bottom-right corner.

---

## 🎛️ Parameters & Impact Guide

This node completely replaces the standard KSampler, introducing both classic controls and proprietary physical regulators:

| Parameter | Range | Recommended | Description |
| :--- | :--- | :--- | :--- |
| **fovea_strength** | `0.0 – 200.0` | **`5.0 – 15.0`** | **Texture Strength:** Controls high-frequency detail, skin porosity, and fine textures. Set to `0.0` to disable noise injection entirely. |
| **sharpness** | `0.0 – 20.0` | **`1.5 – 3.0`** | **Local Contrast:** Dictates edge definition and object boundary clarity in focus zones. Delivers a "tack-sharp" look without halo artifacts. |
| **mask_inertia** | `0.0 – 0.99` | **`0.80 – 0.90`** | **Mask Inertia:** Focus movement smoothness between steps. Values `>0.85` stabilize detail zones, while lower values (`<0.50`) force the focus to react instantly to sudden changes. |
| **denoise** | `0.0 – 1.0` | **`1.0`** | Standard denoising strength. |
| **steps** / **cfg** | - | - | Standard generation steps and prompt guidance scale. |

---

## 📊 Node Outputs

The node provides two outputs:
1. 🖼️ **latent**: The optimized latent tensor ready for VAE decoding.
2. 👁️ **fovea_mask**: The accumulated Fovea focus map visualized as an RGB image. You can pipe this directly into a Preview Image or Save Image node to visually inspect exactly where the sampler focused its computation during the run—an unprecedented debugging tool for complex workflows!

---

## 📋 Recommended Workflow

```
[ MODEL (e.g., Anima / SDXL) ] ──> [ positive ]
                               ──> [ negative ]
                                        ↓
[ Latent Image (resolution) ] ─────> [ latent_image ] ──> [ FLSampler (BSS) ] ──(latent)──> [ VAE Decode ] ──> [ Save Image ]
                                                                 └──(fovea_mask)──> [ Preview Image ]
```

---

## 📥 Installation

1. Open your terminal in the `ComfyUI/custom_nodes/` directory.
2. Clone the repository:
   ```bash
   git clone https://github.com/BlackSnowSkill/ComfyUI-BSS_FLSampler.git
   ```
3. Restart ComfyUI and refresh your browser cache (`Ctrl + F5`) to enjoy the gorgeous BSS Premium UI.
