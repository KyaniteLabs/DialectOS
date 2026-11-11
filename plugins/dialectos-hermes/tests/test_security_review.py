"""Fail-closed compatibility regressions; no provider invocation."""
import builtins

import pytest


@pytest.mark.parametrize("surface,source,expected", [
    (None, None, True), ("", "", True), ("cli", None, False),
    (None, "desktop", False), ("telegram", None, True),
    ("cli", "telegram", True), ("unknown", None, True),
])
def test_missing_session_module_fails_closed(plugin, monkeypatch, surface, source, expected):
    original = builtins.__import__

    def missing(name, *args, **kwargs):
        if name == "gateway.session_context":
            raise ImportError("runtime seam unavailable")
        return original(name, *args, **kwargs)

    for key in ("HERMES_PLATFORM", "HERMES_SESSION_PLATFORM", "HERMES_SESSION_SOURCE"):
        monkeypatch.delenv(key, raising=False)
    if surface is not None:
        monkeypatch.setenv("HERMES_PLATFORM", surface)
    if source is not None:
        monkeypatch.setenv("HERMES_SESSION_SOURCE", source)
    monkeypatch.setattr(builtins, "__import__", missing)
    assert plugin._on_gateway() is expected


@pytest.mark.parametrize("platform,source,env", [
    ("", "", None), ("telegram", "telegram", None), ("", "cli", None),
    ("", "desktop", None), ("unknown", "", None), ("", "", "discord"), ("", "", "cli"),
])
def test_runtime_identity_matches_core(plugin, runtime, monkeypatch, platform, source, env):
    """With the runtime present, the public get_session_env path decides exactly as core does."""
    if env is not None:
        monkeypatch.setenv("HERMES_PLATFORM", env)
    runtime.set_session_vars(platform=platform, source=source)
    assert plugin._on_gateway() is runtime.session_is_messaging_surface()
