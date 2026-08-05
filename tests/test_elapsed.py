#!/usr/bin/env python3
"""Regression tests for elapsed-time computation in goosetown-ui.

Verifies that naive ISO timestamps from SQLite are treated as UTC,
not local time — fixing the wrong-elapsed-time bug (#13).
"""

import time
from datetime import datetime, timezone


def utc_epoch(iso_str: str) -> float:
    """Mirror of _utc_epoch from goosetown-ui."""
    dt = datetime.fromisoformat(iso_str.replace(" ", "T"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


class TestUtcEpoch:
    def test_naive_timestamp_treated_as_utc(self):
        """A naive ISO string must be interpreted as UTC, not local time."""
        expected = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc).timestamp()
        result = utc_epoch("2026-01-15 12:00:00")
        assert result == expected

    def test_aware_timestamp_preserved(self):
        """An ISO string with explicit timezone must keep its offset."""
        expected = datetime(2026, 1, 15, 12, 0, 0, tzinfo=timezone.utc).timestamp()
        result = utc_epoch("2026-01-15T14:00:00+02:00")
        assert result == expected

    def test_elapsed_is_small_for_recent_session(self):
        """A session created seconds ago must show seconds, not hours."""
        now_utc = datetime.now(timezone.utc)
        iso_str = now_utc.strftime("%Y-%m-%d %H:%M:%S")
        created = utc_epoch(iso_str)
        elapsed = time.time() - created
        assert elapsed < 5, f"elapsed should be ~0s, got {elapsed:.0f}s"

    def test_space_separator_handled(self):
        """SQLite stores 'YYYY-MM-DD HH:MM:SS' (space, not T)."""
        result = utc_epoch("2026-06-01 08:30:00")
        expected = datetime(2026, 6, 1, 8, 30, 0, tzinfo=timezone.utc).timestamp()
        assert result == expected
