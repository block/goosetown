#!/usr/bin/env python3
"""Tests for build-catalog script.

These tests run against the real repo. They create temporary test files
in RESEARCH/, run the catalog builder, then clean up.
"""

import subprocess
import pytest
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
RESEARCH_DIR = REPO_ROOT / "RESEARCH"
CATALOG_PATH = REPO_ROOT / "CATALOG.md"


@pytest.fixture
def test_file():
    """Create a temporary test file, yield its path, then clean up."""
    # Ensure RESEARCH directory exists (it's gitignored so may not exist in CI)
    RESEARCH_DIR.mkdir(parents=True, exist_ok=True)

    # Ensure TAGS.md exists for tag validation (it's gitignored)
    tags_path = REPO_ROOT / "TAGS.md"
    tags_existed = tags_path.exists()
    if not tags_existed:
        tags_path.write_text("""# Canonical Tag Vocabulary

| Tag | Description |
|-----|-------------|
| `infrastructure` | CI/CD, testing, tooling |
""")

    test_path = RESEARCH_DIR / "_TEST_CATALOG_FIXTURE.md"
    yield test_path

    # Cleanup
    test_path.unlink(missing_ok=True)
    if not tags_existed:
        tags_path.unlink(missing_ok=True)


def run_catalog(strict=False):
    """Run build-catalog and return (returncode, stdout, stderr)."""
    cmd = ["uv", "run", "scripts/build-catalog"]
    if strict:
        cmd.append("--strict")
    result = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


class TestValidFiles:
    def test_catalog_builds(self):
        """Catalog should build without error on current repo state."""
        code, stdout, stderr = run_catalog()
        assert code == 0, f"build-catalog failed: {stderr}"
        assert CATALOG_PATH.exists(), "CATALOG.md not created"

    def test_valid_frontmatter_no_warnings(self, test_file):
        """Valid frontmatter should not produce warnings for that file."""
        # Use existing canonical tag from TAGS.md to avoid unknown-tag warning
        test_file.write_text("""---
title: "Test Catalog Fixture"
tags: [infrastructure]
status: active
created: 2026-01-01
---

# Test Content
""")
        code, stdout, stderr = run_catalog()
        # Check both stdout and stderr for consistency with other tests
        combined = stdout + stderr
        assert "_TEST_CATALOG_FIXTURE.md" not in combined, f"Unexpected warning: {combined}"


class TestValidation:
    def test_missing_title_warns(self, test_file):
        """Missing title should warn."""
        test_file.write_text("""---
tags: [infrastructure]
status: active
created: 2026-01-01
---
""")
        code, stdout, stderr = run_catalog()
        combined = stdout + stderr
        # Should mention the file or the missing field
        assert "_TEST_CATALOG_FIXTURE" in combined or "title" in combined.lower()

    def test_unknown_tag_warns(self, test_file):
        """Unknown tag should warn."""
        test_file.write_text("""---
title: "Unknown Tag Test"
tags: [xyzzy-unknown-tag-12345]
status: active
created: 2026-01-01
---
""")
        code, stdout, stderr = run_catalog()
        combined = stdout + stderr
        assert "xyzzy-unknown-tag-12345" in combined


class TestOutput:
    def test_catalog_lists_files(self, test_file):
        """CATALOG.md should list test file after build."""
        test_file.write_text("""---
title: "Catalog Listing Test"
tags: [infrastructure]
status: active
created: 2026-01-01
---
""")
        run_catalog()
        content = CATALOG_PATH.read_text()
        assert "_TEST_CATALOG_FIXTURE.md" in content
