#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-${DIALECTOS_BASE_URL:-}}"
if [[ -z "${base_url}" ]]; then
  echo "usage: $0 https://dialectos-api.your-domain.example" >&2
  echo "or set DIALECTOS_BASE_URL" >&2
  exit 64
fi

base_url="${base_url%/}"

echo "Checking ${base_url} ..."

status=$(curl -fsS "${base_url}/api/status" 2>/dev/null) || {
  echo "FAIL: /api/status unreachable"
  exit 1
}
echo "status: ${status}"

echo "Testing translation ..."
result=$(curl -fsS -X POST "${base_url}/api/translate" \
  -H "content-type: application/json" \
  -d '{"text":"El ordenador está en el autobús con las gafas.","dialect":"es-MX"}') || {
  echo "FAIL: /api/translate error"
  exit 1
}
echo "translate: ${result}" | head -c 500

echo ""
echo "All checks passed."
