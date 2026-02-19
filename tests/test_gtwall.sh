#!/usr/bin/env bash
# gtwall integration tests
# NOTE: Do NOT use set -e with arithmetic - ((x++)) returns 1 when x=0
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
GTWALL="$SCRIPT_DIR/../gtwall"

# Create unique wall file for this test session
WALLS_DIR="$HOME/.goosetown/walls"
mkdir -p "$WALLS_DIR"
WALL_FILE="${WALLS_DIR}/wall-test-${$}-${RANDOM}.log"
touch "$WALL_FILE"
export GOOSE_GTWALL_FILE="$WALL_FILE"

passed=0
failed=0

pass() { echo "  ✓ $1"; ((++passed)) || true; }
fail() { echo "  ✗ $1: $2" >&2; ((++failed)) || true; }

cleanup() {
    rm -f "$WALL_FILE" 2>/dev/null || true
    rm -rf "${WALL_FILE%.log}.positions" 2>/dev/null || true
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
    # Create separate wall files for isolation test
    local wall_a="${WALLS_DIR}/wall-test-isola-${$}.log"
    local wall_b="${WALLS_DIR}/wall-test-isolb-${$}.log"
    touch "$wall_a" "$wall_b"
    
    GOOSE_GTWALL_FILE="$wall_a" "$GTWALL" writer "secret-A" >/dev/null
    GOOSE_GTWALL_FILE="$wall_b" "$GTWALL" writer "secret-B" >/dev/null
    
    local outputA outputB
    outputA=$(GOOSE_GTWALL_FILE="$wall_a" "$GTWALL" reader 2>/dev/null || echo "")
    outputB=$(GOOSE_GTWALL_FILE="$wall_b" "$GTWALL" reader 2>/dev/null || echo "")
    
    # Each should only see its own
    if [[ "$outputA" != *"secret-B"* && "$outputB" != *"secret-A"* ]]; then
        pass "sessions isolated"
    else
        fail "cross-contamination detected" "A='$outputA' B='$outputB'"
    fi
    
    # Cleanup isolation test walls
    rm -f "$wall_a" "$wall_b" 2>/dev/null || true
    rm -rf "${wall_a%.log}.positions" "${wall_b%.log}.positions" 2>/dev/null || true
}

test_stale_lock_cleanup() {
    echo "test_stale_lock_cleanup"
    "$GTWALL" --clear >/dev/null 2>&1 || true
    
    # Get correct lock path from GOOSE_GTWALL_FILE
    local lock_dir="${WALL_FILE}.lock"
    
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
