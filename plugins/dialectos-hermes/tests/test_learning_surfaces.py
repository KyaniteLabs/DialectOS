"""Learning's agent and slash contracts, including remote mutation gates."""
import json

import pytest

from test_learning import make_store, miss


@pytest.fixture
def learned(plugin, monkeypatch):
    store = make_store(plugin)
    store.capture(miss(), "es-AR")
    monkeypatch.setattr(plugin, "_learning_store", lambda: store)
    return store


def test_learn_tool_schema_and_registered_handler(plugin, learned):
    registered = {}

    class Ctx:
        def get_config(self, key, default=None): return default
        def register_hook(self, *a, **k): pass
        def register_command(self, *a, **k): pass
        def register_skill(self, *a, **k): pass
        def register_tool(self, **kw): registered[kw["name"]] = kw

    plugin.register(Ctx())
    tool = registered["dialectos_learn"]
    props = tool["schema"]["parameters"]["properties"]
    assert set(props["action"]["enum"]) == {"tip", "quiz", "answer", "stats", "cards", "forget"}
    assert props["confirm"]["type"] == "boolean"
    assert tool["schema"]["parameters"]["required"] == ["action"]
    result = json.loads(tool["handler"]({"action": "quiz", "dialect": "es-AR"}))
    assert result["ok"] and result["data"]["concept"] == "bus"


@pytest.mark.parametrize("action", ["tip", "quiz", "stats", "cards"])
def test_gateway_reads_are_allowed(plugin, learned, runtime, action):
    runtime.set_session_vars(platform="discord", source="discord")
    assert plugin.learn(action, "es-AR")["ok"] is True


@pytest.mark.parametrize("action", ["answer", "forget"])
def test_gateway_mutations_are_refused_without_writing(plugin, learned, runtime, action):
    before = learned.path.read_bytes()
    runtime.set_session_vars(platform="discord", source="discord")
    result = plugin._tool_learn({"action": action, "dialect": "es-AR", "concept": "bus", "answer": "colectivo", "confirm": True})
    assert json.loads(result)["ok"] is False
    assert "gateway" in json.loads(result)["error"]
    assert learned.path.read_bytes() == before


def test_slash_learning_commands_preserve_multiword_answers(plugin, learned):
    assert json.loads(plugin._slash("learn stats es-AR"))["due"] == 1
    assert json.loads(plugin._slash("quiz es-AR"))["concept"] == "bus"
    assert json.loads(plugin._slash("tip es-AR bus"))["term"] == "colectivo"
    answer = json.loads(plugin._slash("answer es-AR bus COLECTIVO"))
    assert answer["correct"] is True
    assert json.loads(plugin._slash("learn cards es-AR"))["total"] == 1
    assert "confirm" in plugin._slash("learn forget es-AR")
    assert json.loads(plugin._slash("learn forget es-AR --confirm"))["forgotten"] == 1
    assert "Learn" in plugin._HELP


def test_tool_missing_dictionary_returns_clear_error_without_install(plugin, monkeypatch):
    monkeypatch.setattr(plugin, "_ensure_release", lambda *a: pytest.fail("network/install forbidden"))
    res = json.loads(plugin._tool_learn({"action": "tip", "dialect": "es-AR"}))
    assert res["ok"] is False and "dictionary" in res["error"]


def test_invalid_learning_requests_cannot_mutate_store(plugin, learned):
    before = learned.path.read_bytes()
    for args in [{}, {"action": "run"}, {"action": "answer", "dialect": "es-AR"},
                 {"action": "forget", "dialect": "es-AR", "confirm": "true"}]:
        assert json.loads(plugin._tool_learn(args))["ok"] is False
    assert learned.path.read_bytes() == before


def test_slash_accepts_multiword_dictionary_answer(plugin, learned):
    learned.capture(miss("screenshot"), "es-AR")
    result = json.loads(plugin._slash("answer es-AR screenshot captura de pantalla"))
    assert result["correct"] is True
    assert result["card"]["term"] == "captura de pantalla"


def test_card_pages_cover_every_card_without_duplicates(plugin, learned):
    for concept in list(learned.dictionary())[:45]:
        learned.capture(miss(concept), "es-AR")
    seen = []
    offset = 0
    while offset is not None:
        page = plugin.learn("cards", "es-AR", offset=offset)["data"]
        assert len(page["cards"]) <= 20
        seen.extend(c["concept"] for c in page["cards"])
        offset = page["next_offset"]
    assert len(seen) == len(set(seen)) == learned.stats("es-AR")["total"]
