#!/usr/bin/env bash
set -euo pipefail

# Usage: SAM2_CHECKPOINT=/path/to/ckpt.pt ./scripts/run_triton_custom.sh [MODEL_REPO_DIR]
# MODEL_REPO_DIR defaults to ./models

MODEL_REPO_DIR="${1:-$(pwd)/models}"
IMAGE_NAME="${IMAGE_NAME:-sam2-triton:latest}"
HTTP_PORT="${HTTP_PORT:-8000}"
GRPC_PORT="${GRPC_PORT:-8001}"

if [[ -z "${SAM2_CHECKPOINT:-}" ]]; then
  echo "Set SAM2_CHECKPOINT=/path/to/sam2_hiera_*.pt" >&2
  exit 1
fi

echo "Model repo: ${MODEL_REPO_DIR}"
echo "Checkpoint: ${SAM2_CHECKPOINT}"

# GPU flag: USE_GPU=1 forces GPU, USE_GPU=0 forces CPU, auto (default) tries nvidia-smi
DOCKER_GPU_ARG=""
if [[ "${USE_GPU:-auto}" == "1" ]]; then
  DOCKER_GPU_ARG="--gpus=all"
elif [[ "${USE_GPU:-auto}" == "auto" ]]; then
  if command -v nvidia-smi >/dev/null 2>&1; then
    DOCKER_GPU_ARG="--gpus=all"
  fi
fi

docker run ${DOCKER_GPU_ARG} --rm -it \
  -p "${HTTP_PORT}:8000" -p "${GRPC_PORT}:8001" \
  -e SAM2_CHECKPOINT="/ckpt/sam2.pt" \
  -v "${MODEL_REPO_DIR}:/models" \
  -v "${SAM2_CHECKPOINT}:/ckpt/sam2.pt:ro" \
  "$IMAGE_NAME" \
  tritonserver --model-repository=/models --exit-on-error=false


