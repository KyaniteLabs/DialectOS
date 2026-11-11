"""Run page components at their real REST/SDK boundary without fetching assets."""
import json
import shutil
import subprocess

import pytest

from conftest import PLUGIN_DIR


@pytest.mark.parametrize("surface", ["desktop", "dashboard"])
def test_learn_page_comparison_keyboard_answer_and_feedback(surface):
    node = shutil.which("node")
    if not node:
        pytest.skip("Node is required for page component checks")
    proc = subprocess.run([node, str(PLUGIN_DIR / "tests/learning_ui.mjs"), surface],
                          capture_output=True, text=True, timeout=15)
    assert proc.returncode == 0, proc.stderr


@pytest.mark.parametrize("surface", ["desktop", "dashboard"])
def test_learn_page_feedback_matches_real_store_response(surface, plugin):
    from test_learning import make_store, miss
    store = make_store(plugin)
    store.capture(miss(), 'es-AR')
    fixture = {a: {"ok": True, "data": getattr(store, a)('es-AR')} for a in ('tip', 'stats', 'quiz')}
    fixture['tip']['data'] = store.compare('bus', 'es-AR')
    fixture['answer'] = {"ok": True, "data": store.answer('bus', 'es-AR', 'colectivo')}
    node = shutil.which('node')
    if not node:
        pytest.skip('Node is required for page component checks')
    proc = subprocess.run([node, str(PLUGIN_DIR / 'tests/learning_ui.mjs'), surface, '--fixture'],
                          input=json.dumps(fixture), capture_output=True, text=True, timeout=15)
    assert proc.returncode == 0, proc.stderr
