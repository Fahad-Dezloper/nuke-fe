#!/usr/bin/env bash
# Build Lighter browser WASM from elliottech/lighter-go (same as their justfile `build-wasm`)
# and install into public/wasm/ for Next static serving at /wasm/*.
#
# Usage:
#   npm run lighter:wasm
# Optional: LIGHTER_GO_DIR=/path/to/lighter-go  (skip clone; uses your checkout)
# Optional: LIGHTER_GO_REF=v1.0.6               (when cloning; default: main)
#
# Upstream wasm/main.go may temporarily disagree with types/ (integrator fields).
# We apply scripts/fix-lighter-go-wasm-integrator.py when needed so the build succeeds.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${REPO_ROOT}/public/wasm"
LIGHTER_GO_REF="${LIGHTER_GO_REF:-main}"
LIGHTER_GO_REPO="${LIGHTER_GO_REPO:-https://github.com/elliottech/lighter-go.git}"

mkdir -p "${DEST}"

if ! command -v go >/dev/null 2>&1; then
  echo "go is required on PATH to build lighter-signer.wasm" >&2
  exit 1
fi

TMP_CLONE=""
cleanup() {
  if [[ -n "${TMP_CLONE}" && -d "${TMP_CLONE}" ]]; then
    rm -rf "${TMP_CLONE}"
  fi
}
trap cleanup EXIT

if [[ -n "${LIGHTER_GO_DIR:-}" ]]; then
  SRC="${LIGHTER_GO_DIR/#\~/${HOME}}"
  echo "Note: wasm/main.go under LIGHTER_GO_DIR may be patched in place for integrator/TxAttributes compatibility." >&2
  if [[ ! -e "${SRC}" ]]; then
    echo "LIGHTER_GO_DIR does not exist: ${SRC}" >&2
    echo "Clone with: git clone https://github.com/elliottech/lighter-go.git ${SRC}" >&2
    echo "Or omit LIGHTER_GO_DIR and let this script clone to a temp dir (needs network)." >&2
    exit 1
  fi
  if [[ ! -d "${SRC}/wasm" ]]; then
    echo "LIGHTER_GO_DIR must be the root of elliottech/lighter-go (missing wasm/): ${SRC}" >&2
    echo "Fix the path, or remove LIGHTER_GO_DIR to clone automatically." >&2
    exit 1
  fi
else
  TMP_CLONE="$(mktemp -d "${TMPDIR:-/tmp}/lighter-go-wasm.XXXXXX")"
  # Shallow clone; use a branch or tag name (see elliottech/lighter-go releases).
  git clone --depth 1 --branch "${LIGHTER_GO_REF}" "${LIGHTER_GO_REPO}" "${TMP_CLONE}"
  SRC="${TMP_CLONE}"
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required (wasm/integrator compatibility patch)" >&2
  exit 1
fi
python3 "${REPO_ROOT}/scripts/fix-lighter-go-wasm-integrator.py" "${SRC}/wasm/main.go"

(
  cd "${SRC}"
  go mod vendor
  GOOS=js GOARCH=wasm go build -trimpath -o "${DEST}/lighter-signer.wasm" ./wasm/
)

GOROOT="$(go env GOROOT)"
WASM_EXEC="${GOROOT}/lib/wasm/wasm_exec.js"
if [[ ! -f "${WASM_EXEC}" ]]; then
  echo "Missing Go wasm loader at ${WASM_EXEC} (install a full Go toolchain)" >&2
  exit 1
fi
cp "${WASM_EXEC}" "${DEST}/lighter-wasm-exec.js"

echo "Installed:"
echo "  ${DEST}/lighter-signer.wasm"
echo "  ${DEST}/lighter-wasm-exec.js"
