"""
© 2026 blacksnowskill (BSS). All rights reserved.
Developed by: blacksnowskill (BSS)

ComfyUI-BSS_FLSampler — Foveated Latent Sampling (FLS) node pack.
Provides intelligent latent adjustments during generation steps.
"""

import logging

logger = logging.getLogger("BSS_FLSAMPLER")

try:
    from .nodes.node_fls import FLSSamplerNodeV4
    _load_error = None
except Exception as e:
    _load_error = e
    logger.error(f"[BSS_FLSAMPLER] Failed to load FLSampler node: {e}", exc_info=True)
    FLSSamplerNodeV4 = None

__version__ = "1.3.0"

NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

if FLSSamplerNodeV4 is not None:
    NODE_CLASS_MAPPINGS["FLS_SamplerV4"] = FLSSamplerNodeV4
    NODE_DISPLAY_NAME_MAPPINGS["FLS_SamplerV4"] = "FLSampler (BSS)"

WEB_DIRECTORY = "./web"

if _load_error:
    logger.warning(f"[BSS_FLSAMPLER] Partial load due to error: {_load_error}")
else:
    loaded = list(NODE_CLASS_MAPPINGS.keys())
    logger.info(f"[BSS_FLSAMPLER] Loaded {len(loaded)} nodes: {loaded} | Version: v1.3.0 | Authorship: blacksnowskill (BSS)")

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "__version__"]