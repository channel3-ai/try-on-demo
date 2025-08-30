## SAM2 on Triton (Lambda Cloud)

Minimal Triton model repository to serve a SAM2-like endpoint via HTTP/gRPC on a Lambda Cloud GPU instance. Starts with the Triton Python backend for fast bring-up; you can later convert to ONNX/TensorRT for 2–5× speedups.

### Repo layout

```
models/
  sam2/
    config.pbtxt
    1/
      model.py
scripts/
  run_triton.sh
  health_check.sh
  infer_example.sh
```

### Provision a Lambda Cloud instance

- Choose region and GPU: start with A100 (40 GB); H100 for max headroom.
- Image: "Lambda Stack 22.04" (includes NVIDIA drivers, Docker, NVIDIA container toolkit).
- Optional: create an NFS filesystem and mount at `/lambda/nfs/<FILESYSTEM_NAME>` for persistent model repos.  
  See the Lambda On‑Demand docs for details.

### Open firewall

Allow inbound TCP from your IP to ports: 22 (SSH), 8000 (HTTP), 8001 (gRPC). See Lambda On‑Demand firewall docs.

### Connect and verify GPU/Docker

```bash
ssh ubuntu@<instance-ip>
nvidia-smi
docker --version
```

### Prepare the model repository

- Clone or copy this repo to the instance. If using NFS, place it under `/lambda/nfs/<FILESYSTEM_NAME>/sam2-triton-deploy`.
- The included `model.py` is a stub that echoes inputs and returns a dummy response; replace the placeholder inference code with real SAM2. It expects:
  - `image_b64`: base64-encoded image (string)
  - `prompt_json`: JSON string with points/boxes

### Run Triton (Docker)

```bash
# From repo root on the instance
./scripts/run_triton.sh  # defaults to ./models

# Or mount an external model repo directory
HTTP_PORT=8000 GRPC_PORT=8001 ./scripts/run_triton.sh /lambda/nfs/<FILESYSTEM_NAME>/models
```

This pulls `nvcr.io/nvidia/tritonserver:24.10-py3` and serves the model repository.

### Health check and inference

```bash
# Health
./scripts/health_check.sh <instance-ip> 8000

# Inference example (stub)
./scripts/infer_example.sh <instance-ip> 8000 "AA==" '{"points":[],"boxes":[]}'

# Direct HTTP (equivalent)
curl http://<instance-ip>:8000/v2/health/ready
```

Your application should POST to:

```
http://<instance-ip>:8000/v2/models/sam2/infer
```

with a body similar to what's used in `scripts/infer_example.sh`.

### Tuning for throughput and stability

- Start with:
  - `instance_group.count = 2`
  - `preferred_batch_size = [4, 8]`
  - `max_queue_delay = 100ms`
- If P95 latency > 300ms or you see timeouts:
  - Increase `instance_group.count` to 3–4.
  - Raise `preferred_batch_size` if request volume is high.
  - Optionally add a second instance and split traffic (Nginx/HAProxy).
- Triton typically times out under overload rather than returning 429; clients should use short timeouts and small retry counts with exponential backoff. No external queue is needed since Triton handles internal queuing and dynamic batching.

### Later optimizations (optional)

- Convert model to ONNX/TensorRT for 2–5× speed.
- Add TLS via Nginx and scale to multiple instances for peak traffic.
- Bake a custom image or containerize the model repo for faster redeploys.

### Notes

- The provided `config.pbtxt` sets `max_batch_size: 16`, dynamic batching with preferred batch sizes `[4, 8]`, and `instance_group` GPU count `2`. Tune per your workload.
- Python backend requires `triton_python_backend_utils` and `numpy`, which are present in the Triton container.

### Real SAM2 inference

Use the provided Dockerfile to extend Triton with PyTorch and SAM2.

1. Build the image (on your server or locally with GPU):

```bash
./scripts/build_image.sh
```

2. Download a SAM2 checkpoint (example: `sam2_hiera_large.pt`) to your machine.

3. Run Triton with the custom image and mount the checkpoint:

```bash
SAM2_CHECKPOINT=/absolute/path/to/sam2_hiera_large.pt \
  ./scripts/run_triton_custom.sh
```

4. Health and inference as before. The backend will produce a PNG base64 mask in `result_json.mask.data`.

Environment variables:

- `SAM2_CHECKPOINT`: absolute path to a `.pt` checkpoint file
- `SAM2_MODEL_CFG`: model config name (default `sam2_hiera_l.yaml`)
