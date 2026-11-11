"""Exercise backend route and Pydantic boundaries even without FastAPI installed.

When FastAPI is present, test_dashboard_api.py covers the actual HTTP framework.
This file tests our route functions and registered paths without replacing core.
"""
import importlib.util
import sys
import types

import pytest

pydantic = pytest.importorskip("pydantic")
from pydantic import ValidationError  # noqa: E402

from conftest import PLUGIN_DIR
from test_learning import make_store, miss


@pytest.fixture
def learning_api(plugin, monkeypatch):
    store = make_store(plugin)
    store.capture(miss(), "es-AR")
    monkeypatch.setattr(plugin, "_learning_store", lambda: store)
    monkeypatch.setitem(sys.modules, "dialectos_hermes_core", plugin)
    try:
        import fastapi
    except ImportError:
        routes = []

        class Router:
            def get(self, path): return self.route("GET", path)
            def post(self, path): return self.route("POST", path)
            def route(self, method, path):
                def register(fn):
                    routes.append((method, path, fn))
                    return fn
                return register

        monkeypatch.setitem(sys.modules, "fastapi", types.SimpleNamespace(APIRouter=Router, Query=lambda default, **kw: default))
    spec = importlib.util.spec_from_file_location("dialectos_learn_routes", PLUGIN_DIR / "dashboard/plugin_api.py")
    mod = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, spec.name, mod)
    spec.loader.exec_module(mod)
    return mod, store


def test_learning_page_routes_read_and_grade_real_store(learning_api, runtime):
    api, store = learning_api
    runtime.set_session_vars(platform="discord", source="discord")
    assert api.learning("stats", "es-AR", offset=0)["data"]["due"] == 1
    quiz = api.learning("quiz", "es-AR", offset=0)["data"]
    assert quiz["concept"] == "bus"
    result = api.learning_update(api.LearnIn(action="answer", dialect="es-AR", concept="bus", answer="colectivo"))
    assert result["ok"] and result["data"]["correct"] is True
    assert result["data"]["comparison"]["term"] == "colectivo" and result["data"]["card"]["due"] == "2026-11-12"
    assert api.learning("stats", "es-AR", offset=0)["data"]["due"] == 0
    assert store.cards("es-AR")[0]["box"] == 2


def test_page_forget_requires_strict_boolean_confirmation(learning_api):
    api, store = learning_api
    assert api.learning_update(api.LearnIn(action="forget", dialect="es-AR"))["ok"] is False
    with pytest.raises(ValidationError):
        api.LearnIn(action="forget", dialect="es-AR", confirm="true")
    assert api.learning_update(api.LearnIn(action="forget", dialect="es-AR", confirm=True))["data"]["forgotten"] == 1
    assert store.cards("es-AR") == []


def test_page_request_bounds_and_error_shapes(learning_api):
    api, _ = learning_api
    with pytest.raises(ValidationError):
        api.LearnIn(action="answer", answer="x" * 501)
    with pytest.raises(ValidationError):
        api.LearnIn(action="tip")  # GET handles reads; POST only exposes mutations
    assert api.learning("tip", "es-ZZ", offset=0)["ok"] is False
