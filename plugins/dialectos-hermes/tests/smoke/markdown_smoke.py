"""Offline source-build QA matrix with real Hermes registration, never translation.
Usage: python markdown_smoke.py HERMES_SOURCE DISPOSABLE_HOME BUILT_CLI_INDEX
Requires a provisioned Hermes interpreter and `pnpm build` in this repo.
"""
import json
import os
from pathlib import Path
import shlex
import shutil
import sys

runtime, home, cli = (Path(p).resolve() for p in sys.argv[1:4])
os.environ['HERMES_HOME'] = str(home)
sys.path.insert(0, str(runtime))
shutil.copytree(Path(__file__).resolve().parents[2], home / 'plugins/dialectos',
                dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__', '.pytest_cache', 'tests'))
command = 'node ' + shlex.quote(str(cli))
(home / 'config.yaml').write_text('plugins:\n  enabled: [dialectos]\n  entries:\n    dialectos:\n      settings:\n        dialectos_command: ' + json.dumps(command) + '\n')
from hermes_cli import plugins
plugins.discover_plugins()
handler = plugins.get_plugin_command_handler('dialectos')
assert handler and 'validate' in handler('help')
assert 'provider' in handler('translate es-MX Hello').lower()
module = next(m for m in list(sys.modules.values())
              if getattr(m, '__file__', None) == str(home / 'plugins/dialectos/__init__.py'))
source = 'Hello {name}, use your computer.\n\n```js\nconst id = "{id}";\n```\n'
rows = []
for dialect, prose in [('es-MX', 'Hola {name}, usa tu computadora.'), ('es-AR', 'Hola {name}, usá tu computadora.')]:
    target = prose + '\n\n```js\nconst id = "{id}";\n```\n'
    for name, text, expected in [
        ('preserved', target, True),
        ('wrapper', '```markdown\n' + target + '```\n', False),
        ('mutated-code', target.replace('const id', 'let id'), False),
        ('infostring', target.replace('```js', '```ts'), False),
        ('removed', prose, False),
        ('missing-placeholder', target.replace('{name}', 'usuario'), False),
    ]:
        report = module.validate(text, dialect, source)
        assert report['ok'] and report['data']['valid'] is expected, (dialect, name, report)
        plugins.invoke_hook('post_tool_call', tool_name='dialectos_validate', args={'dialect': dialect}, result=report)
        rows.append({'dialect': dialect, 'case': name, 'expected': expected, 'report': report})
assert plugins.invoke_hook('pre_llm_call', user_message='Localize into es-AR')
assert not list((home / 'plugin-data/dialectos').glob('qa-*'))
print(json.dumps({'live_translation': False, 'provider_calls': 0, 'cli': str(cli),
                  'runtime': str(runtime), 'command_registered': True,
                  'register': 'advisory; no live proof', 'cases': rows}, indent=2))
