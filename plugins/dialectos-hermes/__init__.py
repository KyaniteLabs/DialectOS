"""DialectOS — native Hermes plugin (regional Spanish localization + QA).

Surfaces:
  pre_llm_call   -> when the user asks for Spanish, inject a dialect + QA brief
  post_tool_call -> record dialectos_* results (dialect, QA verdict) in a profile-local ledger
  /dialectos     -> detect | list | translate | validate | status | learn | quiz | tip | answer | help
  tools          -> dialectos_translate, dialectos_detect, dialectos_validate, dialectos_list_dialects, dialectos_learn, dialectos_show
  skill          -> skills/dialectos/SKILL.md

Child processes get a scrubbed env; cache, corpus and the QA ledger live under
<HERMES_HOME>/plugin-data/dialectos/ via plugins.plugin_storage. Registration uses
ctx.* APIs; runtime seams also include gateway.session_context and agent.secret_scope.
Those imports are compatibility-sensitive, not a public-API-only guarantee.

The CLI is the pinned v0.3.2 release tarball: downloaded once, checked against its
sha256 and run with node from plugin-data/dialectos/cli/ (no npx, offline after that).

Validate uses private bounded temporary .md files for structural QA. The pinned
v0.3.2 CLI checks code fences against the source (fixed after v0.3.1). Plugin guards add
number, language and length checks; none of the checks see meaning.
Pass a real source for semantic QA; register controls remain advisory.
"""

from __future__ import annotations

import json
import logging
import os
import re
import hashlib
import shlex
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

PLUGIN_NAME = "dialectos"
RELEASE_VERSION = "0.3.2"
RELEASE_NAME = f"dialectos-cli-{RELEASE_VERSION}.tgz"
RELEASE_TGZ = f"https://github.com/KyaniteLabs/DialectOS/releases/download/v{RELEASE_VERSION}/{RELEASE_NAME}"
# The release asset is mutable on GitHub; this pins the exact bytes the plugin will run.
RELEASE_SHA256 = "34742940b5a06f5ef8581b5be657b3ce1c0f43d11de7621c210494c4d4de981b"
RELEASE_MAX_BYTES = 32 * 1024 * 1024
NODE_MIN = (22, 13)
# What earlier versions saved as the default. It re-downloaded the tarball on every call,
# so it is read as "use the verified local copy".
LEGACY_NPX_COMMAND = f"npx -y --package={RELEASE_TGZ} dialectos"
DEFAULTS: Dict[str, Any] = {
    # Empty: download the pinned release once, check its sha256, unpack it under
    # plugin-data and run it with node. Detect, list and validate then work offline.
    "dialectos_command": "",
    "default_dialect": "es-MX",
    "provider": "",
    "inject_on_spanish": True,
    "allow_translate_slash_on_gateway": False,
    "timeout_seconds": 120,
}
PROVIDERS = {"llm", "deepl", "libre", "mymemory"}
DIALECT_RE = re.compile(r"^es-[A-Z]{2}$")
MAX_TEXT = 8000
MAX_OUT = 100_000
SLASH_DISPLAY = 3500
TOOL_JSON_MAX = 20000
LEDGER_MAX = 200
PANE_VIEWS = ("translate", "check", "dialects", "by_dialect", "recent")
PANE_GUIDANCE = (
    "Check that DialectOS appears in the Desktop sidebar or command palette; "
    "a person enables the pane in Capabilities -> Plugins, then leaves the page open."
)
_KILL_GRACE = 0.5

# Spanish-specific intent only. Bare localize/i18n/localization alone must NOT match
# (German/Japanese localization requests are not Spanish workflows).
_VARIANTS = (
    r"(?:español|espanol|castellano|mexicano|argentino|chileno|colombiano|peruano|venezolano|"
    r"cubano|uruguayo|rioplatense|caribeño|neutro)"
)
_SPANISH_WORD = r"(?:spanish|castilian|español|espanol|castellano)"
# A Spanish *target* only. A bare mention ("Spanish flu", "a Spanish restaurant",
# "LATAM sales") must not pull the brief in, and neither must a refusal
# ("do not answer in Spanish").
_SPANISH_RE = re.compile(
    r"(?:"
    r"\b(?:in|into|to)\s+(?:[\w-]+\s+){0,2}" + _SPANISH_WORD + r"\b|"
    r"\b(?:spanish|castilian)\s+(?:version|translation|copy|reply|response|localization|localisation|subtitles?)\b|"
    r"\b(?:en|al)\s+" + _VARIANTS + r"\b|"
    r"\b(?:translat\w*|locali[sz]\w*|writ\w*|answer|reply|respond)\b(?:\s+[\w-]+){0,6}\s+(?:into|to|for|in)\s+"
    r"(?:(?:the|our|your|their|a)\s+)?(?:spanish|español|espanol|mexico|mexican|argentina|argentine|spain|colombia|latam|latin american)\b|"
    r"\bes-(?:MX|AR|CO|ES|PR|CL|PE|VE|US|CU|UY|EC|GT|HN|SV|NI|CR|PA|DO|BO|PY|GQ|PH|BZ|AD)\b"
    r")",
    re.IGNORECASE,
)
_NEGATED_RE = re.compile(
    r"\b(?:not|never|don't(?!\s+(?:forget|hesitate)\b)|dont(?!\s+(?:forget|hesitate)\b)|no|without)"
    r"\s+(?:[\w-]+\s+){0,4}(?:in|into|to)\s+(?:[\w-]+\s+){0,2}"
    + _SPANISH_WORD + r"\b",
    re.IGNORECASE,
)


def _wants_spanish(message: str) -> bool:
    """True when the message asks for Spanish output and does not refuse it."""
    return bool(_SPANISH_RE.search(message)) and not _NEGATED_RE.search(message)


# Surfaces where the owner sits at their own machine. Everything else (chat platforms,
# webhooks, the API server, kanban workers, cron, unknown names) counts as remote and
# needs allow_translate_slash_on_gateway. Hermes's NON_MESSAGING_SESSION_SURFACES is
# wider on purpose: it answers "is this a chat?", not "is the owner at the keyboard?".
_LOCAL_SURFACES = frozenset({"cli", "tui", "desktop", "local", "acp"})

_ctx = None
_THREAD_LOCK = threading.Lock()


# --- config / storage -------------------------------------------------------

def _settings_from_config() -> Dict[str, Any]:
    """plugins.entries.dialectos.settings from config.yaml, for the dashboard/desktop
    backend, which runs without the agent's PluginContext."""
    try:
        from hermes_cli.config import load_config

        entry = ((load_config() or {}).get("plugins") or {}).get("entries") or {}
        settings = (entry.get(PLUGIN_NAME) or {}).get("settings") or {}
        return settings if isinstance(settings, dict) else {}
    except Exception:
        return {}


def _cfg(key: str) -> Any:
    try:
        val = _ctx.get_config(key, None) if _ctx is not None else _settings_from_config().get(key)
    except Exception:
        val = None
    return DEFAULTS[key] if val is None else val


def _data_dir() -> Path:
    try:
        from plugins.plugin_storage import plugin_data_dir

        return plugin_data_dir(PLUGIN_NAME)
    except Exception:
        home = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
        p = Path(home) / "plugin-data" / PLUGIN_NAME
        p.mkdir(parents=True, exist_ok=True)
        return p


def _ledger_path() -> Path:
    return _data_dir() / "qa_ledger.json"


def _load_json(path: Path, default: Any) -> Any:
    try:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        logger.debug("dialectos: failed reading %s", path, exc_info=True)
    return default


def _atomic_write_json(path: Path, payload: Any) -> None:
    """Write JSON via a unique temp file + os.replace (safe under concurrent writers)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=str(path.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_name, path)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def _save_json(path: Path, payload: Any) -> None:
    _atomic_write_json(path, payload)


@contextmanager
def _locked(path: Path, *, thread_lock=None):
    """Exclusive cross-thread + cross-process lock for a read-modify-write of *path*."""
    lock_path = path.with_name(path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with (thread_lock or _THREAD_LOCK), open(lock_path, "a+b") as fh:
        if os.name == "nt":
            import msvcrt

            fh.seek(0)
            while True:
                try:
                    msvcrt.locking(fh.fileno(), msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    continue
            try:
                yield
            finally:
                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fh.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


def _append_ledger(entry: Dict[str, Any]) -> None:
    path = _ledger_path()
    with _locked(path):
        ledger = _load_json(path, [])
        if not isinstance(ledger, list):
            ledger = []
        ledger.append(entry)
        _atomic_write_json(path, ledger[-LEDGER_MAX:])
        count = min(len(ledger), LEDGER_MAX)
    _broadcast_pane_event("ledger.updated", {"count": count})


# --- Desktop events ---------------------------------------------------------

def _view_payload(args: Any) -> Dict[str, str]:
    if not isinstance(args, dict) or set(args) - {"view", "item_id"}:
        raise ValueError("expected view and optional item_id arguments")
    view = args.get("view")
    if not isinstance(view, str) or view not in PANE_VIEWS:
        raise ValueError(f"view must be one of: {', '.join(PANE_VIEWS)}")
    payload = {"view": view}
    if "item_id" in args:
        item = args["item_id"]
        if not isinstance(item, str) or len(item) != 5 or not DIALECT_RE.fullmatch(item):
            raise ValueError("item_id must be a dialect code (5 chars, e.g. es-AR)")
        payload["item_id"] = item
    return payload


def _broadcast_pane_event(event: str, payload: Dict[str, Any]) -> None:
    """Only bounded visual metadata crosses the optional local Desktop bridge."""
    if event == "view.set":
        payload = _view_payload(payload)
    elif event == "ledger.updated" and isinstance(payload, dict) and set(payload) == {"count"}:
        if type(payload["count"]) is not int or not 0 <= payload["count"] <= LEDGER_MAX:
            raise ValueError("ledger count is out of range")
    else:
        raise ValueError("unknown Desktop event or invalid payload")
    # The bridge imports tui_gateway.server, which swaps sys.stdout to stderr process-wide.
    # Without a loaded TUI gateway there is no Desktop listener here, so skip the import and
    # keep "hermes chat -q" answers and stream-json output on stdout.
    if "tui_gateway.server" not in sys.modules:
        return
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event
    except ImportError:
        logger.debug("dialectos: Hermes Desktop event bridge unavailable")
        return
    try:
        broadcast_plugin_event(PLUGIN_NAME, event, payload)
    except Exception:
        logger.debug("dialectos: Desktop event was not delivered", exc_info=True)


def show(args: Any) -> Dict[str, Any]:
    payload = _view_payload(args)
    _broadcast_pane_event("view.set", payload)
    item = f" for {payload['item_id']}" if "item_id" in payload else ""
    return {"ok": True, "text": f"Asked the open DialectOS Desktop page to show {payload['view']}{item}; the page must be enabled."}


def _session_identity() -> tuple:
    """(platform, source, gateway-process) for this turn, each lower-cased."""
    try:
        from gateway.session_context import get_session_env
    except ImportError:
        platform = os.environ.get("HERMES_PLATFORM") or os.environ.get("HERMES_SESSION_PLATFORM") or ""
        source = os.environ.get("HERMES_SESSION_SOURCE") or ""
        engaged = True  # no runtime seam: an unnamed surface cannot be shown to be local
    else:
        from gateway import session_context as _sc

        platform = get_session_env("HERMES_SESSION_PLATFORM", "") or os.environ.get("HERMES_PLATFORM", "")
        source = get_session_env("HERMES_SESSION_SOURCE", "")
        engaged = bool(getattr(_sc, "session_context_engaged", lambda: False)())
    return str(platform or "").strip().lower(), str(source or "").strip().lower(), engaged


def _on_gateway() -> bool:
    """True unless this turn comes from a local surface (cli, tui, desktop, local, acp).

    Chat platforms, webhooks, the API server, kanban workers, cron and unknown names
    all count as remote. A turn that names no surface is local only in a process that
    has never bound a gateway session (the classic CLI). Fails closed otherwise.
    """
    try:
        platform, source, engaged = _session_identity()
    except Exception:
        logger.debug("dialectos: session identity lookup failed; failing closed", exc_info=True)
        return True
    named = [v for v in (platform, source) if v]
    if named:
        return any(v not in _LOCAL_SURFACES for v in named)
    if engaged:
        return True
    return (os.environ.get("HERMES_GATEWAY_SESSION") or "").strip().lower() in ("1", "true", "yes", "on")


# --- child process ----------------------------------------------------------

_ENV_ALLOW = (
    "PATH", "HOME", "USER", "LANG", "LC_ALL", "TMPDIR", "TMP", "TEMP",
    "NODE_OPTIONS", "npm_config_cache", "NPM_CONFIG_CACHE", "XDG_CACHE_HOME",
    "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy",
)
_SECRET_NAMES = (
    "LLM_API_KEY", "LLM_API_URL", "LLM_ENDPOINT", "LLM_MODEL", "LLM_API_FORMAT",
    "DEEPL_AUTH_KEY", "DEEPL_API_URL", "LIBRETRANSLATE_URL", "LIBRETRANSLATE_API_KEY",
    # Provider activation / local endpoint opt-ins (not credentials, but required for
    # the advertised mymemory / localhost LLM configurations to reach the CLI).
    "ENABLE_MYMEMORY", "LLM_ALLOW_LOCAL", "LM_STUDIO_URL",
)


def _scrubbed_env() -> Dict[str, str]:
    """Minimal env for the DialectOS child — never hand it full os.environ."""
    env = {k: os.environ[k] for k in _ENV_ALLOW if os.environ.get(k)}
    data = _data_dir()
    env["DIALECTOS_CACHE_DIR"] = str(data / "cache")
    env["DIALECTOS_CORPUS_DIR"] = str(data / "corpus")
    env["NO_COLOR"] = "1"
    try:
        from agent.secret_scope import get_secret

        for name in _SECRET_NAMES:
            try:
                val = (get_secret(name) or "").strip()
            except Exception:
                val = ""
            if val:
                env[name] = val
    except Exception:
        pass
    return env


def _descendants(pid: int) -> List[int]:
    """All live descendant pids of *pid* (POSIX `ps`; empty on failure)."""
    try:
        out = subprocess.run(
            ["ps", "-A", "-o", "pid=", "-o", "ppid="],
            capture_output=True, text=True, timeout=5,
        ).stdout
    except Exception:
        return []
    children: Dict[int, List[int]] = {}
    for line in out.splitlines():
        parts = line.split()
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            children.setdefault(int(parts[1]), []).append(int(parts[0]))
    found: List[int] = []
    stack = [pid]
    while stack:
        for child in children.get(stack.pop(), []):
            if child not in found:
                found.append(child)
                stack.append(child)
    return found


def _kill_tree(proc: "subprocess.Popen[str]") -> None:
    """Terminate the CLI and everything it spawned (runner -> CLI -> provider work)."""
    if os.name == "nt":
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
        try:
            proc.kill()
        except Exception:
            pass
        return
    pids = _descendants(proc.pid)
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except (ProcessLookupError, PermissionError, OSError):
        try:
            proc.terminate()
        except Exception:
            pass
    deadline = time.monotonic() + _KILL_GRACE
    while time.monotonic() < deadline:
        proc.poll()
        try:
            os.killpg(proc.pid, 0)
        except (ProcessLookupError, PermissionError, OSError):
            break
        time.sleep(0.05)
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        pass
    for pid in pids + _descendants(proc.pid):
        try:
            os.kill(pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass
    try:
        proc.wait(timeout=2.0)
    except Exception:
        pass


# --- pinned CLI release -----------------------------------------------------

class CliUnavailable(RuntimeError):
    """The managed DialectOS CLI could not be found, fetched or verified."""


_NODE_CHECKED: Dict[str, bool] = {}
_INSTALL_LOCK = threading.Lock()


def _managed() -> bool:
    cmd = str(_cfg("dialectos_command") or "").strip()
    return not cmd or cmd == LEGACY_NPX_COMMAND


def _release_dir() -> Path:
    return _data_dir() / "cli" / RELEASE_VERSION


def _release_entry() -> Path:
    return _release_dir() / "package" / "dist" / "cli.js"


def release_installed() -> bool:
    marker = _release_dir() / ".sha256"
    try:
        return _release_entry().is_file() and marker.read_text(encoding="utf-8").strip() == RELEASE_SHA256
    except OSError:
        return False


def _download_release(dest: Path, timeout: float) -> None:
    """Fetch the pinned tarball into *dest* (bounded size; proxies from the env)."""
    req = urllib.request.Request(RELEASE_TGZ, headers={"User-Agent": "dialectos-hermes"})
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest, "wb") as fh:
        total = 0
        while True:
            chunk = resp.read(1 << 16)
            if not chunk:
                break
            total += len(chunk)
            if total > RELEASE_MAX_BYTES:
                raise CliUnavailable(f"DialectOS release is larger than {RELEASE_MAX_BYTES} bytes; refusing it")
            fh.write(chunk)


def _safe_extract(tgz: Path, into: Path) -> None:
    """Unpack only regular files and directories that stay inside *into*."""
    root = into.resolve()
    with tarfile.open(tgz, "r:gz") as tar:
        members = tar.getmembers()
        for m in members:
            target = (root / m.name).resolve()
            if not (m.isfile() or m.isdir()) or (target != root and root not in target.parents):
                raise CliUnavailable(f"DialectOS release has an unsafe entry ({m.name!r}); refusing it")
        for m in members:
            m.mode = (0o755 if m.isdir() else 0o644)
            if hasattr(tarfile, "data_filter"):
                tar.extract(m, root, filter="data")
            else:  # Python < 3.12: members were checked above
                tar.extract(m, root)


def _ensure_release(timeout: float) -> Path:
    """Return the verified CLI entry, downloading and unpacking it once if needed.

    A copy of the tarball placed at plugin-data/dialectos/<RELEASE_NAME> is used instead of
    the network, which is how machines without internet install it. Either way the bytes
    must match RELEASE_SHA256.
    """
    if release_installed():
        return _release_entry()
    with _locked(_data_dir() / "cli" / "install", thread_lock=_INSTALL_LOCK):
        if release_installed():
            return _release_entry()
        parent = _data_dir() / "cli"
        parent.mkdir(parents=True, exist_ok=True)
        work = Path(tempfile.mkdtemp(prefix=".install-", dir=str(parent)))
        try:
            local = _data_dir() / RELEASE_NAME
            tgz = work / RELEASE_NAME
            if local.is_file():
                shutil.copyfile(local, tgz)
            else:
                try:
                    _download_release(tgz, timeout)
                except CliUnavailable:
                    raise
                except Exception as exc:
                    raise CliUnavailable(
                        f"could not download DialectOS {RELEASE_VERSION} ({type(exc).__name__}: {exc}). "
                        f"Offline? Put {RELEASE_NAME} in {_data_dir()} or set dialectos_command."
                    ) from exc
            digest = hashlib.sha256(tgz.read_bytes()).hexdigest()
            if digest != RELEASE_SHA256:
                raise CliUnavailable(
                    f"DialectOS {RELEASE_VERSION} tarball does not match its pinned sha256 "
                    f"(got {digest[:12]}…); refusing to run it"
                )
            staged = work / "tree"
            staged.mkdir()
            _safe_extract(tgz, staged)
            if not (staged / "package" / "dist" / "cli.js").is_file():
                raise CliUnavailable("DialectOS release has no package/dist/cli.js")
            (staged / ".sha256").write_text(RELEASE_SHA256 + "\n", encoding="utf-8")
            dest = _release_dir()
            if dest.exists():
                shutil.rmtree(dest)
            os.replace(staged, dest)
        finally:
            shutil.rmtree(work, ignore_errors=True)
    return _release_entry()


def _node_binary() -> str:
    node = shutil.which("node")
    if not node:
        raise CliUnavailable(f"DialectOS needs Node {NODE_MIN[0]}.{NODE_MIN[1]} or later on PATH")
    if node not in _NODE_CHECKED:
        try:
            out = subprocess.run([node, "-p", "process.versions.node"], capture_output=True,
                                 text=True, timeout=15, env=_scrubbed_env()).stdout.strip()
            ver = tuple(int(x) for x in out.split(".")[:2])
            _NODE_CHECKED[node] = ver >= NODE_MIN
        except Exception:
            _NODE_CHECKED[node] = True  # unknown version: let the CLI speak for itself
        if not _NODE_CHECKED[node]:
            raise CliUnavailable(
                f"DialectOS needs Node {NODE_MIN[0]}.{NODE_MIN[1]} or later; {node} is {out or 'older'}"
            )
    elif not _NODE_CHECKED[node]:
        raise CliUnavailable(f"DialectOS needs Node {NODE_MIN[0]}.{NODE_MIN[1]} or later")
    return node


def _cli_command(timeout: float) -> List[str]:
    if not _managed():
        return shlex.split(str(_cfg("dialectos_command")))
    node = _node_binary()
    return [node, str(_ensure_release(timeout))]


def _timeout() -> int:
    try:
        return max(1, int(_cfg("timeout_seconds")))
    except (TypeError, ValueError):
        return int(DEFAULTS["timeout_seconds"])


def run_dialectos(args: List[str], stdin: Optional[str] = None, *, expect_json: bool = False) -> Dict[str, Any]:
    try:
        cmd = _cli_command(_timeout()) + args
    except CliUnavailable as exc:
        return {"ok": False, "error": str(exc)}
    popen_kw: Dict[str, Any] = {}
    if os.name == "nt":
        popen_kw["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    else:
        popen_kw["start_new_session"] = True
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE if stdin is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=_scrubbed_env(),
            cwd=str(_data_dir()),
            **popen_kw,
        )
    except FileNotFoundError as exc:
        return {"ok": False, "error": f"dialectos not runnable (need Node {NODE_MIN[0]}.{NODE_MIN[1]}+): {exc}"}
    except OSError as exc:
        return {"ok": False, "error": f"dialectos could not start (OS command/argument limits may apply): {exc}"}
    try:
        out_s, err_s = proc.communicate(stdin, timeout=_timeout())
    except subprocess.TimeoutExpired:
        _kill_tree(proc)
        try:
            proc.communicate(timeout=2)
        except Exception:
            pass
        return {"ok": False, "error": "dialectos timed out"}
    except BaseException:
        _kill_tree(proc)
        raise
    finally:
        if proc.poll() is None:
            _kill_tree(proc)
        elif os.name != "nt":
            # Reap strays left in our process group after the leader exits.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except (ProcessLookupError, PermissionError, OSError):
                pass
    out = (out_s or "").strip()
    err = (err_s or "").strip()
    if proc.returncode != 0 and not out:
        return {"ok": False, "exit": proc.returncode, "error": err[-800:] or f"exit {proc.returncode}"}
    # One output limit for every mode. JSON replies used to skip it, so the page's detect route
    # could return an unbounded payload while prose replies were refused.
    if len(out) > MAX_OUT:
        return {
            "ok": False,
            "error": f"dialectos output exceeds {MAX_OUT} chars ({len(out)}); use the DialectOS CLI for documents",
            "truncated": True,
        }
    res: Dict[str, Any] = {"ok": proc.returncode == 0, "exit": proc.returncode}
    if expect_json:
        # Decode only the root at offset zero. The CLI appends a human status
        # line to failed validation reports; never search nested JSON openers.
        try:
            data, end = json.JSONDecoder().raw_decode(out)
            trailer = out[end:].strip()
            if trailer and not re.fullmatch(r"Validation failed with \d+ blocking issue\(s\)\.", trailer):
                raise json.JSONDecodeError("unexpected JSON trailer", out, end)
            res["data"] = data
        except json.JSONDecodeError:
            res["text"] = out
            if proc.returncode == 0:
                res["ok"] = False
                res["error"] = "expected JSON from dialectos"
    else:
        # Translation / non-JSON stdout is prose — never fish JSON fragments out of it.
        res["text"] = out
    if err:
        res["stderr"] = err[-400:]
    return res


# --- validation helpers -----------------------------------------------------

def _dialect(val: Any) -> str:
    d = str(val or _cfg("default_dialect")).strip()
    if not DIALECT_RE.match(d):
        raise ValueError(f"invalid dialect {d!r} (expected es-XX, e.g. es-MX)")
    return d


def _text(val: Any, field: str = "text", limit: int = MAX_TEXT) -> str:
    t = str(val or "").strip()
    if not t:
        raise ValueError(f"{field} is required")
    if len(t) > limit:
        raise ValueError(f"{field} exceeds {limit} chars; use the DialectOS CLI for documents")
    if t.startswith("-"):
        t = " " + t  # never let text be parsed as a CLI flag
    return t


# --- plugin-side QA guards ----------------------------------------------------
# The v0.3.2 CLI passes a French translation, changed numbers and a translation that
# drops most of the source. These checks are deterministic and run on every verdict.
# None of them can see meaning: a sentence that now says the opposite still passes.

GUARD_SCOPE = (
    "Checks form, not meaning: numbers, language, length, links, placeholders, code blocks and "
    "dialect markers. It cannot tell when a sentence now says the opposite; read the result "
    "or back-translate it for that."
)
_FENCE_RE = re.compile(r"(?ms)^\s*(```|~~~).*?^\s*\1[^\n]*$")
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")
_URL_RE = re.compile(r"https?://\S+")
_UNIT_GROUPS = {
    "microgram": ("µg", "μg", "mcg", "microgram", "micrograms", "microgramo", "microgramos"),
    "milligram": ("mg", "milligram", "milligrams", "miligramo", "miligramos"),
    "gram": ("g", "gram", "grams", "gramo", "gramos"),
    "kilogram": ("kg", "kilogram", "kilograms", "kilogramo", "kilogramos"),
    "milliliter": ("ml", "milliliter", "milliliters", "millilitre", "millilitres", "mililitro", "mililitros"),
    "liter": ("l", "liter", "liters", "litre", "litres", "litro", "litros"),
    "meter": ("m", "meter", "meters", "metre", "metres", "metro", "metros"),
    "kilometer": ("km", "kilometer", "kilometers", "kilometre", "kilometres", "kilómetro", "kilómetros"),
    "centimeter": ("cm", "centimeter", "centimeters", "centimetre", "centimetres", "centímetro", "centímetros"),
    "millimeter": ("mm", "millimeter", "millimeters", "millimetre", "millimetres", "milímetro", "milímetros"),
    "micrometer": ("µm", "μm", "micrometer", "micrometers", "micrometre", "micrometres"),
    "mile": ("mile", "miles", "milla", "millas"),
    "minute": ("min", "mins", "minute", "minutes", "minuto", "minutos"),
    "hour": ("h", "hr", "hrs", "hour", "hours", "hora", "horas"),
    "second": ("s", "sec", "secs", "second", "seconds", "segundo", "segundos"),
    "day": ("d", "day", "days", "día", "días"),
    "byte": ("b", "byte", "bytes"),
    "kilobyte": ("kb", "kilobyte", "kilobytes"),
    "megabyte": ("mb", "megabyte", "megabytes"),
    "gigabyte": ("gb", "gigabyte", "gigabytes"),
    "frame_rate": ("fps",),
    "volt": ("v", "volt", "volts", "voltio", "voltios"),
    "hertz": ("hz", "hertz"),
    "gigahertz": ("ghz", "gigahertz"),
    "watt": ("w", "watt", "watts", "vatio", "vatios"),
    "pound": ("lb", "lbs", "pound", "pounds", "libra", "libras"),
    "ounce": ("oz", "ounce", "ounces", "onza", "onzas"),
    "celsius": ("°c", "degc", "c"),
    "fahrenheit": ("°f", "degf"),
}
_UNIT_CANONICAL = {alias.casefold(): name for name, aliases in _UNIT_GROUPS.items() for alias in aliases}
_UNIT_PATTERN = "|".join(
    re.escape(alias) for alias in sorted(_UNIT_CANONICAL, key=len, reverse=True))
_NUM_CORE = r"[+\-−]?\d+(?:[.,   ]\d{3})*(?:[.,]\d+)?"
_NUM_RE = re.compile(
    rf"(?:(?<![\w.,])|(?<=\bv)){_NUM_CORE}(?:st|nd|rd|th|s)?"
    rf"(?:(?![\w])|(?=(?:{_UNIT_PATTERN}|k)(?![A-Za-z])))",
    re.IGNORECASE,
)
_ATTACHED_UNIT_RE = re.compile(
    rf"(?:(?<![\w.,])|(?<=\bv))(?P<number>{_NUM_CORE})(?P<unit>{_UNIT_PATTERN})(?!\w)",
    re.IGNORECASE,
)
_TRANSLATED_UNIT_RE = re.compile(
    rf"(?:(?<![\w.,])|(?<=\bv))(?P<number>{_NUM_CORE})\s*(?P<unit>{_UNIT_PATTERN})(?!\w)",
    re.IGNORECASE,
)
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)
_TIME_12H_RE = re.compile(r"(?<!\d)(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?\s?m\.?(?!\w)", re.I)
_TIME_24H_RE = re.compile(r"(?<!\d)([01]?\d|2[0-3])[:h]([0-5]\d)(?!\w)", re.I)
_TIME_EN_HOUR_RE = re.compile(
    r"\bat\s+(?P<h>[01]?\d|2[0-3])\s+h(?:ours?)?(?!\w)", re.I)
# Spanish day periods: "4 de la tarde" is 16:00, "12 de la noche" is midnight.
# English day periods: "8 in the morning" is 08:00, "3 in the afternoon" is 15:00.
_TIME_EN_PERIOD_RE = re.compile(
    r"(?<!\d)(?P<cue>\b(?:at|from|until|before|after|by|around)\s+)?"
    r"(?P<h>1[0-2]|0?[1-9])(?::(?P<minute>[0-5]\d))?\s+"
    r"(?P<oclock>o'clock\s+)?(?:in\s+the\s+(?P<period>morning|afternoon|evening)|at\s+(?P<night>night))(?!\w)"
    r"(?!\s+(?:dose|tablet|pill|meal|class|appointment|meeting|shift|lecture|lesson)s?\b)",
    re.I)
_TIME_EN_WORD_PERIOD_RE = re.compile(
    r"(?<!\w)(?P<cue>\b(?:at|from|until|before|after|by|around)\s+)?"
    r"(?P<h>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    r"(?:(?:in\s+the\s+(?P<period>morning|afternoon|evening))|"
    r"at\s+(?P<night>night)|(?P<oclock>o'clock))(?!\w)"
    r"(?!\s+(?:dose|tablet|pill|meal|class|appointment|meeting|shift|lecture|lesson)s?\b)",
    re.IGNORECASE)
_TIME_EN_WORD_RE = re.compile(
    r"\bat\s+(?P<h>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    r"(?P<period>a\.?m\.?|p\.?m\.?)\b", re.IGNORECASE)
_TIME_EN_NOON_RE = re.compile(r"\bat\s+(?P<period>noon|midday|mid-day|midnight)\b", re.IGNORECASE)
_TIME_ES_RANGE_RE = re.compile(
    r"\bde\s+(?P<start>[01]?\d|2[0-3])\s+a\s+(?P<end>[01]?\d|2[0-3])\s*h(?:oras?)?\b",
    re.IGNORECASE)
_TIME_ES_BETWEEN_RE = re.compile(
    r"\bentre\s+las?\s+(?P<start>[01]?\d|2[0-3])\s+y\s+las?\s+"
    r"(?P<end>[01]?\d|2[0-3])(?:\s*h(?:oras?)?)?\b", re.IGNORECASE)
_TIME_ES_PERIOD_RE = re.compile(
    r"(?<!\d)(1[0-2]|0?[1-9])(?::([0-5]\d))?\s+(?:de\s+la\s+(mañana|madrugada|tarde|noche)|del\s+(mediod[ií]a))(?!\w)"
    r"(?!\s+(?:dosis|pastilla|comprimido|tableta|comida|clase|reunión|turno)\b)",
    re.I)
_TIME_ES_WORD_PERIOD_RE = re.compile(
    r"(?<!\w)a\s+las?\s+"
    r"(?P<h>una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+"
    r"de\s+la\s+(?P<period>mañana|madrugada|tarde|noche)(?!\w)", re.IGNORECASE)
_TIME_ES_WORD_HOUR_RE = re.compile(
    r"(?<!\w)a\s+las?\s+"
    r"(?P<h>una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?!\w)",
    re.IGNORECASE)
_TIME_ES_NAMED_RE = re.compile(
    r"\b(?:(?:al|a)\s+mediod[ií]a|a\s+(?:la\s+)?medianoche)\b", re.IGNORECASE)
_EN_TIME_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}
_TIME_ES_HOUR_RE = re.compile(
    r"(?<![\w\d])(?:(?P<verb>son\s+)?(?P<prep>a\s+|desde\s+|hasta\s+)?(?P<art>las?)\s+)?"
    r"(?P<h>[01]?\d|2[0-3])\s*(?P<unit>h(?:oras?)?)(?!\w)", re.IGNORECASE)
_ES_TIME_WORDS = {
    "una": 1, "dos": 2, "tres": 3, "cuatro": 4, "cinco": 5, "seis": 6,
    "siete": 7, "ocho": 8, "nueve": 9, "diez": 10, "once": 11, "doce": 12,
}
_ES_WORDS = frozenset(
    "el la los las de del y en que es un una por para con se no su sus al lo como más pero "
    "le les ya o este esta estos estas ese esa eso porque entre cuando muy sin sobre también "
    "me hasta hay donde desde todo todos nos durante uno unos ni contra ante ellos esto antes "
    "algunos qué otro otra otros otras él tanto mucho nada cual poco ella estar algo nosotros "
    "tu tú usted ustedes vos son está están fue ser tiene puede hacer después aquí así".split()
)
_SPANISH_HOMOGRAPHS = frozenset("ha solo che come di entro dos da das pelo mas".split())
# Words that are common in each language and are not Spanish words.
_OTHER_WORDS: Dict[str, frozenset] = {
    "English": frozenset(
        "the and of to is are in for with on at by this that it be you your will after within "
        "from have has was were not or an as its their they we our can which".split()),
    "French": frozenset(
        "le et est des du pour dans pas sur au aux avec ce qui il elle sont après sous vous "
        "nous je les une ou mais cette ces être avoir fait leur très".split()) - _ES_WORDS,
    "Portuguese": frozenset(
        "o os as da do das dos não em uma ao na no você mais mas é são pelo pela isso também "
        "muito seu sua foi tem".split()) - _ES_WORDS - _SPANISH_HOMOGRAPHS,
    "Italian": frozenset(
        "il gli della di che è per non sono del alla dei delle questo anche più ma come nel "
        "una lo ha i entro dopo nella degli sul questa essere ogni solo".split()) - _ES_WORDS - _SPANISH_HOMOGRAPHS,
}
# Small numbers a translator may spell out ("3 to 5" -> "de tres a cinco").
_ES_SPELLED = {
    "0": ("cero",), "1": ("uno", "una", "un", "primer", "primero", "primera"), "2": ("dos",),
    "3": ("tres",), "4": ("cuatro",), "5": ("cinco",), "6": ("seis",), "7": ("siete",),
    "8": ("ocho",), "9": ("nueve",), "10": ("diez",), "11": ("once",), "12": ("doce",),
    "13": ("trece",), "14": ("catorce",), "15": ("quince",), "16": ("dieciséis", "dieciseis"),
    "17": ("diecisiete",), "18": ("dieciocho",), "19": ("diecinueve",), "20": ("veinte",),
    "21": ("veintiuno", "veintiún", "veintiun", "veintiuna"), "22": ("veintidós", "veintidos"),
    "23": ("veintitrés", "veintitres"), "24": ("veinticuatro",), "25": ("veinticinco",),
    "26": ("veintiséis", "veintiseis"), "27": ("veintisiete",), "28": ("veintiocho",),
    "29": ("veintinueve",), "30": ("treinta",),
    "31": ("treinta y uno", "treinta y una", "treinta y un"),
    "40": ("cuarenta",), "50": ("cincuenta",),
    "60": ("sesenta",), "70": ("setenta",), "80": ("ochenta",), "90": ("noventa",),
    "100": ("cien", "ciento"), "1000": ("mil",),
}
_ES_SPELLED.update({
    "1": (*_ES_SPELLED["1"], "primero", "primera"),
    "2": (*_ES_SPELLED["2"], "segundo", "segunda"),
    "3": (*_ES_SPELLED["3"], "tercer", "tercero", "tercera"),
    "4": (*_ES_SPELLED["4"], "cuarto", "cuarta"),
    "5": (*_ES_SPELLED["5"], "quinto", "quinta"),
    "6": (*_ES_SPELLED["6"], "sexto", "sexta"),
    "7": (*_ES_SPELLED["7"], "séptimo", "septimo", "séptima", "septima"),
    "8": (*_ES_SPELLED["8"], "octavo", "octava"),
    "9": (*_ES_SPELLED["9"], "noveno", "novena"),
    "10": (*_ES_SPELLED["10"], "décimo", "decimo", "décima", "decima"),
    "11": ("once", "undécimo", "undecimo", "undécima", "undecima"),
    "12": ("doce", "duodécimo", "duodecimo", "duodécima", "duodecima"),
    "13": ("trece", "decimotercero", "decimotercera"),
    "14": ("catorce", "decimocuarto", "decimocuarta"),
    "15": ("quince", "decimoquinto", "decimoquinta"),
    "16": ("dieciséis", "dieciseis", "decimosexto", "decimosexta"),
    "17": ("diecisiete", "decimoséptimo", "decimoseptimo", "decimoséptima", "decimoseptima"),
    "18": ("dieciocho", "decimoctavo", "decimoctava"),
    "19": ("diecinueve", "decimonoveno", "decimonovena"),
    "20": ("veinte", "vigésimo", "vigesimo", "vigésima", "vigesima"),
    "21": ("veintiuno", "veintiún", "veintiun", "veintiuna", "vigésimo primero",
          "vigésimo primer", "vigésima primera"),
    "30": ("treinta", "trigésimo", "trigesimo", "trigésima", "trigesima"),
    "40": ("cuarenta", "cuadragésimo", "cuadragesimo", "cuadragésima", "cuadragesima"),
    "50": ("cincuenta", "quincuagésimo", "quincuagesimo", "quincuagésima", "quincuagesima"),
    "60": ("sesenta", "sexagésimo", "sexagesimo", "sexagésima", "sexagesima"),
    "70": ("setenta", "septuagésimo", "septuagesimo", "septuagésima", "septuagesima"),
    "80": ("ochenta", "octogésimo", "octogesimo", "octogésima", "octogesima"),
    "90": ("noventa", "nonagésimo", "nonagesimo", "nonagésima", "nonagesima"),
    "100": ("cien", "ciento", "centésimo", "centesimo", "centésima", "centesima"),
})
_ES_ORDINALS = {
    "1": ("primer", "primero", "primera"), "2": ("segundo", "segunda"),
    "3": ("tercer", "tercero", "tercera"), "4": ("cuarto", "cuarta"),
    "5": ("quinto", "quinta"), "6": ("sexto", "sexta"),
    "7": ("séptimo", "septimo", "séptima", "septima"),
    "8": ("octavo", "octava"), "9": ("noveno", "novena"),
    "10": ("décimo", "decimo", "décima", "decima"),
    "11": ("undécimo", "undecimo", "undécima", "undecima"),
    "12": ("duodécimo", "duodecimo", "duodécima", "duodecima"),
    "13": ("decimotercero", "decimotercera"), "14": ("decimocuarto", "decimocuarta"),
    "15": ("decimoquinto", "decimoquinta"), "16": ("decimosexto", "decimosexta"),
    "17": ("decimoséptimo", "decimoseptimo", "decimoséptima", "decimoseptima"),
    "18": ("decimoctavo", "decimoctava"), "19": ("decimonoveno", "decimonovena"),
    "20": ("vigésimo", "vigesimo", "vigésima", "vigesima"),
    "21": ("vigésimo primero", "vigésimo primer", "vigésima primera"),
    "30": ("trigésimo", "trigesimo", "trigésima", "trigesima"),
    "40": ("cuadragésimo", "cuadragesimo", "cuadragésima", "cuadragesima"),
    "50": ("quincuagésimo", "quincuagesimo", "quincuagésima", "quincuagesima"),
    "60": ("sexagésimo", "sexagesimo", "sexagésima", "sexagesima"),
    "70": ("septuagésimo", "septuagesimo", "septuagésima", "septuagesima"),
    "80": ("octogésimo", "octogesimo", "octogésima", "octogesima"),
    "90": ("nonagésimo", "nonagesimo", "nonagésima", "nonagesima"),
    "100": ("centésimo", "centesimo", "centésima", "centesima"),
}
for number, forms in _ES_ORDINALS.items():
    _ES_SPELLED[number] = tuple(form for form in _ES_SPELLED[number] if form not in forms)
# English number words in the source, so "three tablets" -> "3 comprimidos" is not a new number.
_EN_SPELLED = {
    str(i): (w,) for i, w in enumerate(
        "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
        "fifteen sixteen seventeen eighteen nineteen twenty".split())
}
_EN_SPELLED.update({"30": ("thirty",), "40": ("forty",), "50": ("fifty",), "60": ("sixty",),
                    "70": ("seventy",), "80": ("eighty",), "90": ("ninety",), "12": ("twelve", "dozen"),
                    "100": ("hundred",), "1000": ("thousand", "one thousand")})
_EN_SPELLED["1"] = ("one", "once")
_EN_SPELLED["2"] = (*_EN_SPELLED["2"], "twice")
_EN_UNITS = "one two three four five six seven eight nine".split()
_EN_TENS = "twenty thirty forty fifty sixty seventy eighty ninety".split()
_EN_COMPOUND_EXCLUDED = frozenset(("a", "an", "once", "twice", "dozen"))
for tens, base in zip(_EN_TENS, range(20, 100, 10)):
    for unit, offset in zip(_EN_UNITS, range(1, 10)):
        _EN_SPELLED[str(base + offset)] = (f"{tens}-{unit}",)
_EN_SPELLED["100"] = ("hundred", "one hundred")
for unit, base in zip(_EN_UNITS, range(100, 1000, 100)):
    if base > 100:
        _EN_SPELLED[str(base)] = (f"{unit} hundred",)
    for remainder in range(1, 100):
        for rest in _EN_SPELLED[str(remainder)]:
            if rest in _EN_COMPOUND_EXCLUDED:
                continue
            key = str(base + remainder)
            aliases = _EN_SPELLED.get(key, ())
            _EN_SPELLED[key] = tuple(dict.fromkeys(
                (*aliases, f"{unit} hundred {rest}", f"{unit} hundred and {rest}")))

def _en_under_1000(number: int) -> str:
    if number < 20:
        return _EN_SPELLED[str(number)][0]
    if number < 100:
        tens, remainder = divmod(number, 10)
        return _EN_TENS[tens - 2] + (f" {_EN_UNITS[remainder - 1]}" if remainder else "")
    hundreds, remainder = divmod(number, 100)
    prefix = f"{_EN_UNITS[hundreds - 1]} hundred"
    return prefix + (f" {_en_under_1000(remainder)}" if remainder else "")


_EN_ORDINALS = {
    1: "first", 2: "second", 3: "third", 4: "fourth", 5: "fifth", 6: "sixth",
    7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 11: "eleventh",
    12: "twelfth", 13: "thirteenth", 14: "fourteenth", 15: "fifteenth",
    16: "sixteenth", 17: "seventeenth", 18: "eighteenth", 19: "nineteenth",
    20: "twentieth", 30: "thirtieth", 40: "fortieth", 50: "fiftieth",
    60: "sixtieth", 70: "seventieth", 80: "eightieth", 90: "ninetieth",
    100: "hundredth", 1000: "thousandth",
}
_EN_NUMBER_WORDS = frozenset({
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
    "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
    "eighty", "ninety", "hundred", "thousand", "once", "twice", "dozen",
})
_EN_ORDINAL_WORDS = frozenset(word for ordinal in _EN_ORDINALS.values() for word in ordinal.split())
_ROMAN_CENTURY_RE = re.compile(
    r"\bsiglo\s+(?P<roman>M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})"
    r"(?:IX|IV|V?I{0,3}))\b", re.IGNORECASE)
_ES_NUMBER_WORDS = frozenset(w for forms in _ES_SPELLED.values() for f in forms for w in f.split()) | {"mil"}
_ES_ORDINAL_WORDS = frozenset(w for forms in _ES_ORDINALS.values() for f in forms for w in f.split())
_MIN_WORDS_FOR_LANG = 6


def _en_number_forms(number: int) -> Tuple[str, ...]:
    if number == 1000:
        return _EN_SPELLED["1000"]
    if number < 1000:
        return _EN_SPELLED.get(str(number), ())
    thousands, remainder = divmod(number, 1000)
    prefix = f"{_en_under_1000(thousands)} thousand"
    if not remainder:
        return (prefix,)
    rest = _en_under_1000(remainder)
    forms = [f"{prefix} {rest}", f"{prefix} and {rest}"]
    if 2020 <= number <= 2099:
        forms.append(f"twenty {_en_under_1000(number - 2000)}")
    return tuple(forms)


def _en_ordinal_forms(number: int) -> Tuple[str, ...]:
    if number in _EN_ORDINALS:
        return (_EN_ORDINALS[number],)
    if 20 < number < 100 and number % 10:
        tens, unit = divmod(number, 10)
        return (f"{_EN_TENS[tens - 2]}-{_EN_ORDINALS[unit]}",)
    return ()


def _es_cardinal_forms(number: int) -> Tuple[str, ...]:
    if number == 100:
        return _ES_SPELLED["100"]
    if number in range(0, 32):
        return _ES_SPELLED.get(str(number), ())
    if number < 100:
        tens, unit = divmod(number, 10)
        tens_word = ("", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta",
                     "setenta", "ochenta", "noventa")[tens]
        if tens == 2:
            return (f"veinti{_ES_SPELLED[str(unit)][0]}",)
        if not unit:
            return (tens_word,)
        return tuple(f"{tens_word} y {form}" for form in _ES_SPELLED[str(unit)] if form in (
            "uno", "una", "un", "dos", "tres", "cuatro", "cinco", "seis", "siete",
            "ocho", "nueve"))
    if number < 1000:
        hundreds, remainder = divmod(number, 100)
        if hundreds == 1:
            prefix = "cien" if not remainder else "ciento"
        else:
            prefix = ("", "", "doscientos", "trescientos", "cuatrocientos", "quinientos",
                      "seiscientos", "setecientos", "ochocientos", "novecientos")[hundreds]
        return (prefix,) if not remainder else tuple(
            f"{prefix} {form}" for form in _es_cardinal_forms(remainder))
    thousands, remainder = divmod(number, 1000)
    prefix = "mil" if thousands == 1 else f"{_es_cardinal_forms(thousands)[0]} mil"
    return (prefix,) if not remainder else tuple(
        f"{prefix} {form}" for form in _es_cardinal_forms(remainder))


def _number_phrase_span(form: str, normalized: str, language: str, ordinal: bool = False):
    phrase = re.sub(r"[^\w]+", " ", form.casefold()).strip()
    if not phrase:
        return None
    pattern = r"(?<!\w)" + r"\s+".join(re.escape(word) for word in phrase.split()) + r"(?!\w)"
    for match in re.finditer(pattern, normalized):
        before = normalized[:match.start()].rstrip().split()
        after = normalized[match.end():].lstrip().split()
        previous = before[-1] if before else ""
        previous2 = before[-2] if len(before) > 1 else ""
        following = after[0] if after else ""
        following2 = after[1] if len(after) > 1 else ""
        if language == "en":
            if ordinal:
                return match.span()
            if previous in _EN_NUMBER_WORDS or following in _EN_NUMBER_WORDS:
                continue
            if previous == "and" and previous2 in ("hundred", "thousand"):
                continue
            if following == "and" and phrase.split()[-1] in ("hundred", "thousand") and \
                    following2 in _EN_NUMBER_WORDS:
                continue
        else:
            number_words = (_ES_ORDINAL_WORDS if ordinal else _ES_NUMBER_WORDS) - {"y"}
            if previous in number_words or following in number_words:
                continue
            if previous == "y" and previous2 in number_words:
                continue
            if following == "y" and following2 in number_words:
                continue
        return match.span()
    return None


_ARTICLE_UNITS = frozenset((
    "hour", "hours", "minute", "minutes", "second", "seconds", "day", "days", "week", "weeks",
    "month", "months", "year", "years", "decade", "decades", "century", "centuries", "half",
    "dozen", "gram", "grams", "kilogram", "kilograms", "milligram", "milligrams", "liter",
    "litre", "meter", "metre", "kilometer", "kilometre", "centimeter", "centimetre", "inch",
    "inches", "foot", "feet", "pound", "pounds", "ounce", "ounces", "cup", "cups", "teaspoon",
    "teaspoons", "tablespoon", "tablespoons", "pill", "pills", "tablet", "tablets", "capsule",
    "capsules", "drop", "drops", "dose", "doses", "spoonful", "spoonfuls",
))


def _spelled_span(form: str, normalized: str, ordinal: bool = False):
    phrase = re.sub(r"[^\w]+", " ", form.casefold()).strip()
    if phrase in ("a", "an"):
        for match in re.finditer(rf"(?<!\w){phrase}\s+(?:single\s+)?([\w]+)(?!\w)", normalized):
            before = normalized[:match.start()].rstrip().split()
            if before and before[-1] == "half":
                continue
            if match.group(1) in _ARTICLE_UNITS:
                return match.start(), match.start() + len(phrase)
        return None
    english_words = _EN_NUMBER_WORDS | {"and"}
    if ordinal and all(word in (english_words | _EN_ORDINAL_WORDS) for word in phrase.split()):
        return _number_phrase_span(phrase, normalized, "en", True)
    if all(word in english_words for word in phrase.split()):
        return _number_phrase_span(phrase, normalized, "en", ordinal)
    if all(word in (_ES_NUMBER_WORDS | _ES_ORDINAL_WORDS) for word in phrase.split()):
        return _number_phrase_span(phrase, normalized, "es", ordinal)
    return None


def _spelled_alone(form: str, normalized: str) -> bool:
    return _spelled_span(form, normalized) is not None


_ORDINAL_NOUNS = {
    "floor": {"piso", "planta"}, "room": {"habitación", "habitacion", "cuarto"},
    "chapter": {"capítulo", "capitulo"}, "page": {"página", "pagina"},
    "century": {"siglo"}, "place": {"lugar"}, "attempt": {"intento"},
    "time": {"vez"}, "anniversary": {"aniversario"}, "step": {"paso"},
    "dose": {"dosis"}, "tablet": {"tableta", "comprimido"},
    "pill": {"pastilla", "píldora", "pildora"}, "day": {"día", "dia"},
    "week": {"semana"}, "month": {"mes"}, "year": {"año", "ano"},
}


def _english_ordinal_in_translation(form: str, normalized_src: str, normalized_dst: str, number: int) -> bool:
    span = _spelled_span(form, normalized_src, ordinal=True)
    if span is None:
        return False
    after = normalized_src[span[1]:].strip().split()
    if not after or after[0] not in _ORDINAL_NOUNS:
        return False
    words = normalized_dst.split()
    return any(
        word in _ORDINAL_NOUNS[after[0]]
        and abs(noun_index - number_index) <= 2
        for noun_index, word in enumerate(words)
        for number_index, value in enumerate(words)
        if value == str(number)
    )
_MIN_CHARS_FOR_LENGTH = 80
_SHORT_RATIO = 0.5


def _prose(text: str) -> str:
    return _INLINE_CODE_RE.sub(" ", _FENCE_RE.sub(" ", text))


_VERSION_CUE_RE = re.compile(r"(?:\bv|\bversi[oó]n|\brelease|\bbuild|\brev)\.?\s*$", re.I)


def _numbers(text: str, source: bool = False) -> List[Tuple[str, frozenset]]:
    """Each number as (text, readings), ignoring separator style (1,000.5 == 1.000,5).

    "1.125" is a decimal in English and 1125 in Spain, so a translated "1.125" or "1,125"
    keeps both readings. The source is read the English way ("." decimal, "," grouping), so
    "1.125 euros" -> "1125 euros" no longer passes. Insignificant fraction zeros are dropped
    (1.5 == 1,50) except after a version cue, where 2.10 never matches 2.1."""
    numbers = []
    scrubbed = _URL_RE.sub(" ", text)
    for match in _NUM_RE.finditer(scrubbed):
        raw = match.group(0).replace(" ", "").replace(" ", "").replace(" ", "")
        is_decade = bool(re.fullmatch(r"(?:19|20)\d{2}s", raw, re.IGNORECASE))
        short_decade = bool(re.fullmatch(r"\d{2}s", raw, re.IGNORECASE))
        raw = raw[:-1] if is_decade or short_decade else re.sub(r"(?:st|nd|rd|th|s)$", "", raw, flags=re.I)
        sign = "-" if raw.startswith(("-", "−")) else ""
        raw = raw.lstrip("+-−")
        is_version = bool(_VERSION_CUE_RE.search(scrubbed[:match.start()]))
        thousand_multiplier = bool(re.match(r"k(?![A-Za-z])", scrubbed[match.end():], re.I))

        def value(decimal_at):
            if decimal_at is None:
                digits = re.sub(r"[,.]", "", raw)
                # A two-digit day or month ("05/03") equals "5/3"; a code like 0042 stays 0042.
                return sign + (digits[1:] if len(digits) == 2 and digits[0] == "0" else digits)
            integer = re.sub(r"[,.]", "", raw[:decimal_at])
            fraction = raw[decimal_at + 1:]
            if not is_version:
                fraction = fraction.rstrip("0")
            return sign + integer + ("." + fraction if fraction else "")

        separators = [i for i, char in enumerate(raw) if char in ",."]
        if "," in raw and "." in raw:
            readings = {value(max(separators))}
        elif len(separators) == 1:
            at = separators[0]
            if len(raw) - at - 1 != 3 or raw[:at] == "0":
                readings = {value(at)}
            elif source:
                readings = {value(at if raw[at] == "." else None)}
            else:
                readings = {value(at), value(None)}
        else:
            readings = {value(None)}
        if thousand_multiplier:
            readings = {str(int(reading) * 1000) if reading.isdigit() else reading for reading in readings}
        elif not source and re.match(r"\s+mil\b", scrubbed[match.end():], re.IGNORECASE):
            readings = {str(int(reading) * 1000) if reading.isdigit() else reading for reading in readings}
        if is_decade:
            readings.add(str(int(raw[-2:])))
        if short_decade:
            decade_year = int(raw) + (2000 if int(raw) < 30 else 1900)
            readings.add(str(decade_year))
        label = match.group(0).strip() + ("k" if thousand_multiplier else "")
        numbers.append((label, frozenset(readings)))
    for match in _ROMAN_CENTURY_RE.finditer(scrubbed):
        total = 0
        previous = 0
        for char in reversed(match.group("roman").upper()):
            value = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}[char]
            total += -value if value < previous else value
            previous = max(previous, value)
        if total:
            numbers.append((match.group("roman"), frozenset({str(total)})))
    return numbers


def _attached_unit_counts(text: str, source: bool = False):
    pattern = _ATTACHED_UNIT_RE if source else _TRANSLATED_UNIT_RE
    counts = {}
    for match in pattern.finditer(text):
        readings = _numbers(match.group("number"), source=source)
        raw_unit = match.group("unit").casefold()
        before = text[:match.start()].casefold()
        number_digits = re.sub(r"\D", "", match.group("number"))
        if raw_unit == "s" and (
            len(number_digits) == 4 and number_digits.startswith(("19", "20"))
            or len(number_digits) == 2 and re.search(r"\bthe\s+$", before)
        ):
            continue
        unit = _UNIT_CANONICAL.get(raw_unit)
        if readings and unit:
            key = (readings[0][1], unit)
            counts[key] = counts.get(key, 0) + 1
    return counts


def _units_changed(source: str, translated: str) -> bool:
    expected = _attached_unit_counts(source, source=True)
    actual = list(_attached_unit_counts(translated).items())
    for (source_readings, source_unit), count in expected.items():
        for _ in range(count):
            index = next((i for i, ((readings, unit), amount) in enumerate(actual)
                          if amount and unit == source_unit and source_readings & readings), None)
            if index is None:
                return True
            key, amount = actual[index]
            if amount == 1:
                actual.pop(index)
            else:
                actual[index] = (key, amount - 1)
    return False


_EN_DOSE_PERIOD_RE = re.compile(
    r"\b(?P<number>\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
    r"(?:in\s+the|at)\s+(?P<period>morning|afternoon|evening|night)\b", re.IGNORECASE)
_ES_DOSE_PERIOD_RE = re.compile(
    r"\b(?P<number>\d+(?:[.,]\d+)?)\s+(?:por\s+la|de\s+la)\s+"
    r"(?P<period>mañana|madrugada|tarde|noche)\b", re.IGNORECASE)


def _dose_periods(text: str, source: bool = False, time_matches=()):
    pattern = _EN_DOSE_PERIOD_RE if source else _ES_DOSE_PERIOD_RE
    periods = {}
    aliases = {"madrugada": "morning", "mañana": "morning", "tarde": "afternoon",
               "noche": "night", "evening": "night"}
    for match in pattern.finditer(text):
        if any(match.start() < end and start < match.end() for _, (start, end) in time_matches):
            continue
        amount = match.group("number").casefold()
        if amount in _EN_TIME_WORDS:
            amount = str(_EN_TIME_WORDS[amount])
        period = aliases.get(match.group("period").casefold(), match.group("period").casefold())
        periods.setdefault(period, []).append(amount)
    return periods


def _time_matches(text: str, source_minutes=()):
    """Return explicit 12-hour and 24-hour times as (canonical minutes, span).

    source_minutes lists the source's clock times; a bare "N h" in the translation is a time
    only when it renders one of them (otherwise it is a duration and stays a number)."""
    matches = []
    occupied = []
    for match in _TIME_12H_RE.finditer(text):
        hour = int(match.group(1)) % 12
        if match.group(3).lower() == "p":
            hour += 12
        minute = int(match.group(2) or "0")
        matches.append((hour * 60 + minute, match.span()))
        occupied.append(match.span())
    for match in _TIME_ES_PERIOD_RE.finditer(text):
        before = text[max(0, match.start() - 40):match.start()]
        if re.search(r"\b(?:dosis|pastilla|comprimido|tableta|comida|clase|reunión|turno)\s+de\s+las?\s+$",
                     before, re.IGNORECASE):
            continue
        hour = int(match.group(1)) % 12
        period = (match.group(3) or "mediodía").lower()
        # "de la noche" after 4 is evening; "12" and "1 de la noche" are past midnight.
        if period in ("tarde", "mediodía", "mediodia") or (period == "noche" and hour > 4):
            hour += 12
        minute = int(match.group(2) or "0")
        matches.append((hour * 60 + minute, match.span()))
        occupied.append(match.span())
    for match in _TIME_ES_WORD_PERIOD_RE.finditer(text):
        hour = _ES_TIME_WORDS[match.group("h").lower()] % 12
        period = match.group("period").lower()
        if period == "tarde" or (period == "noche" and hour > 4):
            hour += 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_ES_WORD_HOUR_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        matches.append((_ES_TIME_WORDS[match.group("h").lower()] * 60, span))
        occupied.append(span)
    for match in _TIME_ES_NAMED_RE.finditer(text):
        hour = 12 if "mediod" in match.group(0).lower() else 0
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_PERIOD_RE.finditer(text):
        if not match.group("cue") and not match.group("oclock"):
            continue
        hour = int(match.group("h")) % 12
        period = (match.group("period") or match.group("night")).lower()
        if period in ("afternoon", "evening") or (period == "night" and hour > 4):
            hour += 12
        matches.append((hour * 60 + int(match.group("minute") or "0"), match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_WORD_RE.finditer(text):
        hour = _EN_TIME_WORDS[match.group("h").lower()] % 12
        if match.group("period").lower().startswith("p"):
            hour += 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_WORD_PERIOD_RE.finditer(text):
        if not match.group("cue") and not match.group("oclock"):
            continue
        hour = _EN_TIME_WORDS[match.group("h").lower()] % 12
        period = (match.group("period") or match.group("night") or "").lower()
        if period in ("afternoon", "evening") or (period == "night" and hour > 4):
            hour += 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_NOON_RE.finditer(text):
        hour = 0 if match.group("period").lower() == "midnight" else 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_24H_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        matches.append((int(match.group(1)) * 60 + int(match.group(2) or "0"), span))
        occupied.append(span)
    for match in _TIME_EN_HOUR_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        matches.append((int(match.group("h")) * 60, span))
        occupied.append(span)
    unclaimed = list(source_minutes)
    for minute, _ in matches:
        if minute in unclaimed:
            unclaimed.remove(minute)
    spanish_hours = list(_TIME_ES_HOUR_RE.finditer(text))
    for match in spanish_hours:
        if not match.group("art"):
            continue
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        minute = int(match.group("h")) * 60
        if match.group("prep") or (
            match.group("verb") and minute in unclaimed
        ) or (
            match.group("unit").lower() == "h" and minute in unclaimed
        ):
            if minute in unclaimed:
                unclaimed.remove(minute)
            matches.append((minute, span))
            occupied.append(span)
    for match in spanish_hours:
        if match.group("art"):
            continue
        if match.group("unit").lower() != "h":
            continue
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        minute = int(match.group("h")) * 60
        if minute in unclaimed:
            unclaimed.remove(minute)
            matches.append((minute, span))
            occupied.append(span)
    for match in _TIME_ES_RANGE_RE.finditer(text):
        start = int(match.group("start")) * 60
        end = int(match.group("end")) * 60
        matched_minutes = [minute for minute, _ in matches]
        if start != end and start in unclaimed and end in unclaimed:
            matches.append((start, match.span("start")))
            matches.append((end, match.span("end")))
            unclaimed.remove(start)
            unclaimed.remove(end)
        elif end in matched_minutes and start in unclaimed:
            matches.append((start, match.span("start")))
            unclaimed.remove(start)
        elif start in matched_minutes and end in unclaimed:
            matches.append((end, match.span("end")))
            unclaimed.remove(end)
    for match in _TIME_ES_BETWEEN_RE.finditer(text):
        start = int(match.group("start")) * 60
        end = int(match.group("end")) * 60
        matched_minutes = [minute for minute, _ in matches]
        if start != end and start in unclaimed and end in unclaimed:
            matches.append((start, match.span("start")))
            matches.append((end, match.span("end")))
            unclaimed.remove(start)
            unclaimed.remove(end)
        elif end in matched_minutes and start in unclaimed:
            matches.append((start, match.span("start")))
            unclaimed.remove(start)
        elif start in matched_minutes and end in unclaimed:
            matches.append((end, match.span("end")))
            unclaimed.remove(end)
    return matches


def _without_times(source: str, translated: str, src_times, dst_times):
    """Remove explicit times so the caller can compare their canonical values."""

    def strip(text, times):
        chars = list(text)
        for _, (start, end) in times:
            chars[start:end] = " " * (end - start)
        return "".join(chars)

    return strip(source, src_times), strip(translated, dst_times)


def _language_guess(text: str) -> Optional[str]:
    words = [w.lower() for w in _WORD_RE.findall(text)]
    if len(words) < _MIN_WORDS_FOR_LANG:
        return None
    es = sum(w in _ES_WORDS for w in words)
    best, hits = max(((name, sum(w in vocab for w in words)) for name, vocab in _OTHER_WORDS.items()),
                     key=lambda kv: kv[1])
    return best if hits >= 2 and hits > es else None


def _guard_issues(source: str, translated: str) -> List[str]:
    src, dst = _prose(source), _prose(translated)
    issues: List[str] = []
    src_matches = _time_matches(src)
    dst_matches = _time_matches(dst, [minute for minute, _ in src_matches])
    src_times = sorted(minute for minute, _ in src_matches)
    dst_times = sorted(minute for minute, _ in dst_matches)
    if src_times != dst_times and (src_times or dst_times):
        issues.append("Times from the source are missing or changed.")
    if _units_changed(src, dst):
        issues.append("Units attached to source numbers are missing or changed.")
    src_periods = _dose_periods(src, source=True, time_matches=src_matches)
    dst_periods = _dose_periods(dst, time_matches=dst_matches)
    if src_periods != dst_periods:
        if src_periods:
            issues.append("Dose counts attached to day periods are missing or changed.")
    src_numbers, dst_numbers = _without_times(src, dst, src_matches, dst_matches)
    missing = list(_numbers(src_numbers, source=True))
    extra = []
    for label, readings in _numbers(dst_numbers):
        hit = next((m for m in missing if m[1] == readings), None) or \
            next((m for m in missing if m[1] & readings), None)
        if hit is not None:
            missing.remove(hit)
        else:
            extra.append((label, readings))
    for cold in re.finditer(
        r"(?<!\w)(\d+(?:[.,]\d+)?)\s*(?:grados?|°\s*[cf]?)\s+bajo\s+cero\b", dst, re.I):
        for label, magnitude in _numbers(cold.group(1)):
            signed = frozenset("-" + v for v in magnitude)
            src_hit = next((m for m in missing if m[1] & signed), None)
            dst_hit = next((e for e in extra if e[1] == magnitude), None)
            if src_hit is not None and dst_hit is not None:
                missing.remove(src_hit)
                extra.remove(dst_hit)
    if extra:
        # A digit the source spelled out ("three tablets" -> "3 comprimidos") is not new.
        normalized_src = " " + re.sub(r"[^\w]+", " ", src.casefold()) + " "
        normalized_dst = " " + re.sub(r"[^\w]+", " ", dst.casefold()) + " "
        for item in list(extra):
            forms = [f for v in sorted(item[1]) if re.fullmatch(r"\d+", v)
                     for f in _en_number_forms(int(v)) + _es_cardinal_forms(int(v))]
            if "1" in item[1]:
                forms.extend(("a", "an"))
            span = next((candidate for form in forms
                         if (candidate := _spelled_span(form, normalized_src)) is not None), None)
            if span is None:
                for value in item[1]:
                    if not re.fullmatch(r"\d+", value):
                        continue
                    if any(_english_ordinal_in_translation(form, normalized_src, normalized_dst, int(value))
                           for form in _en_ordinal_forms(int(value))):
                        span = (-1, -1)
                        break
            if span is not None:
                extra.remove(item)
                if span != (-1, -1):
                    normalized_src = normalized_src[:span[0]] + (" " * (span[1] - span[0])) + normalized_src[span[1]:]
    if missing:
        normalized_dst = " " + re.sub(r"[^\w]+", " ", dst.casefold()) + " "
        for item in list(missing):
            ordinal = bool(re.search(r"(?:st|nd|rd|th)$", item[0], re.IGNORECASE))
            forms = [f for v in sorted(item[1]) if re.fullmatch(r"\d+", v)
                     for f in _ES_ORDINALS.get(v, ()) if ordinal]
            if not ordinal:
                forms = [f for v in sorted(item[1]) if re.fullmatch(r"\d+", v)
                         for f in _es_cardinal_forms(int(v))]
            span = next((candidate for form in forms
                         if (candidate := _spelled_span(form, normalized_dst, ordinal=ordinal)) is not None), None)
            if span is not None:
                missing.remove(item)
                normalized_dst = normalized_dst[:span[0]] + (" " * (span[1] - span[0])) + normalized_dst[span[1]:]
    if missing:
        labels = sorted({label for label, _ in missing})
        issues.append("Numbers from the source are missing or changed: " + ", ".join(labels[:8]))
    if extra:
        labels = sorted({label for label, _ in extra})
        issues.append("Numbers in the translation are not in the source: " + ", ".join(labels[:8]))
    lang = _language_guess(dst)
    if lang:
        issues.append(f"Translation reads as {lang}, not Spanish.")
    src_len, dst_len = len(src.strip()), len(dst.strip())
    if src_len >= _MIN_CHARS_FOR_LENGTH and dst_len < src_len * _SHORT_RATIO:
        issues.append(
            f"Translation is {round(100 * dst_len / src_len)}% of the source's length; part of it may be missing."
        )
    return issues


def _apply_guards(report: Dict[str, Any], source: str, translated: str) -> None:
    """Merge guard failures into the CLI report as blocking issues (never flips a fail to pass)."""
    issues = _guard_issues(source, translated)
    report["pluginGuards"] = {"passed": not issues, "issues": issues, "scope": GUARD_SCOPE}
    if not issues:
        return
    report["valid"] = False
    top = report.get("blockingIssues")
    if not isinstance(top, list):
        top = []
    report["blockingIssues"] = top + [i for i in issues if i not in top]


# --- operations -------------------------------------------------------------

def detect(text: str) -> Dict[str, Any]:
    return run_dialectos(["dialects", "detect", _text(text), "--format", "json"], expect_json=True)


def list_dialects() -> Dict[str, Any]:
    res = run_dialectos(["dialects", "list", "--format", "json"], expect_json=True)
    if "data" in res:
        data = res["data"]
        if not isinstance(data, list) or not all(
            isinstance(d, dict) and isinstance(d.get("code"), str) and isinstance(d.get("name"), str)
            for d in data
        ):
            res.pop("data")
            res.update(ok=False, error="expected dialect metadata array with code/name fields")
    return res


def translate(text: str, dialect: Optional[str] = None, formal: Optional[bool] = None,
              provider: Optional[str] = None) -> Dict[str, Any]:
    # The user's setting wins: the model may only choose when no provider is configured,
    # so a prompt cannot reroute text to a provider the user did not pick.
    configured = str(_cfg("provider") or "").strip().lower()
    prov = configured or str(provider or "").strip().lower()
    if prov not in PROVIDERS:
        raise ValueError(f"select an explicit provider in settings or this call: {sorted(PROVIDERS)}; auto fallback is disabled")
    args = ["translate", "--dialect", _dialect(dialect), "--provider", prov]
    if formal is True:
        args.append("--formal")
    elif formal is False:
        args.append("--informal")
    return run_dialectos(args, stdin=_text(text), expect_json=False)


def validate(translated: str, dialect: Optional[str] = None, source: Optional[str] = None) -> Dict[str, Any]:
    if not (source and str(source).strip()):
        raise ValueError(
            "source is required for dialectos_validate (empty source always fails DialectOS semantic QA). "
            "Pass the original English/source text, or use the DialectOS CLI for dialect-only workflows."
        )
    _text(translated, "translated", MAX_OUT)
    _text(source, "source")
    translated_text = str(translated)
    source_text = str(source)
    if len(translated_text) > MAX_OUT or len(source_text) > MAX_TEXT:
        raise ValueError("document exceeds inline QA size limits")
    args = ["validate", "--dialect", _dialect(dialect), "--format", "json"]
    # All inline documents go through private bounded files: enables CLI markdown
    # structure checks without exposing a user-facing path API or argv-size limits.
    # v0.3.2+ judges fences against the source; a failing CLI verdict is never overridden.
    with tempfile.TemporaryDirectory(prefix="qa-", dir=str(_data_dir())) as temp:
        src = Path(temp) / "source.md"
        dst = Path(temp) / "translated.md"
        src.write_text(source_text, encoding="utf-8", newline="")
        dst.write_text(translated_text, encoding="utf-8", newline="")
        res = run_dialectos(args + ["--source-file", str(src), "--translated-file", str(dst)], expect_json=True)
    # validate exits non-zero on blocking issues but still prints JSON — that's a verdict, not a crash
    if isinstance(res.get("data"), dict) and type(res["data"].get("valid")) is bool:
        res["ok"] = True
        _apply_guards(res["data"], source_text, translated_text)
        _capture_learning(res["data"], _dialect(dialect))
    elif "data" in res:
        res.pop("data")
        res["ok"] = False
        res["error"] = "expected validation report object with a boolean valid verdict"
    return res


def _learning_store():
    from .learning import LearningStore

    def dictionary_path():
        suffix = "node_modules/@dialectos/types/dist/dialectal-dictionary.json"
        root = _release_dir()
        paths = (root / suffix, root / "package" / suffix)
        return next((p for p in paths if p.is_file()), paths[0])

    return LearningStore(_data_dir, _atomic_write_json, _locked, dictionary_path)


def _capture_learning(report: Dict[str, Any], dialect: str) -> None:
    # Learning must never change a verdict or interrupt the ledger, even if its
    # dictionary is absent or the private folder is temporarily unwritable.
    try:
        _learning_store().capture(report, dialect)
    except Exception:
        logger.debug("dialectos: learning capture unavailable")


def learn(action: str, dialect: Optional[str] = None, concept: Optional[str] = None,
          answer: Optional[str] = None, confirm: bool = False, offset: int = 0,
          *, _page: bool = False) -> Dict[str, Any]:
    """Offline learning; remote chats can read but cannot change private progress.

    The dashboard has its existing trusted-dashboard boundary (as for Translate).
    Only its Python route can set _page; this is not an agent tool parameter.
    """
    if action not in {"tip", "quiz", "answer", "stats", "cards", "forget"}:
        raise ValueError("Learn action must be tip, quiz, answer, stats, cards or forget.")
    if action in {"answer", "forget"} and not _page and _on_gateway():
        raise ValueError("Learning changes are disabled on gateway platforms; use a local session or the DialectOS page.")
    d = _dialect(dialect)
    store = _learning_store()
    if action == "tip":
        data = store.compare(concept, d) if concept else store.tip(d)
    elif action == "quiz":
        data = store.quiz(d)
    elif action == "stats":
        data = store.stats(d)
    elif action == "cards":
        if type(offset) is not int or offset < 0:
            raise ValueError("offset must be a nonnegative integer")
        cards = store.cards(d)
        data = {"cards": cards[offset:offset + 20], "total": len(cards), "offset": offset,
                "next_offset": offset + 20 if offset + 20 < len(cards) else None}
    elif action == "answer":
        if not isinstance(concept, str) or not concept:
            raise ValueError("answer requires the quiz concept and dialect")
        data = store.answer(concept, d, _text(answer, "answer", 500))
    else:
        data = {"forgotten": store.forget(d, confirm=confirm)}
    return {"ok": True, "data": data}


# --- hooks ------------------------------------------------------------------

_BRIEF = (
    "[DialectOS] Only if the requested target is Spanish, apply the following workflow. "
    "Never override an explicit non-Spanish target, or interpret source-language mentions or negations as target intent. "
    "For a Spanish target, do not default to generic Spanish: "
    "pick the target regional variant (es-MX, es-AR, es-ES, es-CO, … — `dialectos_list_dialects`), "
    "use `dialectos_detect` on any source Spanish, select an explicit provider (no auto fallback), translate with `dialectos_translate`, and run "
    "`dialectos_validate` on the result with the original source text before presenting it. "
    "Code blocks must match the source byte for byte. "
    "Register is advisory; state the dialect and formality (tú/vos/usted) you used."
)


def _on_pre_llm(user_message: str = "", **_: Any) -> Optional[Dict[str, str]]:
    try:
        if _cfg("inject_on_spanish") and user_message and _wants_spanish(user_message):
            return {"context": _BRIEF}
    except Exception:
        logger.debug("dialectos: pre_llm_call failed", exc_info=True)
    return None


def _issue_counts(report: Dict[str, Any]) -> tuple[int, int]:
    """Normalize CLI report fields into (all_issues, blocking_issues)."""
    judge = report.get("outputJudge") if isinstance(report.get("outputJudge"), dict) else {}
    judge_issues = judge.get("issues") if isinstance(judge.get("issues"), list) else []
    judge_blocking = judge.get("blockingIssues") if isinstance(judge.get("blockingIssues"), list) else []
    top_blocking = report.get("blockingIssues") if isinstance(report.get("blockingIssues"), list) else []
    # Rich issues and top-level strings share an exact message identity.
    def identity(issue: Any) -> str:
        if isinstance(issue, dict) and isinstance(issue.get("message"), str):
            return issue["message"]
        return issue if isinstance(issue, str) else json.dumps(issue, sort_keys=True, default=str)

    blocking_msgs = {identity(x) for x in (judge_blocking + top_blocking)}
    all_msgs = {identity(x) for x in (judge_issues + judge_blocking + top_blocking)}
    # Legacy top-level "issues" if a future CLI adds it.
    legacy = report.get("issues") if isinstance(report.get("issues"), list) else []
    for x in legacy:
        all_msgs.add(identity(x))
    return len(all_msgs), len(blocking_msgs)


def _on_post_tool(tool_name: str = "", args: Optional[Dict[str, Any]] = None, result: Any = None,
                  **_: Any) -> None:
    """QA ledger: remember dialect + validate verdicts (no source text stored)."""
    try:
        if tool_name not in {"dialectos_translate", "dialectos_detect", "dialectos_validate", "dialectos_list_dialects"}:
            return None
        payload = result
        if isinstance(result, str):
            try:
                payload = json.loads(result)
            except Exception:
                payload = {"raw": result[:200]}
        dialect = (args or {}).get("dialect")
        if not dialect:
            dialect = _cfg("default_dialect")
        # The ledger is verdict-only: store a dialect code, never a raw rejected argument
        # (a caller can put any text in that field before validation refuses it).
        if not (isinstance(dialect, str) and DIALECT_RE.match(dialect)):
            dialect = "invalid"
        entry: Dict[str, Any] = {
            "ts": int(time.time()),
            "tool": tool_name,
            "dialect": dialect,
            "ok": isinstance(payload, dict) and bool(payload.get("ok")),
        }
        if tool_name == "dialectos_validate" and isinstance(payload, dict):
            d = payload.get("data") or {}
            if isinstance(d, dict):
                entry["passed"] = d.get("valid", d.get("passed"))
                all_n, block_n = _issue_counts(d)
                entry["issue_count"] = all_n
                entry["blocking_issue_count"] = block_n
                _capture_learning(d, dialect)
        _append_ledger(entry)
    except Exception:
        logger.debug("dialectos: post_tool_call failed", exc_info=True)
    return None


# --- tools ------------------------------------------------------------------

TRANSLATE_SCHEMA = {
    "name": "dialectos_translate",
    "description": "Translate English text into a specific regional Spanish dialect (25 variants) with structure/identity protection. Sends text to the configured provider.",
    "parameters": {
        "type": "object",
        "properties": {
            "text": {"type": "string", "description": "Source text (<= 8000 chars)."},
            "dialect": {"type": "string", "description": "Target dialect code, e.g. es-MX, es-AR, es-ES."},
            "formal": {"type": "boolean", "description": "true = usted, false = tú/vos; omit for provider default."},
            "provider": {"type": "string", "enum": sorted(PROVIDERS),
                         "description": "Used only when the user has not set a provider in settings; the setting always wins."},
        },
        "required": ["text"],
    },
}
DETECT_SCHEMA = {
    "name": "dialectos_detect",
    "description": "Detect which regional Spanish dialect a text is written in (offline, deterministic).",
    "parameters": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
}
VALIDATE_SCHEMA = {
    "name": "dialectos_validate",
    "description": "Offline Spanish QA against a dialect with original source required. Bounded inline documents use private temporary .md files for structure checks. The pinned v0.3.2 CLI requires code fences to match the source byte for byte. Register controls are advisory, not a blocking expected-register contract. The plugin also blocks changed or missing numbers, a translation that reads as English/French/Portuguese/Italian, and one under half the source's length. It checks form, not meaning: a reversed claim still passes. Returns issues and a pass/fail verdict.",
    "parameters": {
        "type": "object",
        "properties": {
            "translated": {"type": "string", "description": "Plain-text Spanish translation (<= 100000 chars)."},
            "source": {"type": "string", "description": "Original source text (required for semantic QA)."},
            "dialect": {"type": "string"},
        },
        "required": ["translated", "source"],
    },
}
LIST_SCHEMA = {
    "name": "dialectos_list_dialects",
    "description": "List the 25 Spanish dialect variants DialectOS supports.",
    "parameters": {"type": "object", "properties": {}},
}
LEARN_SCHEMA = {
    "name": "dialectos_learn",
    "description": "Offline regional Spanish learning: daily comparisons, a casual quiz, private Leitner progress. Never stores your text or answers. Read-only actions work on gateway platforms; answer/forget need a local session. Forget requires confirm=true.",
    "parameters": {
        "type": "object",
        "properties": {
            "action": {"type": "string", "enum": ["tip", "quiz", "answer", "stats", "cards", "forget"]},
            "dialect": {"type": "string", "description": "Target variant; defaults to your configured dialect."},
            "concept": {"type": "string", "description": "Quiz concept id for answer; optional specific comparison for tip."},
            "answer": {"type": "string", "maxLength": 500, "description": "Typed quiz answer, never saved."},
            "confirm": {"type": "boolean", "description": "Explicit confirmation required to forget this variant's cards."},
            "offset": {"type": "integer", "minimum": 0, "description": "Cards page offset (20 per page)."},
        },
        "required": ["action"],
        "additionalProperties": False,
    },
}
SHOW_SCHEMA = {
    "name": "dialectos_show",
    "description": "Ask the open Desktop page to show a section and optionally focus a dialect. The page must be enabled.",
    "parameters": {
        "type": "object",
        "properties": {
            "view": {"type": "string", "enum": list(PANE_VIEWS), "maxLength": 10,
                     "description": "translate = Translate or detect; check = Check a translation; dialects = Variants; by_dialect = Checks by dialect; recent = Recent."},
            "item_id": {"type": "string", "minLength": 5, "maxLength": 5, "pattern": "^es-[A-Z]{2}$",
                        "description": "Optional dialect code to select or focus, e.g. es-AR."},
        },
        "required": ["view"],
        "additionalProperties": False,
    },
}


def _wrap(fn):
    def handler(args: Optional[Dict[str, Any]] = None, **_: Any) -> str:
        try:
            out = fn(args or {})
        except ValueError as exc:
            out = {"ok": False, "error": str(exc)}
        except Exception as exc:  # never crash the agent loop
            logger.debug("dialectos tool failed", exc_info=True)
            out = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
        raw = json.dumps(out, ensure_ascii=False)
        if len(raw) <= TOOL_JSON_MAX:
            return raw
        # Never slice a JSON envelope mid-string — return a valid truncated marker instead.
        return json.dumps({
            "ok": False,
            "truncated": True,
            "error": f"result exceeds {TOOL_JSON_MAX} chars ({len(raw)}); use the DialectOS CLI for large docs",
        }, ensure_ascii=False)
    return handler


_tool_translate = _wrap(lambda a: translate(a.get("text"), a.get("dialect"), a.get("formal"), a.get("provider")))
_tool_detect = _wrap(lambda a: detect(a.get("text")))
_tool_validate = _wrap(lambda a: validate(a.get("translated"), a.get("dialect"), a.get("source")))
_tool_list = _wrap(lambda a: list_dialects())
_tool_learn = _wrap(lambda a: learn(a.get("action"), a.get("dialect"), a.get("concept"),
                                   a.get("answer"), a.get("confirm", False), a.get("offset", 0)))
_tool_show = _wrap(show)


# --- slash ------------------------------------------------------------------

_SAFE_SLASH = {"detect", "list", "translate", "validate", "status", "help", "learn", "quiz", "tip", "answer"}
_HELP = (
    "Usage:\n"
    "  /dialectos detect <spanish text>                         Which dialect is this?\n"
    "  /dialectos list                                          25 supported variants\n"
    "  /dialectos translate <es-XX> <english text>              Translate (network provider; CLI/TUI only by default)\n"
    "  /dialectos validate <es-XX> <source> :: <spanish text>   Offline plain-text QA (source required)\n"
    "  /dialectos status                                        Last QA ledger entries\n"
    "  /dialectos learn [tip|quiz|stats|cards] [es-XX]          Learn offline, at your pace\n"
    "  /dialectos tip [es-XX] [concept]                       Compare regional terms\n"
    "  /dialectos quiz [es-XX]                                One question\n"
    "  /dialectos answer <es-XX> <concept> <typed answer>      Review a quiz card\n"
    "  /dialectos learn forget <es-XX> --confirm              Delete that variant's cards (local only)\n"
    "No file paths, serve, corpus export or benchmark from slash. Code blocks must match the source. Register is advisory.\n"
    + PANE_GUIDANCE
)


def _fmt(res: Dict[str, Any]) -> str:
    if not res.get("ok") and "data" not in res:
        return f"DialectOS failed: {res.get('error') or res.get('stderr') or res}"
    if res.get("truncated"):
        return f"DialectOS result truncated: {res.get('error') or 'output too large for this surface'}"
    if "data" in res:
        body = json.dumps(res["data"], indent=2, ensure_ascii=False)
    else:
        body = str(res.get("text", ""))
    if len(body) <= SLASH_DISPLAY:
        return body
    return (
        f"DialectOS result is {len(body)} chars — too large to paste completely into slash "
        f"(limit {SLASH_DISPLAY}). Truncated display refused so a partial translation is not "
        f"presented as complete. Use the dialectos_* agent tool or the DialectOS CLI."
    )


def _slash(raw_args: str) -> str:
    raw = (raw_args or "").strip()
    if not raw:
        return _HELP
    cmd, _, rest = raw.partition(" ")
    cmd = cmd.lower()
    rest = rest.strip()
    if cmd in {"help", "-h", "--help"}:
        return _HELP
    if cmd not in _SAFE_SLASH:
        return f"Unknown or blocked subcommand `{cmd}`. Allowed: {', '.join(sorted(_SAFE_SLASH))}."
    try:
        if cmd in {"learn", "quiz", "tip", "answer"}:
            parts = rest.split()
            action = cmd
            if cmd == "learn":
                action = parts.pop(0) if parts and not parts[0].startswith("es-") else "tip"
            d = parts.pop(0) if parts and parts[0].startswith("es-") else None
            concept = None
            typed = None
            confirm = False
            if action == "answer":
                if not d or len(parts) < 2:
                    raise ValueError("Usage: /dialectos answer <es-XX> <concept> <typed answer>")
                concept, typed = parts[0], " ".join(parts[1:])
            elif action == "tip":
                if len(parts) > 1:
                    raise ValueError("Usage: /dialectos tip [es-XX] [concept]")
                concept = parts[0] if parts else None
            elif action == "forget":
                if parts not in ([], ["--confirm"]):
                    raise ValueError("forget accepts only an explicit --confirm flag")
                confirm = parts == ["--confirm"]
            elif parts:
                raise ValueError("Unexpected Learn arguments; see /dialectos help.")
            return _fmt(learn(action, d, concept, typed, confirm))
        if cmd == "list":
            res = list_dialects()
            if res.get("ok") and isinstance(res.get("data"), list):
                return _fmt({"ok": True, "text": "\n".join(
                    f"{d['code']} — {d['name']}" for d in res["data"]
                )})
            return _fmt(res)
        if cmd == "status":
            ledger = _load_json(_ledger_path(), [])
            return json.dumps({"recent": ledger[-10:] if isinstance(ledger, list) else [], "desktop": PANE_GUIDANCE}, indent=2)
        if cmd == "detect":
            return _fmt(detect(rest))
        dialect, _, text = rest.partition(" ")
        if cmd == "validate":
            if " :: " not in text:
                return (
                    "validate requires the original source text: "
                    "`/dialectos validate <es-XX> <source> :: <translated>`.\n\n" + _HELP
                )
            # Code such as `a :: b` usually survives translation, so the source and the
            # translation hold the same number of separators: split at the middle one.
            parts = text.split(" :: ")
            mid = len(parts) // 2
            source, translated = " :: ".join(parts[:mid]), " :: ".join(parts[mid:])
            res = validate(translated.strip(), dialect, source.strip())
            _on_post_tool("dialectos_validate", {"dialect": dialect}, res)  # same ledger as the tool
            return _fmt(res)
        if cmd == "translate":
            if _on_gateway() and not _cfg("allow_translate_slash_on_gateway"):
                return ("/dialectos translate is disabled on gateway platforms (sends text to a network "
                        "provider). Ask the agent instead, or set allow_translate_slash_on_gateway: true.")
            return _fmt(translate(text, dialect))
    except ValueError as exc:
        return f"{exc}\n\n{_HELP}"
    return _HELP


# --- register ---------------------------------------------------------------

def register(ctx) -> None:
    global _ctx
    _ctx = ctx
    ctx.register_hook("pre_llm_call", _on_pre_llm)
    ctx.register_hook("post_tool_call", _on_post_tool)
    ctx.register_command(
        "dialectos",
        handler=_slash,
        description="DialectOS regional Spanish and offline Learn (tip/quiz/answer).",
        args_hint="detect <text> | list | translate <es-XX> <text> | validate <es-XX> <source> :: <text> | learn | quiz | tip | answer",
    )
    for schema, handler, emoji in (
        (TRANSLATE_SCHEMA, _tool_translate, "🌎"),
        (DETECT_SCHEMA, _tool_detect, "🔎"),
        (VALIDATE_SCHEMA, _tool_validate, "✅"),
        (LIST_SCHEMA, _tool_list, "📋"),
        (LEARN_SCHEMA, _tool_learn, "📖"),
        (SHOW_SCHEMA, _tool_show, "🧭"),
    ):
        ctx.register_tool(
            name=schema["name"],
            toolset="dialectos",
            schema=schema,
            handler=handler,
            description=schema["description"],
            emoji=emoji,
        )
    skills_dir = Path(__file__).parent / "skills"
    if skills_dir.is_dir():
        for child in sorted(skills_dir.iterdir()):
            skill_md = child / "SKILL.md"
            if child.is_dir() and skill_md.exists():
                try:
                    ctx.register_skill(child.name, skill_md)
                except Exception:
                    logger.debug("dialectos: register_skill failed for %s", child.name, exc_info=True)
