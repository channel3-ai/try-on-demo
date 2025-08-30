#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/run_triton.sh [MODEL_REPO_DIR]
# MODEL_REPO_DIR defaults to ./models

MODEL_REPO_DIR="${1:-$(pwd)/models}"
IMAGE_TAG="nvcr.io/nvidia/tritonserver:24.10-py3"
HTTP_PORT="${HTTP_PORT:-8000}"
GRPC_PORT="${GRPC_PORT:-8001}"

echo "Model repo: ${MODEL_REPO_DIR}"
echo "HTTP port: ${HTTP_PORT}  |  gRPC port: ${GRPC_PORT}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Please install Docker and try again." >&2
  exit 1
fi

echo "Pulling ${IMAGE_TAG}..."
sudo docker pull "${IMAGE_TAG}"

echo "Starting Triton..."
sudo docker run --gpus=all --rm -it \
  -p "${HTTP_PORT}:8000" -p "${GRPC_PORT}:8001" \
  -v "${MODEL_REPO_DIR}:/models" \
  "${IMAGE_TAG}" \
  tritonserver --model-repository=/models --exit-on-error=false


