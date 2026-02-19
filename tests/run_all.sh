#!/usr/bin/env bash
# Run all Goosetown tests
# NOTE: Do NOT use set -e - we want to accumulate failures
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "========================================"
echo "Goosetown Test Suite"
echo "========================================"
echo ""

# Cleanup any leftover test artifacts
rm -f RESEARCH/_TEST_CATALOG_FIXTURE.md 2>/dev/null || true

failures=0

# gtwall tests (bash)
echo ">>> gtwall tests"
if bash tests/test_gtwall.sh; then
    echo ""
else
    echo "gtwall tests FAILED"
    ((++failures)) || true
fi

# build-catalog tests (pytest)
echo ">>> build-catalog tests"
if uv run pytest tests/test_catalog.py -v; then
    echo ""
else
    echo "build-catalog tests FAILED"
    ((++failures)) || true
fi

# dashboard tests (bash)
echo ">>> dashboard tests"
if bash tests/test_dashboard.sh; then
    echo ""
else
    echo "dashboard tests FAILED"
    ((++failures)) || true
fi

# Final cleanup
rm -f RESEARCH/_TEST_CATALOG_FIXTURE.md 2>/dev/null || true

echo "========================================"
if [[ $failures -eq 0 ]]; then
    echo "All tests passed!"
    exit 0
else
    echo "$failures test suite(s) failed"
    exit 1
fi
