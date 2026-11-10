"""Exercise actual Hermes registration without provider calls or runtime stubs.

Run with a provisioned Hermes interpreter:
python runtime_smoke.py /absolute/hermes/source /absolute/disposable/profile
"""
import json
import os
from pathlib import Path
import shutil
import sys

runtime, home = map(lambda p: Path(p).resolve(), sys.argv[1:3])
os.environ['HERMES_HOME'] = str(home)
sys.path.insert(0, str(runtime))
shutil.copytree(Path(__file__).parent, home / 'plugins/dialectos',
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns('__pycache__', '.pytest_cache', 'tests'))
# This file belongs to the disposable home, never an active gateway profile.
(home / 'config.yaml').write_text('plugins:\n  enabled: [dialectos]\n')
from hermes_cli import plugins
plugins.discover_plugins()
assert 'dialectos' in plugins.get_plugin_commands()
handler = plugins.get_plugin_command_handler('dialectos')
assert 'validate' in handler('help')
assert 'provider' in handler('translate es-MX Hello {name}').lower()
assert plugins.invoke_hook('pre_llm_call', user_message='Localize to es-AR with vos')
plugins.invoke_hook('post_tool_call', tool_name='dialectos_validate',
                    args={'dialect': 'es-AR'},
                    result={'ok': True, 'data': {'valid': False,
                            'blockingIssues': ['fixture: missing {name}']}})
ledger = json.loads((home / 'plugin-data/dialectos/qa_ledger.json').read_text())
assert ledger[-1]['passed'] is False
print(json.dumps({'runtime': str(runtime), 'command_registered': True,
                  'hooks_exercised': True, 'ledger_is_fixture': True,
                  'live_translation': False, 'provider_calls': 0}))
