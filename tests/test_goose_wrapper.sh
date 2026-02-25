#!/usr/bin/env bash
# goose wrapper behavior tests
# NOTE: Do NOT use set -e with arithmetic - ((x++)) returns 1 when x=0
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GOOSE_WRAPPER="$SCRIPT_DIR/../goose"

passed=0
failed=0

pass() { echo "  ✓ $1"; ((++passed)) || true; }
fail() { echo "  ✗ $1: $2" >&2; ((++failed)) || true; }

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/goose-wrapper-test.XXXXXX")"
MOCK_GOOSE="$TMP_ROOT/mock-goose.sh"

cleanup() {
    rm -rf "$TMP_ROOT" 2>/dev/null || true
    unset GOOSE_MOIM_MESSAGE_FILE || true
    unset GOOSE_GTWALL_FILE || true
}
trap cleanup EXIT

cat > "$MOCK_GOOSE" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
OUT_FILE="${1:?output file required}"
{
  printf 'MOIM=%s\n' "${GOOSE_MOIM_MESSAGE_FILE:-}"
  printf 'WALL=%s\n' "${GOOSE_GTWALL_FILE:-}"
} > "$OUT_FILE"
EOF
chmod +x "$MOCK_GOOSE"

read_kv() {
    local file="$1"
    local key="$2"
    grep "^${key}=" "$file" | sed "s/^${key}=//"
}

test_create_and_cleanup_owned_files() {
    echo "test_create_and_cleanup_owned_files"
    unset GOOSE_MOIM_MESSAGE_FILE || true
    unset GOOSE_GTWALL_FILE || true

    local out="$TMP_ROOT/create.out"
    if ! GOOSE_BIN="$MOCK_GOOSE" "$GOOSE_WRAPPER" "$out" >/dev/null 2>&1; then
        fail "wrapper launch failed" "goose wrapper exited non-zero"
        return
    fi

    local moim wall
    moim="$(read_kv "$out" "MOIM")"
    wall="$(read_kv "$out" "WALL")"

    if [[ "$moim" == /tmp/goose-telepathy-* ]] && [[ "$wall" == "$HOME/.goosetown/walls/wall-"*".log" ]]; then
        pass "creates expected telepathy/wall paths"
    else
        fail "unexpected created paths" "MOIM=$moim WALL=$wall"
    fi

    if [[ ! -e "$moim" && ! -e "$wall" ]]; then
        pass "owned files cleaned up on exit"
    else
        fail "owned files not cleaned up" "MOIM_EXISTS=$(test -e "$moim" && echo yes || echo no) WALL_EXISTS=$(test -e "$wall" && echo yes || echo no)"
    fi
}

test_reuse_parent_owned_files() {
    echo "test_reuse_parent_owned_files"
    local parent_moim="$TMP_ROOT/parent-telepathy.txt"
    local parent_wall="$TMP_ROOT/parent-wall.log"
    touch "$parent_moim" "$parent_wall"
    export GOOSE_MOIM_MESSAGE_FILE="$parent_moim"
    export GOOSE_GTWALL_FILE="$parent_wall"

    local out="$TMP_ROOT/reuse.out"
    if ! GOOSE_BIN="$MOCK_GOOSE" "$GOOSE_WRAPPER" "$out" >/dev/null 2>&1; then
        fail "wrapper launch failed" "goose wrapper exited non-zero"
        return
    fi

    local moim wall
    moim="$(read_kv "$out" "MOIM")"
    wall="$(read_kv "$out" "WALL")"

    if [[ "$moim" == "$parent_moim" && "$wall" == "$parent_wall" ]]; then
        pass "reuses parent-provided files"
    else
        fail "did not reuse parent files" "MOIM=$moim WALL=$wall"
    fi

    if [[ -e "$parent_moim" && -e "$parent_wall" ]]; then
        pass "does not delete parent-owned files"
    else
        fail "deleted parent-owned files" "MOIM_EXISTS=$(test -e "$parent_moim" && echo yes || echo no) WALL_EXISTS=$(test -e "$parent_wall" && echo yes || echo no)"
    fi
}

test_missing_parent_paths_fallback_to_new_owned_files() {
    echo "test_missing_parent_paths_fallback_to_new_owned_files"
    local missing_moim="$TMP_ROOT/missing-telepathy.txt"
    local missing_wall="$TMP_ROOT/missing-wall.log"
    rm -f "$missing_moim" "$missing_wall"
    export GOOSE_MOIM_MESSAGE_FILE="$missing_moim"
    export GOOSE_GTWALL_FILE="$missing_wall"

    local out="$TMP_ROOT/fallback.out"
    if ! GOOSE_BIN="$MOCK_GOOSE" "$GOOSE_WRAPPER" "$out" >/dev/null 2>&1; then
        fail "wrapper launch failed" "goose wrapper exited non-zero"
        return
    fi

    local moim wall
    moim="$(read_kv "$out" "MOIM")"
    wall="$(read_kv "$out" "WALL")"

    if [[ "$moim" != "$missing_moim" && "$wall" != "$missing_wall" ]]; then
        pass "falls back when parent paths do not exist"
    else
        fail "reused missing parent path" "MOIM=$moim WALL=$wall"
    fi

    if [[ ! -e "$moim" && ! -e "$wall" ]]; then
        pass "fallback-owned files cleaned up on exit"
    else
        fail "fallback-owned files not cleaned up" "MOIM_EXISTS=$(test -e "$moim" && echo yes || echo no) WALL_EXISTS=$(test -e "$wall" && echo yes || echo no)"
    fi
}

main() {
    echo "=== goose wrapper tests ==="
    test_create_and_cleanup_owned_files
    test_reuse_parent_owned_files
    test_missing_parent_paths_fallback_to_new_owned_files

    echo ""
    echo "Results: $passed passed, $failed failed"
    [[ $failed -eq 0 ]] || exit 1
}

main "$@"
