import base64
import io
import json
import os
from pathlib import Path

import numpy as np

from PIL import Image
import triton_python_backend_utils as pb_utils


class TritonPythonModel:
    """
    Minimal Triton Python backend for a SAM2-like model.

    Inputs (HTTP/gRPC v2):
    - image_b64: TYPE_STRING, dims [1]  (base64-encoded image)
    - prompt_json: TYPE_STRING, dims [1] (JSON with points/boxes)

    Output:
    - result_json: TYPE_STRING, dims [1] (JSON with mask and metadata)

    This is a lightweight stub that echoes inputs and returns a dummy result.
    Replace the placeholder inference logic with actual SAM2 inference.
    """

    def initialize(self, args: dict) -> None:
        """Initialize the model. Load weights if SAM2 is available."""
        model_config = json.loads(args.get("model_config", "{}"))
        self.model_name = model_config.get("name", "sam2")

        # Attempt to import SAM2. If unavailable, stay in stub mode.
        self._sam2_available = False
        self._predictor = None
        try:
            # Import build_sam2 from build_sam (works across SAM2 versions)
            from sam2.build_sam import build_sam2  # type: ignore
            from sam2.sam2_image_predictor import SAM2ImagePredictor  # type: ignore
            try:
                import torch  # type: ignore
                device_str = "cuda" if torch.cuda.is_available() else "cpu"
            except Exception:
                device_str = "cpu"

            checkpoint_path = os.environ.get(
                "SAM2_CHECKPOINT",
                "/models/sam2/weights/sam2_hiera_large.pt",
            )
            cfg_env = os.environ.get("SAM2_MODEL_CFG", "sam2_hiera_l")
            # Determine probable config file path. Prefer absolute file if present to bypass Hydra.
            def _cfg_path_from_token(token: str) -> Path:
                token_no_ext = token[:-5] if token.endswith(".yaml") else token
                # Choose subdir based on token
                if token_no_ext.startswith("sam2.1_"):
                    subdir = "sam2.1"
                else:
                    subdir = "sam2"
                fname = f"{token_no_ext}.yaml"
                return Path("/opt/sam2/sam2/configs") / subdir / fname

            # Normalize common aliases: 'small'->'s', 'tiny'->'t', 'large'->'l', 'base_plus'->'b+'
            def _normalize_name(token: str) -> str:
                if token.endswith(".yaml"):
                    token = token[:-5]
                m = token.replace("base-plus", "base_plus")
                m = m.replace("small", "s").replace("tiny", "t").replace("large", "l").replace("base_plus", "b+")
                # Ensure group/name format for 2.1
                if m.startswith("sam2.1_"):
                    return f"sam2.1/{m}"
                if m.startswith("sam2_"):
                    return f"sam2/{m}"
                return m

            cfg_candidates: list[str] = []
            # 1) If env provides an absolute path, use it
            if cfg_env.endswith(".yaml") and (Path(cfg_env).is_file()):
                cfg_candidates.append(str(Path(cfg_env)))
            # 2) Try constructed absolute path from repo
            constructed = _cfg_path_from_token(cfg_env)
            cfg_candidates.append(str(constructed))
            # 3) Fall back to token (Hydra name)
            token_no_ext = cfg_env[:-5] if cfg_env.endswith(".yaml") else cfg_env
            norm = _normalize_name(token_no_ext)
            cfg_candidates.append(norm)
            # 4) Try configs/ prefix for Hydra compose
            if norm.startswith("sam2.1/"):
                cfg_candidates.append("configs/" + norm)
            elif norm.startswith("sam2/"):
                cfg_candidates.append("configs/" + norm)

            last_err: Exception | None = None
            sam2_model = None
            # Ensure Hydra can find configs by adding the configs directory to the search path
            hydra_overrides = [
                "hydra.searchpath=[pkg://sam2, file:///opt/sam2]",
            ]

            for cfg in cfg_candidates:
                try:
                    sam2_model = build_sam2(cfg, checkpoint_path, device=device_str, hydra_overrides_extra=hydra_overrides)
                    break
                except Exception as _exc:
                    last_err = _exc
                    continue
            if sam2_model is None:
                raise last_err or RuntimeError("Unable to load SAM2 config")
            self._predictor = SAM2ImagePredictor(sam2_model)
            # Let PyTorch select device; SAM2 predictor moves to available GPU internally in recent versions.
            self._sam2_available = True
        except Exception as exc:  # noqa: BLE001 - remain in stub mode
            # Keep a note so execute() can return a clear message
            self._sam2_error = str(exc)

    def execute(self, requests):
        responses = []
        for request in requests:
            try:
                image_tensor = pb_utils.get_input_tensor_by_name(request, "image_b64")
                prompt_tensor = pb_utils.get_input_tensor_by_name(request, "prompt_json")

                if image_tensor is None or prompt_tensor is None:
                    raise ValueError("Missing required inputs: image_b64 and prompt_json")

                # Extract first element even if shape is [B, 1] or [1, 1]
                def _first_str(t):
                    arr = t.as_numpy()
                    # Flatten and take first element
                    val = arr.reshape(-1)[0]
                    if isinstance(val, bytes):
                        return val.decode("utf-8")
                    # numpy scalar bytes_ -> convert to bytes -> str
                    if hasattr(val, "tobytes"):
                        try:
                            return val.tobytes().decode("utf-8")
                        except Exception:  # fall through
                            pass
                    # Already a Python str
                    if isinstance(val, str):
                        return val
                    # As a last resort
                    return str(val)

                image_b64 = _first_str(image_tensor)
                prompt_json = _first_str(prompt_tensor)

                if self._sam2_available and self._predictor is not None:
                    # Decode image
                    image_bytes = base64.b64decode(image_b64)
                    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                    np_image = np.array(pil_image)  # HxWx3 uint8

                    # Parse prompt JSON. Expect {"points":[{"x":..,"y":..,"label":1|0}], "boxes":[x1,y1,x2,y2]}
                    try:
                        prompt = json.loads(prompt_json) if isinstance(prompt_json, str) else prompt_json
                    except Exception:
                        prompt = {"points": [], "boxes": []}

                    point_coords_list = []
                    point_labels_list = []
                    for p in prompt.get("points", []) or []:
                        x = float(p.get("x", 0))
                        y = float(p.get("y", 0))
                        label = int(p.get("label", 1))  # 1=fg, 0=bg
                        point_coords_list.append([x, y])
                        point_labels_list.append(label)

                    point_coords = np.array(point_coords_list, dtype=np.float32) if point_coords_list else None
                    point_labels = np.array(point_labels_list, dtype=np.int32) if point_labels_list else None

                    box = None
                    boxes = prompt.get("boxes") if isinstance(prompt, dict) else None
                    if boxes and len(boxes) == 4:
                        # SAM2 expects [x1, y1, x2, y2]
                        box = np.array(boxes, dtype=np.float32)

                    # Run predictor
                    self._predictor.set_image(np_image)
                    pred_kwargs = {
                        "point_coords": point_coords,
                        "point_labels": point_labels,
                        "box": box,
                        "multimask_output": False,
                    }
                    # Remove None keys to avoid API issues
                    pred_kwargs = {k: v for k, v in pred_kwargs.items() if v is not None}
                    masks, scores, logits = self._predictor.predict(**pred_kwargs)

                    mask = masks[0] if isinstance(masks, np.ndarray) else masks[0].cpu().numpy()
                    mask_uint8 = (mask.astype(np.uint8) * 255).squeeze()
                    # Encode mask PNG to base64
                    buf = io.BytesIO()
                    Image.fromarray(mask_uint8).save(buf, format="PNG")
                    mask_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

                    result = {
                        "model": self.model_name,
                        "ok": True,
                        "message": "sam2 inference",
                        "inputs": {
                            "image_b64_len": len(image_b64),
                            "prompt": prompt,
                        },
                        "scores": scores[0].tolist() if hasattr(scores, "tolist") else None,
                        "mask": {
                            "format": "png_base64",
                            "data": mask_b64,
                        },
                    }
                else:
                    # Placeholder stub response
                    result = {
                        "model": self.model_name,
                        "ok": True,
                        "message": "stub response - SAM2 not installed in image",
                        "sam2_error": getattr(self, "_sam2_error", None),
                        "inputs": {
                            "image_b64_len": len(image_b64),
                            "prompt_json": prompt_json,
                        },
                        "mask": {"format": "none", "data": None},
                    }

                result_str = json.dumps(result)
                # Triton TYPE_STRING tensors are numpy object arrays
                out_np = np.array([result_str], dtype=object)
                out_tensor = pb_utils.Tensor("result_json", out_np)
                responses.append(pb_utils.InferenceResponse(output_tensors=[out_tensor]))
            except Exception as exc:  # noqa: BLE001 - surface error back to client
                err = pb_utils.TritonError(str(exc))
                responses.append(pb_utils.InferenceResponse(error=err))

        return responses

    def finalize(self) -> None:
        """Called when the model is unloaded. Clean up if needed."""
        return


