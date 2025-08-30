#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="sam2-triton:latest"

docker build -t "$IMAGE_NAME" -f Dockerfile .
echo "Built $IMAGE_NAME"

