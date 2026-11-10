"""File transport contract, not live translation; fake subprocess checks bytes + cleanup."""
from pathlib import Path
import pytest

@pytest.mark.parametrize('dialect', ['es-MX', 'es-AR'])
def test_markdown_private_files_preserve_bytes_and_cleanup(plugin, fake_cli, dialect):
    source = 'Hello {name}.\n```js\nconst x = 1;\n```'
    target = 'Hola {name}.\n```js\nconst x = 1;\n```'
    fake_cli("from pathlib import Path\ns = Path(sys.argv[sys.argv.index('--source-file')+1]); t = Path(sys.argv[sys.argv.index('--translated-file')+1])\nassert s.read_text() == " + repr(source) + "\nassert t.read_text() == " + repr(target) + "\nassert s.suffix == t.suffix == '.md'\nassert s.parent.stat().st_mode & 0o077 == 0\nprint(json.dumps({'valid': True, 'paths': [str(s), str(t)]}))")
    result = plugin.validate(target, dialect, source)
    assert result['ok'] and result['data']['valid']
    assert all(not Path(p).exists() for p in result['data']['paths'])

def test_markdown_files_cleaned_on_exception(plugin, monkeypatch):
    paths = []
    def fail(args, **kwargs):
        paths.extend([args[args.index('--source-file')+1], args[args.index('--translated-file')+1]])
        raise RuntimeError('test failure')
    monkeypatch.setattr(plugin, 'run_dialectos', fail)
    with pytest.raises(RuntimeError):
        plugin.validate('```\nhola\n```', 'es-MX', '```\nhello\n```')
    assert paths and all(not Path(p).exists() for p in paths)
