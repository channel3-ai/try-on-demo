#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/infer_example.sh <HOST_OR_IP> [HTTP_PORT] [BASE64_IMAGE] [PROMPT_JSON]
# Defaults: HOST_OR_IP=localhost, HTTP_PORT=8000, BASE64_IMAGE="AA==", PROMPT_JSON='{"points":[],"boxes":[]}'

HOST="${1:-localhost}"
PORT="${2:-8000}"
IMAGE_B64="${3:-AA==}"
# Safe default JSON string for macOS bash
PROMPT_JSON_INPUT=${4:-'{"points":[],"boxes":[]}'}

BODY=$(IMAGE_B64="$IMAGE_B64" PROMPT_JSON_INPUT="$PROMPT_JSON_INPUT" python3 - <<'PY'
import json, os
image_b64 = os.environ["IMAGE_B64"]
prompt_json = os.environ["PROMPT_JSON_INPUT"]
body = {
    "inputs": [
        {
            "name": "image_b64",
            "datatype": "BYTES",
            "shape": [1, 1],
            "data": [image_b64],
        },
        {
            "name": "prompt_json",
            "datatype": "BYTES",
            "shape": [1, 1],
            "data": [prompt_json],
        },
    ],
    "outputs": [{"name": "result_json"}],
}
print(json.dumps(body))
PY
)

URL="http://${HOST}:${PORT}/v2/models/sam2/infer"
echo "POST ${URL}"
curl -sS -X POST "${URL}" \
  -H 'Content-Type: application/json' \
  --data "${BODY}" \
  -w "\nHTTP %{http_code}\n"


