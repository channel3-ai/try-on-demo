#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/health_check.sh <HOST_OR_IP> [HTTP_PORT]
# Defaults: HOST_OR_IP=localhost, HTTP_PORT=8000

HOST="${1:-localhost}"
PORT="${2:-8000}"

URL="http://${HOST}:${PORT}/v2/health/ready"
echo "Checking Triton readiness at: ${URL}"
curl -sS -w "\nHTTP %{http_code}\n" "${URL}"


