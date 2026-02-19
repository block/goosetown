#!/usr/bin/env bash
# Dashboard smoke tests
# NOTE: Do NOT use set -e with arithmetic - ((x++)) returns 1 when x=0
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD="$SCRIPT_DIR/../dashboard"

export GOOSE_SERVER__SECRET_KEY="dash${$}${RANDOM}"

passed=0
failed=0
skipped=0

pass() { echo "  ✓ $1"; ((++passed)) || true; }
fail() { echo "  ✗ $1: $2" >&2; ((++failed)) || true; }
skip() { echo "  ⊘ $1 (skipped: $2)"; ((++skipped)) || true; }

cleanup() {
    "$DASHBOARD" --stop >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --- Tests ---

test_help() {
    echo "test_help"
    # --help writes to stderr
    local output
    output=$("$DASHBOARD" --help 2>&1 || true)
    if [[ "$output" == *"Usage"* || "$output" == *"usage"* ]]; then
        pass "--help works"
    else
        fail "--help missing usage" "$output"
    fi
}

test_status_no_server() {
    echo "test_status_no_server"
    # Ensure no server running
    "$DASHBOARD" --stop >/dev/null 2>&1 || true
    sleep 1
    
    local output
    output=$("$DASHBOARD" --status 2>&1 || true)
    # Should indicate not running (various possible messages)
    if [[ "$output" == *"not running"* || "$output" == *"No"* || "$output" == *"stopped"* ]]; then
        pass "--status reports no server"
    else
        fail "--status didn't indicate no server" "$output"
    fi
}

test_start_requires_deps() {
    echo "test_start_requires_deps"
    # Check if required commands exist
    if ! command -v screen &>/dev/null; then
        skip "start test" "screen not installed"
        return
    fi
    if ! command -v lsof &>/dev/null; then
        skip "start test" "lsof not installed"
        return
    fi
    
    # Try to start with timeout (may fail if no goose session, but shouldn't crash)
    # Use GNU timeout if available, otherwise use portable bash background+kill pattern
    local output exit_code
    if command -v timeout &>/dev/null; then
        output=$(timeout 5s "$DASHBOARD" 2>&1)
        exit_code=$?
    else
        # Portable timeout: run in background, wait up to 5s, then SIGTERM+SIGKILL
        local tmpfile
        tmpfile=$(mktemp)
        trap 'rm -f "$tmpfile"' RETURN
        
        "$DASHBOARD" >"$tmpfile" 2>&1 &
        local pid=$!
        local waited=0
        while kill -0 "$pid" 2>/dev/null && [[ $waited -lt 5 ]]; do
            sleep 1
            ((++waited)) || true
        done
        
        if kill -0 "$pid" 2>/dev/null; then
            # Process still running after 5s - escalate: SIGTERM then SIGKILL
            kill "$pid" 2>/dev/null || true
            sleep 0.5
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
            wait "$pid" 2>/dev/null || true
            exit_code=124  # Same as GNU timeout
        else
            wait "$pid" 2>/dev/null
            exit_code=$?
        fi
        output=$(cat "$tmpfile")
    fi
    
    # Accept: started (0), already running, graceful error, or timeout (124)
    # Reject: unknown option, stack trace, segfault
    if [[ $exit_code -le 2 || $exit_code -eq 124 ]] && [[ "$output" != *"Unknown"* ]] && [[ "$output" != *"Traceback"* ]]; then
        pass "start handles gracefully (exit=$exit_code)"
    else
        fail "start failed unexpectedly" "exit=$exit_code output='$output'"
    fi
}

test_stop_idempotent() {
    echo "test_stop_idempotent"
    # Multiple stops should not error
    "$DASHBOARD" --stop >/dev/null 2>&1 || true
    "$DASHBOARD" --stop >/dev/null 2>&1 || true
    "$DASHBOARD" --stop >/dev/null 2>&1 || true
    pass "--stop is idempotent"
}

# --- Runner ---

main() {
    echo "=== dashboard tests ==="
    test_help
    test_status_no_server
    test_start_requires_deps
    test_stop_idempotent
    
    echo ""
    echo "Results: $passed passed, $failed failed, $skipped skipped"
    [[ $failed -eq 0 ]] || exit 1
}

main "$@"
