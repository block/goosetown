#!/usr/bin/env python3
"""Tests for goosetown-ui ACP launch control and server endpoints.

Unit tests run by default. Integration tests (real goose ACP) are gated
behind GOOSETOWN_INTEGRATION=1 environment variable.
"""

import asyncio
import importlib.machinery
import importlib.util
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
import pytest

# ── Import the extensionless script ──────────────────────────────────────────

def _import_goosetown_ui():
    script_path = os.path.join(os.path.dirname(__file__), "..", "scripts", "goosetown-ui")
    script_path = os.path.abspath(script_path)
    loader = importlib.machinery.SourceFileLoader("goosetown_ui", script_path)
    spec = importlib.util.spec_from_loader("goosetown_ui", loader, origin=script_path)
    mod = importlib.util.module_from_spec(spec)
    mod.__file__ = script_path
    sys.modules["goosetown_ui"] = mod
    spec.loader.exec_module(mod)
    return mod


ui = _import_goosetown_ui()

# ── Integration test gate ────────────────────────────────────────────────────

INTEGRATION = os.environ.get("GOOSETOWN_INTEGRATION", "") == "1"
integration = pytest.mark.skipif(not INTEGRATION, reason="Set GOOSETOWN_INTEGRATION=1")


# ── Fake ACP subprocess ─────────────────────────────────────────────────────

class FakeAcpProcess:
    """Duck-types asyncio.subprocess.Process with canned JSON-RPC responses."""

    def __init__(self, responses: list[dict]):
        self._responses = iter(responses)
        self.returncode = None
        self.pid = 99999
        self.stdin = self
        self.stdout = self

    # stdin interface
    def write(self, data: bytes):
        pass

    async def drain(self):
        pass

    # stdout interface
    async def readline(self) -> bytes:
        try:
            resp = next(self._responses)
            return (json.dumps(resp) + "\n").encode()
        except StopIteration:
            return b""

    def terminate(self):
        self.returncode = -15

    def kill(self):
        self.returncode = -9

    async def wait(self):
        return self.returncode


def acp_handshake_responses(session_id="test-session-1"):
    """Standard initialize + session/new responses for a successful ACP start."""
    return [
        {"jsonrpc": "2.0", "id": 1, "result": {
            "protocolVersion": "v1",
            "agentCapabilities": {"loadSession": False},
            "agentInfo": {"name": "goose", "version": "1.0.0"},
        }},
        {"jsonrpc": "2.0", "id": 2, "result": {
            "sessionId": session_id,
        }},
    ]


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_global_state():
    """Reset all module-level mutable state between tests."""
    ui.event_buffer.clear()
    ui.event_counter = 0
    ui.clients.clear()
    ui.latest_wall_lines.clear()
    ui.latest_sessions.clear()
    ui.latest_tree.clear()
    ui.latest_stats.clear()
    ui.config.clear()
    ui.wall_generation = 0
    ui.launch_state.update(acp=None, wall_file=None, started_at=None)
    ui.launched_session_ids.clear()
    ui.launched_gtwall_map.clear()
    yield
    ui.launch_state.update(acp=None, wall_file=None, started_at=None)
    ui.clients.clear()


@pytest.fixture
def client():
    """Starlette test client with background tasks disabled."""
    from starlette.testclient import TestClient
    app = ui.create_app()
    app.on_startup = []
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def mock_acp(monkeypatch, tmp_path):
    """Patch subprocess creation to return a FakeAcpProcess.

    Also patches WALLS_DIR to use tmp_path so tests don't touch real filesystem.
    Returns a factory: call with optional extra responses beyond the handshake.
    """
    monkeypatch.setattr(ui, "WALLS_DIR", str(tmp_path))

    def factory(extra_responses=None, session_id="test-session-1"):
        responses = acp_handshake_responses(session_id)
        if extra_responses:
            responses.extend(extra_responses)
        fake = FakeAcpProcess(responses)

        async def fake_exec(*args, **kwargs):
            return fake

        monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)
        # Patch open() for the log file — use tmp_path
        return fake

    return factory


# ── A. Parsing Tests ─────────────────────────────────────────────────────────

class TestParsing:
    """Wall line parsing, timestamp conversion, identity extraction, and SSE formatting.

    These are pure functions with no side effects. Tests here guarantee that wall
    messages are correctly split, malformed lines are flagged, escaped pipes are
    restored, and timestamps are reliably converted — all of which downstream
    consumers (the SSE stream, the dashboard UI) depend on.
    """

    def test_parse_wall_line_valid(self):
        result = ui.parse_wall_line("14:30:00|worker-1|Task completed successfully")
        assert result["time"] == "14:30:00"
        assert result["sender_id"] == "worker-1"
        assert result["message"] == "Task completed successfully"
        assert "parse_error" not in result

    def test_parse_wall_line_malformed(self):
        result = ui.parse_wall_line("no pipes here")
        assert result["parse_error"] is True

    def test_parse_wall_line_escaped_pipe(self):
        result = ui.parse_wall_line("14:30:00|bot|choice A \\| choice B")
        assert result["message"] == "choice A | choice B"

    def test_wall_line_epoch_valid(self):
        result = ui.wall_line_epoch({"time": "14:30:00"})
        expected = datetime.now().replace(hour=14, minute=30, second=0, microsecond=0).timestamp()
        assert result == expected

    def test_wall_line_epoch_empty(self):
        assert ui.wall_line_epoch({"time": ""}) == 0.0
        assert ui.wall_line_epoch({}) == 0.0

    def test_wall_line_epoch_invalid(self):
        assert ui.wall_line_epoch({"time": "garbage"}) == 0.0

    def test_extract_gtwall_id_from_instructions(self):
        assert ui.extract_gtwall_id("Your gtwall ID is `worker-1`.") == "worker-1"

    def test_extract_gtwall_id_from_name(self):
        assert ui.extract_gtwall_id("You are researcher-2") == "researcher-2"

    def test_extract_gtwall_id_none(self):
        assert ui.extract_gtwall_id("no id here") is None

    def test_format_sse(self):
        result = ui.format_sse(42, "wall", {"line": 1})
        assert result == 'id: 42\nevent: wall\ndata: {"line": 1}\n\n'

    def test_normalize_epoch_millis(self):
        assert ui.normalize_epoch(1700000000000) == 1700000000.0

    def test_normalize_epoch_seconds(self):
        assert ui.normalize_epoch(1700000000) == 1700000000.0

    def test_normalize_epoch_none(self):
        assert ui.normalize_epoch(None) == 0.0


# ── B. Inference Tests ───────────────────────────────────────────────────────

class TestInference:
    """Session role classification and activity status inference."""

    @pytest.mark.parametrize("sid,name,parent,expected", [
        ("sess-1", "anything", "sess-1", "orchestrator"),  # ID match → orchestrator
        ("sess-2", "goosetown-researcher-github", "sess-1", "researcher"),
        ("sess-2", "goosetown-worker", "sess-1", "worker"),
        ("sess-2", "unknown-agent", "sess-1", "generic"),  # fallback
    ])
    def test_infer_role(self, sid, name, parent, expected):
        assert ui.infer_role(sid, name, parent) == expected

    def test_infer_status_error_overrides(self):
        assert ui.infer_status({}, has_error=True, now=time.time()) == "error"

    def test_infer_status_active(self):
        now = time.time()
        session = {"last_message_ts": now - 5}
        assert ui.infer_status(session, has_error=False, now=now) == "active"


# ── C. ACP Client Tests ─────────────────────────────────────────────────────

class TestAcpClient:
    """AcpClient JSON-RPC 2.0 protocol contract over stdio.

    These tests verify that AcpClient correctly performs the initialize/session
    handshake, sends prompts, filters notifications from responses, and handles
    error conditions (failed init, EOF, calling prompt before start). The subprocess
    is mocked at the stdio boundary — tests validate the wire protocol, not goose
    internals. Caveat: if the real goose ACP protocol changes, these tests still
    pass; the integration tests (TestIntegration) catch that.
    """

    def test_start_initializes_session(self, mock_acp):
        mock_acp()

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            await client.start()
            assert client.session_id == "test-session-1"
            assert client.alive

        asyncio.run(run())

    def test_start_failure_raises(self, mock_acp, monkeypatch):
        """Initialize with no 'result' key should raise RuntimeError."""
        bad_responses = [
            {"jsonrpc": "2.0", "id": 1, "error": {"code": -1, "message": "nope"}},
        ]
        fake = FakeAcpProcess(bad_responses)

        async def fake_exec(*args, **kwargs):
            return fake

        monkeypatch.setattr(asyncio, "create_subprocess_exec", fake_exec)

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            with pytest.raises(RuntimeError, match="ACP initialize failed"):
                await client.start()

        asyncio.run(run())

    def test_prompt_sends_and_receives(self, mock_acp):
        prompt_response = {"jsonrpc": "2.0", "id": 3, "result": {"content": [{"text": "done"}]}}
        mock_acp(extra_responses=[prompt_response])

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            await client.start()
            resp = await client.prompt("hello")
            assert resp["id"] == 3
            assert "result" in resp

        asyncio.run(run())

    def test_prompt_skips_notifications(self, mock_acp):
        """Notifications (no id) should be skipped; only matching response returned."""
        notification = {"jsonrpc": "2.0", "method": "progress", "params": {"step": 1}}
        final = {"jsonrpc": "2.0", "id": 3, "result": {"content": []}}
        mock_acp(extra_responses=[notification, final])

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            await client.start()
            resp = await client.prompt("hello")
            assert resp["id"] == 3

        asyncio.run(run())

    def test_prompt_before_start_raises(self):
        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            with pytest.raises(RuntimeError, match="ACP not initialized"):
                await client.prompt("hello")

        asyncio.run(run())

    def test_stop_terminates(self, mock_acp):
        mock_acp()

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            await client.start()
            assert client.alive
            await client.stop()
            assert not client.alive

        asyncio.run(run())

    def test_eof_returns_none(self, mock_acp):
        """If subprocess stdout closes (EOF), prompt returns None."""
        # Only handshake responses, no prompt response → EOF
        mock_acp()

        async def run():
            client = ui.AcpClient("goose", {}, "/tmp")
            await client.start()
            resp = await client.prompt("hello")
            assert resp is None

        asyncio.run(run())


# ── D. Launch Endpoint Tests ────────────────────────────────────────────────

class TestLaunchEndpoints:
    """HTTP contract for the launch lifecycle: spawn, status, stop, replace.

    Tests use Starlette's TestClient to send real HTTP requests through the ASGI
    stack. They verify the API contract that clients (the dashboard UI, curl)
    depend on: correct status codes, required response fields, input validation,
    and the state machine transitions (idle → running → exited). Also tests that
    launching a second orchestrator cleanly replaces the first.
    """

    def test_launch_empty_prompt(self, client):
        resp = client.post("/api/launch", json={"prompt": ""})
        assert resp.status_code == 400
        assert resp.json()["error"] == "prompt required"

    def test_launch_no_body(self, client):
        resp = client.post("/api/launch", content=b"not json", headers={"content-type": "application/json"})
        assert resp.status_code == 400

    def test_launch_success(self, client, mock_acp):
        mock_acp()
        resp = client.post("/api/launch", json={"prompt": "do something"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_status_idle_by_default(self, client):
        resp = client.get("/api/launch/status")
        assert resp.json()["status"] == "idle"

    def test_status_running_after_launch(self, client, mock_acp):
        mock_acp()
        client.post("/api/launch", json={"prompt": "go"})
        assert client.get("/api/launch/status").json()["status"] == "running"

    def test_stop_no_orchestrator(self, client):
        assert client.post("/api/launch/stop").status_code == 404

    def test_stop_after_launch(self, client, mock_acp):
        mock_acp()
        client.post("/api/launch", json={"prompt": "go"})
        resp = client.post("/api/launch/stop")
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

    def test_status_exited_after_stop(self, client, mock_acp):
        mock_acp()
        client.post("/api/launch", json={"prompt": "go"})
        client.post("/api/launch/stop")
        assert client.get("/api/launch/status").json()["status"] == "exited"

    def test_launch_replaces_existing(self, client, mock_acp):
        fake_first = mock_acp(session_id="first-session")
        client.post("/api/launch", json={"prompt": "first"})

        mock_acp(session_id="second-session")
        resp2 = client.post("/api/launch", json={"prompt": "second"})
        assert resp2.json()["session_id"] == "second-session"
        # First process should have been terminated
        assert fake_first.returncode is not None


# ── E. Prompt Endpoint Tests ────────────────────────────────────────────────

class TestPromptEndpoint:
    """HTTP contract for sending follow-up prompts to a running orchestrator.

    Validates input rejection (empty message, no orchestrator) and the success
    response shape that the dashboard relies on for follow-up interactions.
    """

    def test_prompt_no_orchestrator(self, client):
        resp = client.post("/api/prompt", json={"message": "hello"})
        assert resp.status_code == 404
        assert resp.json()["error"] == "no running orchestrator"

    def test_prompt_empty_message(self, client, mock_acp):
        mock_acp()
        client.post("/api/launch", json={"prompt": "go"})
        resp = client.post("/api/prompt", json={"message": ""})
        assert resp.status_code == 400
        assert resp.json()["error"] == "message required"

    def test_prompt_success(self, client, mock_acp):
        prompt_resp = {"jsonrpc": "2.0", "id": 3, "result": {"content": []}}
        mock_acp(extra_responses=[prompt_resp])
        client.post("/api/launch", json={"prompt": "go"})
        resp = client.post("/api/prompt", json={"message": "follow up"})
        assert resp.status_code == 200
        assert resp.json()["ok"] is True


# ── F. Config & Redirect Tests ──────────────────────────────────────────────

class TestConfigAndRedirect:
    """Config endpoint safety and root routing.

    The config endpoint must only expose safe keys — filesystem paths like
    wall_file must never leak to the client. The root redirect ensures the
    dashboard is reachable at /.
    """

    def test_config_excludes_filesystem_paths(self, client):
        ui.config.update({"wall_id": "w1", "port": 4242, "wall_file": "/secret/path"})
        data = client.get("/api/config").json()
        assert "wall_file" not in data  # filesystem paths must not leak to client

    def test_root_redirects(self, client):
        resp = client.get("/", follow_redirects=False)
        assert resp.status_code == 307
        assert resp.headers["location"] == "/ui/index.html"


# ── G. Integration Tests (real goose ACP) ────────────────────────────────────

class TestIntegration:
    """End-to-end tests with a real goose ACP process.

    Gated behind GOOSETOWN_INTEGRATION=1. Unlike the unit tests which mock the
    subprocess, these validate the actual JSON-RPC handshake against the real
    goose binary and the full HTTP launch lifecycle. These are the tests that
    catch protocol drift between goosetown-ui and goose.
    """

    @integration
    def test_acp_real_start_stop(self):
        """Start a real goose ACP process, verify handshake, then stop."""
        async def run():
            goose_bin = os.environ.get("GOOSE_BIN") or "goose"
            client = ui.AcpClient(goose_bin, os.environ.copy(), os.getcwd())
            await client.start()
            assert client.session_id is not None
            assert client.alive
            await client.stop()
            assert not client.alive

        asyncio.run(run())

    @integration
    def test_launch_real_goose_lifecycle(self, tmp_path, monkeypatch):
        """Full HTTP lifecycle: launch → status → stop with real goose."""
        from starlette.testclient import TestClient

        monkeypatch.setattr(ui, "WALLS_DIR", str(tmp_path))
        app = ui.create_app()
        app.on_startup = []

        with TestClient(app, raise_server_exceptions=False) as tc:
            # Launch
            resp = tc.post("/api/launch", json={"prompt": "Say hello on the wall"})
            assert resp.status_code == 200
            data = resp.json()
            assert data["ok"] is True
            assert data["session_id"]

            # Status should be running
            resp = tc.get("/api/launch/status")
            assert resp.json()["status"] == "running"

            # Stop
            resp = tc.post("/api/launch/stop")
            assert resp.status_code == 200

            # Status should be exited
            resp = tc.get("/api/launch/status")
            assert resp.json()["status"] == "exited"
