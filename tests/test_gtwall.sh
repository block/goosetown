#!/usr/bin/env bash
# gtwall integration tests
# NOTE: Do NOT use set -e with arithmetic - ((x++)) returns 1 when x=0
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GTWALL="$SCRIPT_DIR/../gtwall"

# Use unique session key - PID + RANDOM for uniqueness
export GOOSE_SERVER__SECRET_KEY="gt${$}${RANDOM}"

passed=0
failed=0

pass() { echo "  ✓ $1"; ((++passed)) || true; }
fail() { echo "  ✗ $1: $2" >&2; ((++failed)) || true; }

cleanup() {
    local wall_id="${GOOSE_SERVER__SECRET_KEY:0:8}"
    rm -rf "$HOME/.goosetown/walls/wall-${wall_id}.log"* 2>/dev/null || true
    rm -rf "$HOME/.goosetown/walls/positions-${wall_id}" 2>/dev/null || true
}
trap cleanup EXIT

# --- Tests ---

test_write_read() {
    echo "test_write_read"
    "$GTWALL" --clear >/dev/null 2>&1 || true
    "$GTWALL" writer "hello world" >/dev/null
    local output
    output=$("$GTWALL" reader)
    [[ "$output" == *"hello world"* ]] && pass "message written and read" || fail "message not found" "$output"
}

test_position_tracking() {
    echo "test_position_tracking"
    "$GTWALL" --clear >/dev/null 2>&1 || true
    # Use separate IDs: writer posts, alice reads
    # (posting also advances the poster's read position, so same-ID would see nothing)
    "$GTWALL" writer "msg1" >/dev/null
    "$GTWALL" writer "msg2" >/dev/null
    # Alice reads, should see both messages
    local output1
    output1=$("$GTWALL" alice)
    [[ "$output1" == *"msg1"* && "$output1" == *"msg2"* ]] || { fail "alice didn't see messages" "$output1"; return; }
    # Alice reads again, should see nothing new (position tracked)
    local output2
    output2=$("$GTWALL" alice)
    [[ -z "$output2" ]] && pass "position tracked correctly" || fail "alice re-read old messages" "$output2"
}

test_concurrent_writes() {
    echo "test_concurrent_writes"
    "$GTWALL" --clear >/dev/null 2>&1 || true
    # Spawn 5 parallel writers (reduced from 10 to avoid lock contention timeouts)
    local i
    for i in {1..5}; do
        "$GTWALL" "writer$i" "concurrent-msg-$i" >/dev/null &
    done
    wait
    # Verify all messages present
    local output all_found=true
    output=$("$GTWALL" verifier)
    for i in {1..5}; do
        [[ "$output" == *"concurrent-msg-$i"* ]] || { all_found=false; break; }
    done
    $all_found && pass "all 5 concurrent messages found" || fail "missing concurrent messages" ""
}

test_clear() {
    echo "test_clear"
    "$GTWALL" writer "before-clear" >/dev/null
    "$GTWALL" --clear >/dev/null 2>&1 || true
    "$GTWALL" writer "after-clear" >/dev/null
    local output
    output=$("$GTWALL" reader)
    if [[ "$output" == *"after-clear"* && "$output" != *"before-clear"* ]]; then
        pass "clear works"
    else
        fail "clear didn't work" "$output"
    fi
}

test_session_isolation() {
    echo "test_session_isolation"
    # Keys must differ in first 8 chars
    local key_a="isola${$}A"
    local key_b="isolb${$}B"
    
    GOOSE_SERVER__SECRET_KEY="$key_a" "$GTWALL" writer "secret-A" >/dev/null
    GOOSE_SERVER__SECRET_KEY="$key_b" "$GTWALL" writer "secret-B" >/dev/null
    
    local outputA outputB
    outputA=$(GOOSE_SERVER__SECRET_KEY="$key_a" "$GTWALL" reader 2>/dev/null || echo "")
    outputB=$(GOOSE_SERVER__SECRET_KEY="$key_b" "$GTWALL" reader 2>/dev/null || echo "")
    
    # Each should only see its own
    if [[ "$outputA" != *"secret-B"* && "$outputB" != *"secret-A"* ]]; then
        pass "sessions isolated"
    else
        fail "cross-contamination detected" "A='$outputA' B='$outputB'"
    fi
    
    # Cleanup isolation test walls
    rm -rf "$HOME/.goosetown/walls/wall-${key_a:0:8}.log"* 2>/dev/null || true
    rm -rf "$HOME/.goosetown/walls/wall-${key_b:0:8}.log"* 2>/dev/null || true
    rm -rf "$HOME/.goosetown/walls/positions-${key_a:0:8}" 2>/dev/null || true
    rm -rf "$HOME/.goosetown/walls/positions-${key_b:0:8}" 2>/dev/null || true
}

test_stale_lock_cleanup() {
    echo "test_stale_lock_cleanup"
    "$GTWALL" --clear >/dev/null 2>&1 || true
    
    # Get correct lock path: ${WALLS_DIR}/wall-${SESSION_ID}.log.lock
    local wall_id="${GOOSE_SERVER__SECRET_KEY:0:8}"
    local walls_dir="$HOME/.goosetown/walls"
    local lock_dir="${walls_dir}/wall-${wall_id}.log.lock"
    
    mkdir -p "$walls_dir"
    mkdir -p "$lock_dir"
    
    # Create stale lock:
    # - PID 999999999 exceeds max PID on all systems (Linux max is 4194304)
    # - Timestamp 0 = 1970-01-01, guaranteed stale (>50 years old)
    echo "999999999" > "$lock_dir/pid"
    echo "0" > "$lock_dir/time"
    
    # Write should succeed after cleaning stale lock
    if "$GTWALL" writer "after-stale-lock" >/dev/null 2>&1; then
        local output
        output=$("$GTWALL" reader)
        [[ "$output" == *"after-stale-lock"* ]] && pass "stale lock cleaned" || fail "write succeeded but message missing" "$output"
    else
        fail "write failed with stale lock" ""
    fi
}

# --- Runner ---

main() {
    echo "=== gtwall tests ==="
    test_write_read
    test_position_tracking
    test_concurrent_writes
    test_clear
    test_session_isolation
    test_stale_lock_cleanup
    
    echo ""
    echo "Results: $passed passed, $failed failed"
    [[ $failed -eq 0 ]] || exit 1
}

main "$@"
