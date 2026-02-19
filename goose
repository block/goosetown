#!/usr/bin/env bash
# Goosetown launcher wrapper
# Creates a unique telepathy file for orchestrator → delegate communication via tom

set -e

# Use user-specified goose or find system goose
if [[ -z "${GOOSE_BIN:-}" ]]; then
    GOOSE_BIN="$(command -v goose 2>/dev/null || true)"
fi

if [[ -z "$GOOSE_BIN" ]]; then
    echo "Error: goose not found. Install from https://github.com/block/goose/releases" >&2
    echo "       or set GOOSE_BIN to the path of your goose binary." >&2
    exit 1
fi

# Generate unique telepathy file for this session
TELEPATHY_FILE="/tmp/goose-telepathy-$$.txt"
touch "$TELEPATHY_FILE"

# Export for tom extension - orchestrator and all delegates will see this
export GOOSE_MOIM_MESSAGE_FILE="$TELEPATHY_FILE"

# Cleanup on exit
cleanup() {
    rm -f "$TELEPATHY_FILE"
}
trap cleanup EXIT

echo "🦆 Goosetown telepathy enabled: $TELEPATHY_FILE" >&2

exec "$GOOSE_BIN" "$@"
