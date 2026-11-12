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

import hashlib
import json
import logging
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.request
from collections import deque
from contextlib import contextmanager
from decimal import Decimal
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
    "kilogram": ("kg", "kilogram", "kilograms", "kilogramo", "kilogramos", "kilo", "kilos"),
    "millisecond": ("ms", "millisecond", "milliseconds", "milisegundo", "milisegundos"),
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
    "day": ("d", "day", "days", "día", "días", "jornada", "jornadas"),
    "byte": ("b", "byte", "bytes"),
    "kilobyte": ("kb", "kilobyte", "kilobytes"),
    "megabyte": ("mb", "megabyte", "megabytes"),
    "gigabyte": ("gb", "gigabyte", "gigabytes", "giga", "gigas"),
    "terabyte": ("tb", "terabyte", "terabytes"),
    "international_unit": ("iu", "international unit", "international units", "ui", "unidad internacional", "unidades internacionales"),
    "tablet": ("tab", "tabs", "tablet", "tablets", "tableta", "tabletas", "comprimido", "comprimidos"),
    "frame_rate": ("fps",),
    "volt": ("v", "volt", "volts", "voltio", "voltios"),
    "hertz": ("hz", "hertz"),
    "gigahertz": ("ghz", "gigahertz"),
    "watt": ("w", "watt", "watts", "vatio", "vatios"),
    "pound": ("lb", "lbs", "pound", "pounds", "libra", "libras"),
    "ounce": ("oz", "ounce", "ounces", "onza", "onzas"),
    "celsius": ("°c", "ºc", "degc", "c", "degree celsius", "degrees celsius", "grado centígrado", "grados centígrados", "grado", "grados"),
    "fahrenheit": ("°f", "degf"),
}
_UNIT_CANONICAL = {alias.casefold(): name for name, aliases in _UNIT_GROUPS.items() for alias in aliases}
_UNIT_PATTERN = "|".join(
    re.escape(alias) for alias in sorted(_UNIT_CANONICAL, key=len, reverse=True))
_DOSE_UNIT_ALIASES = {
    alias for name in ("microgram", "milligram", "gram", "kilogram", "milliliter", "liter",
                       "international_unit", "tablet")
    for alias in _UNIT_GROUPS[name]
} | {"unit", "units", "drop", "drops", "puff", "puffs", "gota", "gotas",
     "inhalación", "inhalaciones", "unidad", "unidades"}
_DOSE_UNIT_PATTERN = "|".join(
    re.escape(alias) for alias in sorted(_DOSE_UNIT_ALIASES, key=len, reverse=True))
_TIME_UNIT_FACTORS = {
    "millisecond": Decimal("0.001"), "second": Decimal(1),
    "minute": Decimal(60), "hour": Decimal(3600), "day": Decimal(86400),
}
_TIME_UNIT_WORDS = {
    alias for name in _TIME_UNIT_FACTORS for alias in _UNIT_GROUPS[name]
}
_LENGTH_UNIT_FACTORS = {
    "micrometer": Decimal("0.000001"), "millimeter": Decimal("0.001"),
    "centimeter": Decimal("0.01"), "meter": Decimal(1),
    "kilometer": Decimal(1000), "mile": Decimal("1609.344"),
}
_CONVERTIBLE_UNIT_FACTORS = {**_TIME_UNIT_FACTORS, **_LENGTH_UNIT_FACTORS}
_NUM_CORE = r"[+\-−]?\d+(?:[.,   ]\d{3})*(?:[.,]\d+)?"
_NUM_RE = re.compile(
    rf"(?:(?<![\w.,])|(?<=\bv)|(?<=USD)|(?<=EUR)|(?<=GBP)){_NUM_CORE}(?:st|nd|rd|th|s|x)?"
    rf"(?:(?![\w])|(?=(?:{_UNIT_PATTERN}|[A-Za-z]{{1,4}})(?![A-Za-z])))",
    re.IGNORECASE,
)
_ATTACHED_UNIT_RE = re.compile(
    rf"(?:(?<![\w.,])|(?<=\bv))(?P<number>{_NUM_CORE})\s*(?P<unit>{_UNIT_PATTERN})(?!\w)",
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
    r"\bat\s+(?P<h>[01]?\d|2[0-3])\s*h(?:ours?)?(?!\w)", re.I)
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
    r"(?<!\w)(?:(?:son\s+las?)|(?:(?:a|hasta|desde|de|para|sobre)\s+las?)|"
    r"(?:antes|después)\s+de\s+las?)\s+"
    r"(?P<h>una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s+"
    r"de\s+la\s+(?P<period>mañana|madrugada|tarde|noche)(?!\w)", re.IGNORECASE)
_TIME_ES_WORD_HOUR_RE = re.compile(
    r"(?<!\w)(?:(?P<verb>son)\s+las?|(?P<prep>(?:(?:a|hasta|desde|de|para|sobre)\s+|"
    r"(?:antes|después)\s+de\s+)?)las?)\s+"
    r"(?P<h>una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)(?!\w)",
    re.IGNORECASE)
_TIME_EN_WORD_HOUR_RE = re.compile(
    r"\b(?P<cue>at|until|from|before|after|by|around)\s+"
    r"(?P<h>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?!\w)",
    re.IGNORECASE)
_TIME_EN_WORD_RANGE_RE = re.compile(
    r"\bfrom\s+(?P<start>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
    r"\s+to\s+(?P<end>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b",
    re.IGNORECASE)
_TIME_ES_WORD_RANGE_RE = re.compile(
    r"\b(?:de|desde|entre)\s+(?:(?:las?|los)\s+)?"
    r"(?P<start>una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)"
    r"\s+(?:a|hasta|y)\s+(?:(?:las?|los)\s+)?"
    r"(?P<end>una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b",
    re.IGNORECASE)
_TIME_EN_OCLOCK_RE = re.compile(
    r"(?<!\d)(?P<h>1[0-2]|0?[1-9])\s+o'clock\b", re.IGNORECASE)
_TIME_ES_DIGIT_WORD_HOUR_RE = re.compile(
    r"(?<!\w)(?:(?P<verb>son)\s+las?|(?P<prep>(?:(?:a|hasta|desde|de|para|sobre)\s+|"
    r"(?:antes|después)\s+de\s+)las?))\s+(?P<h>[01]?\d|2[0-3])(?!\d)",
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
    "eighty", "ninety", "hundred", "thousand", "million", "billion", "trillion",
    "once", "twice", "dozen",
})
_EN_ORDINAL_WORDS = frozenset(word for ordinal in _EN_ORDINALS.values() for word in ordinal.split())
_ROMAN_CENTURY_RE = re.compile(
    r"\bsiglo\s+(?P<roman>M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})"
    r"(?:IX|IV|V?I{0,3}))\b", re.IGNORECASE)
_ES_HUNDREDS_WORDS = frozenset(
    "doscientos doscientas trescientos trescientas cuatrocientos cuatrocientas "
    "quinientos quinientas seiscientos seiscientas setecientos setecientas "
    "ochocientos ochocientas novecientos novecientas".split())
_ES_NUMBER_WORDS = frozenset(w for forms in _ES_SPELLED.values() for f in forms for w in f.split()) | {
    "mil", *_ES_HUNDREDS_WORDS
}
_ES_ORDINAL_WORDS = frozenset(w for forms in _ES_ORDINALS.values() for f in forms for w in f.split())
_MIN_WORDS_FOR_LANG = 6


def _en_number_forms(number: int) -> Tuple[str, ...]:
    if number == 1000:
        return _EN_SPELLED["1000"]
    if number < 1000:
        return _EN_SPELLED.get(str(number), ())
    if number >= 1_000_000_000_000:
        return ()
    remainder = number
    parts = []
    for scale, name in ((1_000_000_000, "billion"), (1_000_000, "million"), (1000, "thousand")):
        amount, remainder = divmod(remainder, scale)
        if amount:
            parts.append(f"{_en_under_1000(amount)} {name}")
    if remainder:
        parts.append(_en_under_1000(remainder))
    prefix = " ".join(parts)
    if not prefix:
        return ()
    forms = [prefix]
    if len(parts) > 1 and remainder:
        forms.append(" ".join(parts[:-1]) + " and " + parts[-1])
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
            masculine = ("", "", "doscientos", "trescientos", "cuatrocientos", "quinientos",
                         "seiscientos", "setecientos", "ochocientos", "novecientos")[hundreds]
            feminine = ("", "", "doscientas", "trescientas", "cuatrocientas", "quinientas",
                        "seiscientas", "setecientas", "ochocientas", "novecientas")[hundreds]
            prefixes = (masculine, feminine)
        if hundreds == 1:
            prefixes = (prefix,)
        return prefixes if not remainder else tuple(
            f"{prefix} {form}" for prefix in prefixes for form in _es_cardinal_forms(remainder))
    thousands, remainder = divmod(number, 1000)
    prefix = "mil" if thousands == 1 else f"{_es_cardinal_forms(thousands)[0]} mil"
    return (prefix,) if not remainder else tuple(
        f"{prefix} {form}" for form in _es_cardinal_forms(remainder))


_ES_CARDINAL_VALUE = {}
for _number in range(1000):
    for _form in _es_cardinal_forms(_number):
        if _form not in _ES_ORDINAL_WORDS:
            _ES_CARDINAL_VALUE[re.sub(r"\s+", " ", _form.casefold())] = _number
_ES_CARDINAL_PATTERN = "|".join(
    re.escape(form) for form in sorted(_ES_CARDINAL_VALUE, key=len, reverse=True))
_ES_CARDINAL_NUMBER_PATTERN = (
    rf"(?:(?:mil|(?:{_ES_CARDINAL_PATTERN})\s+mil)"
    rf"(?:\s+(?:{_ES_CARDINAL_PATTERN}))?|(?:{_ES_CARDINAL_PATTERN}))")
_ES_SCALE_WORD_PATTERN = r"(?:mil\s+mill[oó]n(?:es)?|mill[oó]n(?:es)?|bill[oó]n(?:es)?|trill[oó]n(?:es)?)"
_ES_CARDINAL_QUANTITY_PATTERN = (
    rf"{_ES_CARDINAL_NUMBER_PATTERN}(?:\s+{_ES_SCALE_WORD_PATTERN})?")
_ES_CARDINAL_RE = re.compile(
    rf"(?<!\w)(?P<number>{_ES_CARDINAL_QUANTITY_PATTERN})(?!\w)", re.IGNORECASE)
_ES_SCALE_TOKEN_RE = re.compile(
    r"(?<!\w)(?P<scale>mil|mill[oó]n(?:es)?|bill[oó]n(?:es)?|trill[oó]n(?:es)?)(?!\w)",
    re.IGNORECASE)
_ES_CARDINAL_UNIT_RE = re.compile(
    rf"(?<!\w)(?P<number>{_ES_CARDINAL_QUANTITY_PATTERN})\s+(?:de\s+)?"
    rf"(?P<unit>{_UNIT_PATTERN})(?!\w)", re.IGNORECASE)
_ES_CARDINAL_WORDS = {word for form in _ES_CARDINAL_VALUE for word in form.split()}
_UNIT_WORDS = {word for alias in _UNIT_CANONICAL for word in re.findall(r"[a-záéíóúüñ]+", alias)}
_EN_CARDINAL_FORM_VALUES = {}
for _cardinal, _forms in _EN_SPELLED.items():
    if int(_cardinal) <= 999:
        for _form in _forms:
            if _form not in {"once", "twice"}:
                _EN_CARDINAL_FORM_VALUES[_form.replace("-", " ").casefold()] = int(_cardinal)
_EN_CARDINAL_ATOM_VALUES = {
    word: value for phrase, value in _EN_CARDINAL_FORM_VALUES.items()
    if len(phrase.split()) == 1 for word in (phrase,)
}
_EN_ORDINAL_WORD_VALUES = {
    form.replace("-", " ").casefold(): number
    for number, form in _EN_ORDINALS.items()
}
_EN_CARDINAL_SCAN_WORDS = frozenset(
    (_EN_NUMBER_WORDS - {"once", "twice"}) | {"and", "a", "an"}
    | {word for form in _EN_ORDINAL_WORD_VALUES for word in form.split()}
)
_EN_SCALE_VALUES = {
    "hundred": 100, "thousand": 1_000, "million": 1_000_000,
    "billion": 1_000_000_000, "trillion": 1_000_000_000_000,
}
_SPELLABLE_COUNT_UNITS = _UNIT_WORDS | _DOSE_UNIT_ALIASES | {
    "pill", "pills", "capsule", "capsules", "dose", "doses",
}


def _english_cardinal_value(phrase: str) -> int | None:
    normalized = re.sub(r"[-\s]+", " ", phrase.casefold()).strip()
    if normalized in _EN_CARDINAL_FORM_VALUES:
        return _EN_CARDINAL_FORM_VALUES[normalized]
    tokens = normalized.split()
    if not tokens:
        return None
    if len(tokens) > 1 and tokens[-1] in _EN_ORDINAL_WORD_VALUES:
        prefix = tokens[:-1]
        if prefix and prefix[-1] == "and":
            prefix.pop()
        base = _english_cardinal_value(" ".join(prefix))
        if base is not None and (
            any(token in _EN_SCALE_VALUES for token in prefix)
            or len(prefix) == 1 and prefix[0] in {
                "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"
            }
        ):
            return base + _EN_ORDINAL_WORD_VALUES[tokens[-1]]
    if any(
        token == "and" and (index == 0 or tokens[index - 1] not in _EN_SCALE_VALUES)
        for index, token in enumerate(tokens)
    ):
        return None
    total = current = 0
    for index, token in enumerate(tokens):
        if token in _EN_SCALE_VALUES:
            scale = _EN_SCALE_VALUES[token]
            if scale == 100:
                current = max(1, current) * scale
            else:
                total += max(1, current) * scale
                current = 0
        elif token in _EN_CARDINAL_ATOM_VALUES:
            current += _EN_CARDINAL_ATOM_VALUES[token]
        elif token in {"a", "an"} and index + 1 < len(tokens) and tokens[index + 1] in _EN_SCALE_VALUES:
            current += 1
        elif token == "and":
            continue
        else:
            return None
    return total + current


def _english_spelled_numbers(text: str):
    tokens = list(_WORD_RE.finditer(text))
    numeric_spans = []
    for match in _NUM_RE.finditer(text):
        end = match.end()
        scale = re.match(
            r"\s+(?:thousand|million|billion|trillion)(?!\w)", text[end:], re.IGNORECASE
        )
        if scale:
            end += scale.end()
        numeric_spans.append((match.start(), end))
    normalized = " " + re.sub(r"[^\w]+", " ", text.casefold()) + " "
    values = []
    index = 0
    while index < len(tokens):
        current = tokens[index].group(0).casefold()
        if current in _EN_ORDINAL_WORD_VALUES:
            previous = tokens[index - 1].group(0).casefold() if index else ""
            ordinal_value = _EN_ORDINAL_WORD_VALUES[current]
            ordinal_suffix = "st" if ordinal_value % 10 == 1 and ordinal_value % 100 != 11 else (
                "nd" if ordinal_value % 10 == 2 and ordinal_value % 100 != 12 else (
                    "rd" if ordinal_value % 10 == 3 and ordinal_value % 100 != 13 else "th"
                )
            )
            span = _number_phrase_span(current, normalized, "en", ordinal=True)
            if span is not None and previous in {
                "the", "my", "our", "his", "her", "their", "its", "this", "that"
            } and not (current == "second" and previous in {"a", "one"}):
                values.append((f"{ordinal_value}{ordinal_suffix}", frozenset({str(ordinal_value)})))
                index += 1
                continue
        if current not in _EN_CARDINAL_SCAN_WORDS:
            index += 1
            continue
        end = index
        while end + 1 < len(tokens):
            gap = text[tokens[end].end():tokens[end + 1].start()]
            if (not re.fullmatch(r"[\s-]+", gap)
                    or tokens[end + 1].group(0).casefold() not in _EN_CARDINAL_SCAN_WORDS):
                break
            end += 1
        phrase = text[tokens[index].start():tokens[end].end()]
        amount = _english_cardinal_value(phrase)
        next_word = tokens[end + 1].group(0).casefold() if end + 1 < len(tokens) else ""
        has_scale = bool(set(phrase.casefold().replace("-", " ").split()) & _EN_SCALE_VALUES.keys())
        has_unit = next_word in _SPELLABLE_COUNT_UNITS
        has_ordinal = tokens[end].group(0).casefold() in _EN_ORDINAL_WORD_VALUES
        span = _number_phrase_span(phrase, normalized, "en", ordinal=has_ordinal)
        if (amount is not None and (has_scale or has_unit) and span is not None
                and not any(span[0] < stop and start < span[1] for start, stop in numeric_spans)):
            values.append((phrase, frozenset({str(amount)})))
            index = end + 1
            continue
        index += 1
    return values


def _es_cardinal_value(number: str):
    phrase = re.sub(r"\s+", " ", number.casefold()).strip()
    phrase = re.sub(r"\b(mil)\s+y\s+", r"\1 ", phrase)
    scale_match = re.fullmatch(
        r"(.+?)\s+(mill[oó]n(?:es)?|bill[oó]n(?:es)?|trill[oó]n(?:es)?)", phrase)
    if scale_match:
        amount = _es_cardinal_value(scale_match.group(1))
        if amount is None:
            return None
        scale = scale_match.group(2)
        factor = 1_000_000
        if scale.startswith("bill"):
            factor = 1_000_000_000_000
        elif scale.startswith("trill"):
            factor = 1_000_000_000_000_000_000
        return amount * factor
    direct = _ES_CARDINAL_VALUE.get(phrase)
    if direct is not None:
        return direct
    if phrase == "mil":
        return 1000
    if phrase.startswith("mil "):
        remainder = _ES_CARDINAL_VALUE.get(phrase[4:].strip())
        return 1000 + remainder if remainder is not None else None
    if " mil" not in phrase:
        return None
    thousands_form, remainder_form = phrase.split(" mil", 1)
    thousands = _ES_CARDINAL_VALUE.get(thousands_form.strip(), 1 if not thousands_form else None)
    remainder = _ES_CARDINAL_VALUE.get(remainder_form.strip(), 0 if not remainder_form else None)
    if thousands is None or remainder is None:
        return None
    return thousands * 1000 + remainder


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
                ordinal_words = _EN_NUMBER_WORDS | _EN_ORDINAL_WORDS
                if previous in ordinal_words or following in ordinal_words:
                    continue
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
_TIME_COUNT_NOUNS = frozenset(_ARTICLE_UNITS | {
    "people", "person", "persons", "supplier", "suppliers", "user", "users",
    "child", "children", "page", "pages", "option", "options", "percent",
    "percentage", "point", "points", "class", "classes", "session", "sessions",
    "show", "shows", "shift", "shifts", "side", "sides", "meeting", "meetings",
    "appointment", "appointments", "lecture", "lectures", "lesson", "lessons",
    "vote", "votes", "witness", "witnesses", "location", "locations", "attempt",
    "attempts", "example", "examples", "winner", "winners", "ganadora", "ganadoras",
    "rule", "rules", "regla", "reglas", "color", "colors", "colour", "colours",
    "meal", "meals", "student", "students", "key", "keys", "clave", "claves",
    "año", "años",
    "hora", "horas", "minuto", "minutos", "segundo", "segundos",
    "día", "días", "semana", "semanas", "mes", "meses", "década",
    "décadas", "siglo", "siglos", "gramo", "gramos", "kilogramo",
    "kilogramos", "miligramo", "miligramos", "litro", "litros", "mililitro",
    "mililitros", "metro", "metros", "kilómetro", "kilómetros", "centímetro",
    "centímetros", "pulgada", "pulgadas", "pie", "pies", "libra", "libras",
    "onza", "onzas", "taza", "tazas", "cucharadita", "cucharaditas",
    "cucharada", "cucharadas", "pastilla", "pastillas", "tableta", "tabletas",
    "comprimido", "comprimidos", "cápsula", "cápsulas", "gota", "gotas", "dosis",
    "proveedor", "proveedores", "persona", "personas", "usuario", "usuarios",
    "página", "páginas", "niño", "niños", "niña", "niñas",
})


def _spelled_span(form: str, normalized: str, ordinal: bool = False):
    phrase = re.sub(r"[^\w]+", " ", form.casefold()).strip()
    if phrase in ("doble", "triple"):
        return _number_phrase_span(phrase, normalized, "es")
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


def _ordinal_source_context(source: str):
    month = (
        r"January|February|March|April|May|June|July|August|September|October|November|December"
    )
    contexts = re.compile(
        rf"\b(?:{month})\b[^.!?;:]*\b(?P<number>\d{{1,6}})(?:st|nd|rd|th)\b|"
        rf"\b(?P<before_month>\d{{1,6}})(?:st|nd|rd|th)\s+of\s+(?:{month})\b|"
        r"\b(?P<century>\d{1,6})(?:st|nd|rd|th)\b[^.!?;:]*\bcentur(?:y|ies)\b",
        re.IGNORECASE,
    )
    return frozenset(
        value for match in contexts.finditer(source)
        for value in (match.group("number"), match.group("before_month"), match.group("century"))
        if value is not None
    )


def _ordinal_cardinal_alias_allowed(label: str, source: str, source_context=None) -> bool:
    number_match = re.fullmatch(r"(\d+)(?:st|nd|rd|th)", label, re.IGNORECASE)
    if not number_match:
        return False
    number = number_match.group(1)
    if len(number) > 6:
        return False
    if int(number) >= 11:
        return True
    context = source_context if source_context is not None else _ordinal_source_context(source)
    return number in context


def _ordinal_cardinal_translation_alias_allowed(label: str, translated: str, translation_context=None) -> bool:
    number_match = re.fullmatch(r"(\d+)(?:st|nd|rd|th)", label, re.IGNORECASE)
    if not number_match or len(number_match.group(1)) > 6:
        return False
    number = str(int(number_match.group(1)))
    context = translation_context if translation_context is not None else _ordinal_translation_context(translated)
    return number in context


def _ordinal_translation_context(translated: str):
    context = set()
    for match in re.finditer(
        rf"(?<!\w)(?P<noun>{_WORD_RE.pattern})\s+(?P<number>\d{{1,6}})(?!\d)",
        translated,
        re.IGNORECASE,
    ):
        noun = match.group("noun").casefold()
        if noun == "número" or noun not in _ES_WORDS:
            context.add(str(int(match.group("number"))))
    return frozenset(context)


def _english_ordinal_in_translation(
    form: str, normalized_src: str, normalized_dst: str, number: int
):
    span = _spelled_span(form, normalized_src, ordinal=True)
    if span is None:
        return None
    before = normalized_src[:span[0]].rstrip().split()
    after = normalized_src[span[1]:].lstrip().split()
    if form.casefold() == "second" and before and before[-1] in {"a", "one"}:
        temporal_continuation = {
            "before", "after", "later", "ago", "more", "longer", "for", "until",
            "to", "of", "is", "was", "will", "can", "should",
        }
        temporal_verb = bool(set(before[-3:-1]) & {"wait", "pause", "hold", "stop", "rest"})
        if temporal_verb or not after or after[0] in temporal_continuation:
            return None
    if form.casefold() == "third" and before and before[-1] in {"a", "one"} and (
        after and after[0] == "of"
    ):
        return None
    if form.casefold() == "second" and before and before[-1] == "on" and after and after[0] == "thought":
        return None
    if not after or after[0] in {"ago", "later", "more", "longer"}:
        return None
    translated_readings = {value for _, readings in _numbers(normalized_dst) for value in readings}
    if str(number) not in translated_readings:
        return None
    words = normalized_dst.split()
    stop_words = _ES_WORDS | {"er", "o", "a"}
    return span if any(
        word not in stop_words and word.isalpha() and 0 < abs(noun_index - number_index) <= 3
        for noun_index, word in enumerate(words)
        for number_index, value in enumerate(words)
        if value == str(number)
    ) or (after[0] == "century" and _ROMAN_CENTURY_RE.search(normalized_dst)) else None
_MIN_CHARS_FOR_LENGTH = 80
_SHORT_RATIO = 0.5


def _prose(text: str) -> str:
    return _INLINE_CODE_RE.sub(" ", _FENCE_RE.sub(" ", text))


_VERSION_CUE_RE = re.compile(r"(?:\bv|\bversi[oó]n|\brelease|\bbuild|\brev)\.?\s*$", re.I)
_MONEY_AMOUNT_CUE_RE = re.compile(
    r"(?:[$€£]\s*$|\b(?:usd|eur|gbp)\s*$|\b(?:budget|presupuesto|cost|costs|coste|costo|"
    r"price|priced|precio|raised|recaud\w*|revenue|ingres\w*|salary|salario|funding|fondos|"
    r"spend|spent|pay|paid|pag\w*|cuest\w*|worth)\b[^.!?;:]{0,24}$)", re.IGNORECASE)


def _money_amount_context(text: str, start: int, unit: str = "", tail: str = "") -> bool:
    before = text[max(0, start - 40):start].rstrip()
    if before.endswith(":"):
        before = before[:-1].rstrip()
    explicit_currency = bool(re.search(r"[$€£]\s*$|\b(?:usd|eur|gbp)\s*$", before, re.IGNORECASE))
    if unit.casefold().strip() == "m" and re.match(
        r"\s+(?:de|of)\s+(?!d[oó]lares?|euros?|pesos?|libras?|yen(?:es)?|francos?)\w+",
        tail, re.IGNORECASE,
    ):
        return False
    if explicit_currency:
        return True
    cue = _MONEY_AMOUNT_CUE_RE.search(before)
    if cue is None:
        return False
    cue_word = re.search(
        r"\b(?:budget|presupuesto|cost|costs|coste|costo|price|priced|precio|raised|"
        r"recaud\w*|revenue|ingres\w*|salary|salario|funding|fondos|spend|spent|pay|paid|"
        r"pag\w*|cuest\w*|worth)\b",
        cue.group(0), re.IGNORECASE,
    )
    trailing = before[cue.start() + cue_word.end():] if cue_word else ""
    if re.search(r"\d|[$€£]|\b(?:and|but)\b", trailing, re.IGNORECASE):
        return False
    return not (
        unit.casefold().strip() in {"m", "b"}
        and re.search(r"\b(?:paid|pay|spend|spent)\s+for\s*$", before, re.IGNORECASE)
    )


def _plain_numeric_readings(number: str, source: bool = False):
    raw = number.replace(" ", "").replace(" ", "").replace(" ", "")
    sign = "-" if raw.startswith(("-", "−")) else ""
    raw = raw.lstrip("+-−")
    separators = [index for index, char in enumerate(raw) if char in ",."]

    def value(decimal_at):
        if decimal_at is None:
            digits = re.sub(r"[,.]", "", raw)
            return sign + (digits[1:] if len(digits) == 2 and digits[0] == "0" else digits)
        integer = re.sub(r"[,.]", "", raw[:decimal_at])
        fraction = raw[decimal_at + 1:].rstrip("0")
        return sign + integer + ("." + fraction if fraction else "")

    if "," in raw and "." in raw:
        return frozenset({value(max(separators))})
    if len(separators) == 1:
        at = separators[0]
        if len(raw) - at - 1 != 3 or raw[:at] == "0":
            return frozenset({value(at)})
        if source:
            return frozenset({value(at if raw[at] == "." else None)})
        return frozenset({value(at), value(None)})
    return frozenset({value(None)})


def _numbers(text: str, source: bool = False) -> List[Tuple[str, frozenset]]:
    """Each number as (text, readings), ignoring separator style (1,000.5 == 1.000,5).

    "1.125" is a decimal in English and 1125 in Spain, so a translated "1.125" or "1,125"
    keeps both readings. The source is read the English way ("." decimal, "," grouping), so
    "1.125 euros" -> "1125 euros" no longer passes. Insignificant fraction zeros are dropped
    (1.5 == 1,50) except after a version cue, where 2.10 never matches 2.1."""
    numbers = []
    scrubbed = _URL_RE.sub(" ", text)
    for match in _NUM_RE.finditer(scrubbed):
        if any(
            cadence.start() <= match.start() and match.end() <= cadence.end()
            for cadence in _FREQUENCY_HOURS_RE.finditer(scrubbed)
        ):
            continue
        raw = match.group(0).replace(" ", "").replace(" ", "").replace(" ", "")
        is_decade = bool(re.fullmatch(r"(?:19|20)\d{2}s", raw, re.IGNORECASE))
        short_decade = bool(re.fullmatch(r"\d{2}s", raw, re.IGNORECASE))
        is_multiplier = raw.lower().endswith("x")
        if is_multiplier:
            raw = raw[:-1]
        raw = raw[:-1] if is_decade or short_decade else re.sub(r"(?:st|nd|rd|th|s)$", "", raw, flags=re.I)
        sign = "-" if raw.startswith(("-", "−")) else ""
        raw = raw.lstrip("+-−")
        is_version = bool(_VERSION_CUE_RE.search(scrubbed[max(0, match.start() - 24):match.start()]))
        multiplier = re.match(
            r"(?P<unit>m(?:€|eur)|k(?![A-Za-z])|m(?![A-Za-z])|b(?![A-Za-z])|"
            r"\s+(?:m(?:€|eur)?(?![A-Za-z])|b(?![A-Za-z])|thousand|million|billion|trillion|mil\s+millones?|"
            r"mil|mill[oó]n(?:es)?|bill[oó]n(?:es)?|trill[oó]n(?:es)?)(?!\w))",
            scrubbed[match.end():], re.IGNORECASE)
        multiplier_unit = multiplier.group("unit").strip().casefold() if multiplier else ""
        scale_tail = scrubbed[match.end() + len(multiplier.group("unit")):] if multiplier else ""
        if multiplier and multiplier_unit in {"m", "b", "m€", "meur"} and not _money_amount_context(
            scrubbed, match.start(), multiplier_unit, scale_tail
        ) and not multiplier_unit.endswith(("€", "eur")):
            multiplier = None
        if multiplier and multiplier.group("unit").casefold() == "k":
            before = scrubbed[max(0, match.start() - 32):match.start()]
            after_k = scrubbed[match.end() + len(multiplier.group("unit")):]
            race_prefix = re.search(
                r"\b(?:run|ran|race|marathon)\s+(?:a|an|the)?\s*$|"
                r"\bfinish(?:ed)?\s+(?:a|an|the)?\s*$|"
                r"\b(?:corre|corrió|correr|carrera)\s+(?:un|una)?\s*$", before, re.IGNORECASE)
            race_suffix = re.match(r"\s+(?:run|race|marathon|starts?|begins?)\b", after_k, re.IGNORECASE)
            karat = re.match(r"\s+gold\b", after_k, re.IGNORECASE)
            if race_prefix or race_suffix or karat:
                multiplier = None

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
        if multiplier:
            word = re.sub(r"\s+", " ", multiplier.group("unit").strip().casefold())
            factor = 1000
            if word in ("million", "millón", "millones", "m", "m€", "meur"):
                factor = 1_000_000
            elif word in ("mil millón", "mil millones", "billion", "b"):
                factor = 1_000_000_000
            elif word in ("trillion", "billón", "billones"):
                factor = 1_000_000_000_000
            elif word in ("trillón", "trillones"):
                factor = 1_000_000_000_000_000_000
            scaled = set()
            for reading in readings:
                if re.fullmatch(r"[+\-]?\d+(?:\.\d+)?", reading):
                    value = format(Decimal(reading) * factor, "f")
                    if "." in value:
                        value = value.rstrip("0").rstrip(".")
                    scaled.add(value or "0")
            readings = scaled
        if is_decade:
            readings.add(str(int(raw[-2:])))
        if short_decade:
            decade_year = int(raw) + (2000 if int(raw) < 30 else 1900)
            readings.add(str(decade_year))
        label = match.group(0).strip()
        if multiplier:
            suffix = multiplier.group("unit").strip()
            if suffix.casefold() in {"m", "m€", "meur"}:
                label += " million"
            elif suffix.casefold() == "b":
                label += " billion"
            else:
                label += suffix if suffix.casefold() == "k" else " " + suffix
        numbers.append((label, frozenset(readings)))
    if source:
        numbers.extend(_english_spelled_numbers(scrubbed))
    if not source:
        tokens = list(_WORD_RE.finditer(scrubbed))
        token_words = {match.group(0).casefold() for match in tokens}
        scale_matches = list(_ES_SCALE_TOKEN_RE.finditer(scrubbed))
        has_cardinal_unit = bool(token_words & _ES_CARDINAL_WORDS and token_words & _UNIT_WORDS)
        if scale_matches or has_cardinal_unit:
            numeric_spans = []
            for match in _NUM_RE.finditer(scrubbed):
                end = match.end()
                scale = re.match(
                    r"\s*(?:thousand|million|billion|trillion|mil\s+millones?|mil|"
                    r"mill[oó]n(?:es)?|bill[oó]n(?:es)?|trill[oó]n(?:es)?)(?!\w)",
                    scrubbed[end:], re.IGNORECASE)
                if scale:
                    end += scale.end()
                numeric_spans.append((match.start(), end))
        else:
            numeric_spans = []
        unit_spans = []
        if has_cardinal_unit:
            for match in _ES_CARDINAL_UNIT_RE.finditer(scrubbed):
                if any(match.start() < end and start < match.end() for start, end in numeric_spans):
                    continue
                value = _es_cardinal_value(match.group("number"))
                if value == 1 and match.group("number").casefold() in {"un", "uno", "una"}:
                    continue
                if value is not None:
                    numbers.append((match.group(0), frozenset({str(value)})))
                    unit_spans.append(match.span())
        scale_positions = {
            match.start(): match.group("scale").casefold()
            for match in scale_matches
        }
        token_index = {match.start(): index for index, match in enumerate(tokens)}
        for scale_start, scale in scale_positions.items():
            index = token_index.get(scale_start)
            if index is None:
                continue
            token = tokens[index]
            if scale == "mil" and index + 1 < len(tokens) and tokens[index + 1].group(0).casefold() in {
                "millón", "millones", "millon"
            }:
                continue
            if any(token.start() < end and start < token.end()
                   for start, end in numeric_spans + unit_spans):
                continue
            max_start = max(0, index - 5)
            max_end = min(len(tokens), index + (6 if scale == "mil" else 1))
            candidates = []
            for start_index in range(max_start, index + 1):
                for end_index in range(index, max_end):
                    span_start, span_end = tokens[start_index].start(), tokens[end_index].end()
                    surface = scrubbed[span_start:span_end]
                    phrase = " ".join(match.group(0) for match in tokens[start_index:end_index + 1])
                    if re.sub(r"\s+", " ", surface).casefold() != phrase.casefold():
                        continue
                    value = _es_cardinal_value(phrase)
                    if value is not None:
                        candidates.append((span_start, span_end, phrase, value))
            if candidates:
                span_start, span_end, phrase, value = max(candidates, key=lambda item: item[1] - item[0])
                span = (span_start, span_end)
                if not any(span[0] < end and start < span[1]
                           for start, end in numeric_spans + unit_spans):
                    numbers.append((phrase, frozenset({str(value)})))
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


def _attached_unit_counts(text: str, source: bool = False, translated_unit_readings=()):
    pattern = _ATTACHED_UNIT_RE if source else _TRANSLATED_UNIT_RE
    counts = {}

    def ambiguous_spaced_noun(match):
        if not text[match.end("number"):match.start("unit")].isspace():
            return False
        raw_unit = match.group("unit")
        readings = _plain_numeric_readings(match.group("number"), source=True)
        if readings in translated_unit_readings:
            return False
        following_match = _WORD_RE.match(
            text[match.end("unit"):match.end("unit") + 64].lstrip()
        )
        following = following_match.group(0).casefold() if following_match else ""
        if not following:
            return False
        if following.endswith("ly") or following in {
            "as", "before", "after", "and", "or", "to", "by", "for", "in", "with",
            "over", "under", "long", "wide", "deep", "high", "tall", "thick", "thin",
            "short",
        }:
            return False
        if len(raw_unit) == 1:
            return True
        if raw_unit.casefold() != raw_unit or not raw_unit.isalpha() or raw_unit.endswith("s"):
            return False
        return following.endswith("s") and not following.endswith("ly")

    def add(number, raw_unit, start, spelled=False):
        raw_unit_folded = raw_unit.casefold()
        before = text[max(0, start - 40):start].casefold() if raw_unit_folded in {"m", "b", "s"} else ""
        number_digits = re.sub(r"\D", "", number)
        unit_tail = text[start + len(number) + len(raw_unit):]
        if raw_unit_folded in {"m", "b"} and (
            _money_amount_context(text, start, raw_unit_folded, unit_tail)
            or re.match(r"\s*(?:€|eur\b)", unit_tail, re.IGNORECASE)
        ):
            return
        if raw_unit_folded == "c" and raw_unit == "c":
            return
        if raw_unit_folded == "s" and (
            len(number_digits) == 4 and number_digits.startswith(("19", "20"))
            or len(number_digits) == 2 and (
                re.search(r"\bthe\s+$", before)
                or re.search(r"\b(?:in\s+)?(?:my|his|her|their|our)\s+$", before)
                or re.match(r"\s+(?:music|fashion|style|rock|pop)\b",
                            text[start + len(number) + len(raw_unit):], re.IGNORECASE)
            )
        ):
            return
        unit = _UNIT_CANONICAL.get(raw_unit_folded)
        if spelled:
            value = _es_cardinal_value(number)
            readings = [(number, frozenset({str(value)}))] if value is not None else []
        else:
            readings = [(number, _plain_numeric_readings(number, source=source))]
        if readings and unit:
            key = (readings[0][1], unit)
            counts[key] = counts.get(key, 0) + 1

    for match in pattern.finditer(text):
        if source and ambiguous_spaced_noun(match):
            continue
        add(match.group("number"), match.group("unit"), match.start())
    for match in _NUM_RE.finditer(text):
        after_number = text[match.end():]
        if after_number[:1].casefold() != "k":
            continue
        before = text[max(0, match.start() - 32):match.start()]
        after_k = after_number[1:]
        is_race_distance = bool(
            re.search(r"\b(?:run|ran|race|marathon)\s+(?:a|an|the)?\s*$|"
                      r"\bfinish(?:ed)?\s+(?:a|an|the)?\s*$|"
                      r"\b(?:corre|corrió|correr|carrera)\s+(?:un|una)?\s*$",
                      before, re.IGNORECASE)
            or re.match(r"\s+(?:run|race|marathon|starts?|begins?)\b", after_k, re.IGNORECASE)
        )
        if is_race_distance:
            add(match.group(0), "km", match.start())
    if not source:
        for match in _ES_CARDINAL_UNIT_RE.finditer(text):
            add(match.group("number"), match.group("unit"), match.start(), spelled=True)
    return counts


def _units_changed(source: str, translated: str, source_doses=None, translated_doses=None) -> bool:
    translated_counts = _attached_unit_counts(translated)
    translated_unit_readings = {
        readings for (readings, _unit), count in translated_counts.items() if count
    }
    expected = _attached_unit_counts(
        source, source=True, translated_unit_readings=translated_unit_readings
    )
    if source_doses and translated_doses:
        omissions = {}
        for period, source_amounts in source_doses.items():
            target_periods = ("afternoon", "night") if period == "evening" else (period,)
            for target_period in target_periods:
                for amount, unit in source_amounts:
                    if unit not in {"tablet", "pill", "capsule"}:
                        continue
                    if (amount, "") in translated_doses.get(target_period, ()):
                        key = (frozenset({amount}), unit)
                        omissions[key] = omissions.get(key, 0) + 1
        for key, count in omissions.items():
            current = expected.get(key, 0)
            if current <= count:
                expected.pop(key, None)
            else:
                expected[key] = current - count
    actual = list(translated_counts.items())

    def equivalent(source_readings, target_readings, source_unit, target_unit):
        if source_readings & target_readings:
            return source_unit == target_unit
        if source_unit in _TIME_UNIT_FACTORS and target_unit in _TIME_UNIT_FACTORS:
            return any(
                Decimal(source_value) * _TIME_UNIT_FACTORS[source_unit]
                == Decimal(target_value) * _TIME_UNIT_FACTORS[target_unit]
                for source_value in source_readings for target_value in target_readings
            )
        if source_unit in _LENGTH_UNIT_FACTORS and target_unit in _LENGTH_UNIT_FACTORS:
            return any(
                Decimal(source_value) * _LENGTH_UNIT_FACTORS[source_unit]
                == Decimal(target_value) * _LENGTH_UNIT_FACTORS[target_unit]
                for source_value in source_readings for target_value in target_readings
            )
        if source_unit != "celsius" or target_unit != "celsius":
            return False
        for value in source_readings:
            if not value.startswith("-") or value[1:] not in target_readings:
                continue
            magnitude = re.escape(value[1:])
            if re.search(rf"(?<!\w){magnitude}\s*(?:°\s*[cf]?|º[cf]?|grados?)\s+bajo cero\b",
                         translated, re.IGNORECASE):
                return True
        return False

    for (source_readings, source_unit), count in expected.items():
        for _ in range(count):
            index = next((i for i, ((readings, unit), amount) in enumerate(actual)
                          if amount and equivalent(source_readings, readings, source_unit, unit)), None)
            if index is None:
                return True
            key, amount = actual[index]
            if amount == 1:
                actual.pop(index)
            else:
                actual[index] = (key, amount - 1)
    return False


def _convertible_unit_number_pairs(source: str, translated: str):
    source_units = _attached_unit_counts(source, source=True)
    translated_units = _attached_unit_counts(translated)
    if not source_units or not translated_units:
        return []
    pairs = []
    for (source_readings, source_unit), source_count in source_units.items():
        if source_unit not in _CONVERTIBLE_UNIT_FACTORS:
            continue
        for (target_readings, target_unit), target_count in translated_units.items():
            if target_unit not in _CONVERTIBLE_UNIT_FACTORS:
                continue
            equivalent = any(
                Decimal(source_value) * _CONVERTIBLE_UNIT_FACTORS[source_unit]
                == Decimal(target_value) * _CONVERTIBLE_UNIT_FACTORS[target_unit]
                for source_value in source_readings for target_value in target_readings
            )
            if equivalent:
                pairs.extend([(source_readings, target_readings)] * min(source_count, target_count))
    return pairs


_EN_DOSE_PERIOD_RE = re.compile(
    r"\b(?P<number>\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+"
    rf"(?:(?P<unit>tablets?|pills?|doses?|capsules?|units?|drops?|puffs?|{_DOSE_UNIT_PATTERN})\s+)?"
    r"(?:in\s+the|at)\s+(?P<period>morning|afternoon|evening|night|bedtime)\b", re.IGNORECASE)
_ES_DOSE_PERIOD_RE = re.compile(
    rf"\b(?P<number>\d+(?:[.,]\d+)?|{_ES_CARDINAL_PATTERN})\s+"
    rf"(?:(?P<unit>comprimidos?|tabletas?|pastillas?|píldoras?|cápsulas?|dosis|{_DOSE_UNIT_PATTERN})\s+)?"
    r"(?:(?:(?:por|en|a|de)\s+(?:(?:la|las)\s+)?|cada\s+)"
    r"(?P<period>mañanas?|madrugadas?|tardes?|noches?)\b|"
    r"(?:al|antes\s+de)\s+(?P<alternative>despertar|acostarse|dormir)\b)", re.IGNORECASE)

_EN_DOSE_PERIOD_ONLY_RE = re.compile(
    r"\b(?:in\s+(?:the\s+)?|at\s+)(?P<period>morning|afternoon|evening|night|bedtime)\b"
    r"(?!\s+(?:dose|tablet|pill|meal|class|appointment|meeting|shift|lecture|lesson)s?\b)",
    re.IGNORECASE)
_ES_DOSE_PERIOD_ONLY_RE = re.compile(
    r"\b(?:(?:(?:por|en|a|de)\s+(?:(?:la|las)\s+)?|cada\s+)"
    r"(?P<period>mañanas?|madrugadas?|tardes?|noches?)|"
    r"(?:al|antes\s+de)\s+(?P<alternative>despertar|acostarse|dormir))\b", re.IGNORECASE)


_EN_DOSE_ITEM_RE = re.compile(
    rf"(?P<number>\d+(?:[.,]\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)"
    rf"(?:\s*(?P<unit>tablets?|pills?|doses?|capsules?|units?|drops?|puffs?|{_DOSE_UNIT_PATTERN}))?"
    r"(?!\w)", re.IGNORECASE)
_ES_DOSE_ITEM_RE = re.compile(
    rf"(?P<number>\d+(?:[.,]\d+)?|{_ES_CARDINAL_PATTERN})"
    rf"(?:\s*(?P<unit>comprimidos?|tabletas?|pastillas?|píldoras?|cápsulas?|dosis|{_DOSE_UNIT_PATTERN}))?"
    r"(?!\w)", re.IGNORECASE)


def _canonical_decimal(value: str) -> str:
    number = Decimal(value.replace(",", "."))
    if not number:
        return "0"
    return format(number.normalize(), "f")


def _dose_amount_value(raw: str, source: bool) -> str | None:
    value = raw.casefold()
    if re.fullmatch(r"\d+(?:[.,]\d+)?", value):
        return _canonical_decimal(value)
    if source and value in _EN_TIME_WORDS:
        return str(_EN_TIME_WORDS[value])
    if not source:
        spelled = _es_cardinal_value(value)
        if spelled is not None:
            return str(spelled)
    return None


def _canonical_dose_unit(raw: str | None) -> str:
    if not raw:
        return ""
    value = raw.casefold()
    if value in _UNIT_CANONICAL:
        return _UNIT_CANONICAL[value]
    if value in {"drop", "drops", "gota", "gotas"}:
        return "drop"
    if value in {"puff", "puffs", "inhalación", "inhalaciones"}:
        return "puff"
    if value in {"unit", "units", "unidad", "unidades"}:
        return "unit"
    return value


def _dose_period_values(text: str, source: bool = False, time_matches=()):
    pattern = _EN_DOSE_PERIOD_ONLY_RE if source else _ES_DOSE_PERIOD_ONLY_RE
    time_spans = sorted(span for _, span in time_matches)
    aliases = {"madrugada": "morning", "madrugadas": "morning", "mañana": "morning",
               "mañanas": "morning", "tarde": "afternoon", "tardes": "afternoon",
               "noche": "night", "noches": "night", "despertar": "morning",
               "acostarse": "night", "dormir": "night", "bedtime": "night", "afternoon": "afternoon",
               "evening": "evening", "morning": "morning", "night": "night"}
    period_matches = []
    for match in pattern.finditer(text):
        if any(match.start() < end and start < match.end() for start, end in time_spans):
            continue
        period = (match.group("period") or match.group("alternative")).casefold()
        period_matches.append((match, aliases.get(period, period)))
    if not period_matches:
        return []

    item_pattern = _EN_DOSE_ITEM_RE if source else _ES_DOSE_ITEM_RE
    allowed = (
        {"in", "at", "with", "by", "for", "on", "before", "after", "and", "or"}
        if source else
        {"por", "en", "a", "al", "antes", "con", "según", "y", "e", "o"}
    )
    sentence_bounds = []
    for match, _period in period_matches:
        start = max(
            (mark.end() for mark in re.finditer(r"(?<!\d)[.!?;](?!\d)", text[:match.start()])),
            default=0,
        )
        end_match = re.search(r"(?<!\d)[.!?;](?!\d)", text[match.end():])
        end = match.end() + end_match.start() if end_match else len(text)
        sentence_bounds.append((start, end))

    values = []
    for item in item_pattern.finditer(text):
        item_span = item.span()
        if any(item_span[0] < end and start < item_span[1] for start, end in time_spans):
            continue
        if not item.group("unit"):
            tail = text[item.end():].lstrip(" ,;:")
            following = _WORD_RE.match(tail)
            if following and following.group(0).casefold() not in allowed:
                continue
        if not any(start <= item.start() <= end for start, end in sentence_bounds):
            continue
        candidates = []
        for index, (match, period) in enumerate(period_matches):
            if not sentence_bounds[index][0] <= item.start() <= sentence_bounds[index][1]:
                continue
            if item.end() <= match.start():
                between = text[item.end():match.start()]
                distance = match.start() - item.end()
            elif match.end() <= item.start():
                between = text[match.end():item.start()]
                distance = item.start() - match.end()
            else:
                between = ""
                distance = 0
            crossed_coordination = bool(
                re.search(r"\b(?:and|or|but|y|e|o)\b", between, re.IGNORECASE)
            )
            candidates.append((crossed_coordination, distance, index, period))
        if not candidates:
            continue
        _crossed, _distance, _selected, period = min(candidates)
        # The amount/unit belongs to the closest period marker in its sentence,
        # whether the translator placed the period before or after the dose.
        amount = _dose_amount_value(item.group("number"), source)
        if amount is not None:
            values.append((amount, _canonical_dose_unit(item.group("unit")), period))
    return values


def _dose_periods(text: str, source: bool = False, time_matches=()):
    periods = {}
    for amount, unit, period in _dose_period_values(text, source, time_matches):
        periods.setdefault(period, []).append((amount, unit))
    return {period: tuple(sorted(values)) for period, values in periods.items()}


def _dose_periods_match(source, translated):
    if source == translated:
        return True
    source_items = list(source.items())
    translated_items = dict(translated)

    def match_remaining(index, remaining):
        if index == len(source_items):
            return not remaining
        period, amounts = source_items[index]
        options = ("afternoon", "night") if period == "evening" else (period,)
        return any(
            candidate in remaining and _dose_amounts_match(amounts, remaining[candidate])
            and match_remaining(index + 1, {key: value for key, value in remaining.items()
                                            if key != candidate})
            for candidate in options
        )

    return match_remaining(0, translated_items)


def _dose_amounts_match(source_amounts, translated_amounts):
    if source_amounts == translated_amounts:
        return True
    if len(source_amounts) != len(translated_amounts):
        return False
    remaining = list(translated_amounts)
    for amount, unit in source_amounts:
        index = next((index for index, (other_amount, other_unit) in enumerate(remaining)
                      if amount == other_amount and (
                          unit == other_unit or {unit, other_unit} <= {"", "tablet", "pill", "capsule"}
                      )), None)
        if index is None:
            return False
        remaining.pop(index)
    return not remaining


def _dose_number_sequence(text: str, source: bool = False, time_matches=()):
    return [amount for amount, _unit, _period in _dose_period_values(text, source, time_matches)]


_FREQUENCY_EN_COUNT = (
    r"once|twice|thrice|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a|an|"
    r"\d+(?:[.,]\d+)?x?"
)
_FREQUENCY_ES_PERIOD = r"d[ií]as?|semanas?|mes(?:es)?"
_EN_FREQUENCY_COUNT_RE = re.compile(
    rf"\b(?P<count>{_FREQUENCY_EN_COUNT})\s+(?:(?:times?)\s+)?"
    r"(?:(?:a|per)\s+)?(?P<period>days?|weeks?|months?|daily|weekly|monthly)\b",
    re.IGNORECASE,
)
_EN_FREQUENCY_EVERY_RE = re.compile(
    r"\bevery\s+(?:(?P<interval>other|one|two|three|four|five|six|seven|eight|nine|ten|"
    r"eleven|twelve|\d+(?:[.,]\d+)?)\s+)?(?P<period>days?|weeks?|months?)\b",
    re.IGNORECASE,
)
_ES_FREQUENCY_COUNT_RE = re.compile(
    rf"\b(?P<count>\d+(?:[.,]\d+)?|{_ES_CARDINAL_NUMBER_PATTERN})\s+"
    rf"(?P<unit>vez|veces)\s+(?:(?:al|por|cada)\s+)?"
    rf"(?P<period>{_FREQUENCY_ES_PERIOD}|diarias?|semanales?|mensuales?)\b",
    re.IGNORECASE,
)
_ES_FREQUENCY_DIRECT_RE = re.compile(
    rf"\b(?P<count>\d+(?:[.,]\d+)?|{_ES_CARDINAL_NUMBER_PATTERN})\s+"
    rf"(?:al|por)\s+(?P<period>{_FREQUENCY_ES_PERIOD})\b",
    re.IGNORECASE,
)
_ES_FREQUENCY_EVERY_RE = re.compile(
    rf"\b(?:cada\s+|todos?\s+los?\s+)(?:(?P<interval>\d+(?:[.,]\d+)?|{_ES_CARDINAL_NUMBER_PATTERN})\s+)?"
    rf"(?P<period>{_FREQUENCY_ES_PERIOD})\b",
    re.IGNORECASE,
)
_FREQUENCY_HOURS_RE = re.compile(
    r"\b(?:every|cada)\s+(?P<interval>\d+(?:[.,]\d+)?)\s+(?:hours?|horas?)\b",
    re.IGNORECASE,
)
_EN_FREQUENCY_DAILY_RE = re.compile(r"\bdaily\b", re.IGNORECASE)
_ES_FREQUENCY_SINGLE_RE = re.compile(
    r"\b(?:al|por)\s+d[ií]a\b|\bdiariamente\b|\bsemanalmente\b|\bmensualmente\b",
    re.IGNORECASE,
)
_EN_FREQUENCY_PER_PERIOD_RE = re.compile(
    r"\b(?:a|per)\s+(?P<period>day|week|month)\b", re.IGNORECASE
)
_EN_DAYS_PER_WEEK_RE = re.compile(
    rf"\b(?P<count>{_FREQUENCY_EN_COUNT})\s+days?\s+(?:a|per)\s+week\b",
    re.IGNORECASE,
)
_ES_DAYS_PER_WEEK_RE = re.compile(
    rf"\b(?P<count>\d+(?:[.,]\d+)?|{_ES_CARDINAL_NUMBER_PATTERN})\s+"
    r"d[ií]as?\s+(?:a\s+la|por)\s+semana\b",
    re.IGNORECASE,
)
_ES_FREQUENCY_ADJECTIVE_RE = re.compile(r"\bdiari[oa]s?\b", re.IGNORECASE)


def _frequency_count_value(raw: str) -> str | None:
    value = raw.casefold()
    if value.endswith("x") and value[:-1].isdigit():
        value = value[:-1]
    if value in {"once", "twice", "thrice"}:
        return {"once": "1", "twice": "2", "thrice": "3"}[value]
    if re.fullmatch(r"\d+(?:[.,]\d+)?", value):
        return _canonical_decimal(value)
    if value in _EN_TIME_WORDS:
        return str(_EN_TIME_WORDS[value])
    spelled = _es_cardinal_value(value)
    return str(spelled) if spelled is not None else None


def _frequency_period(raw: str, interval: str | None = None, source: bool = False) -> str | None:
    value = raw.casefold()
    if value in {"daily", "diariamente", "diaria", "diario", "diarios", "diarias",
                 "day", "days", "día", "dia", "días", "dias"}:
        period = "day"
    elif value in {"weekly", "semanalmente", "semanal", "semanales", "week", "weeks",
                   "semana", "semanas"}:
        period = "week"
    elif value in {"monthly", "mensualmente", "mensual", "mensuales", "month", "months",
                   "mes", "meses"}:
        period = "month"
    else:
        return None
    if interval is None:
        return period
    if interval.casefold() == "other":
        count = 2
    else:
        count = _frequency_count_value(interval)
        if count is None:
            return None
        try:
            count = str(int(Decimal(count)))
        except (ValueError, ArithmeticError):
            return None
    return period if count == "1" else f"{count}-{period}"


def _frequency_counts(text: str, source: bool = False):
    found = []
    spans = []

    def add(match, count, period):
        count_value = _frequency_count_value(count)
        period_value = _frequency_period(period)
        if count_value is not None and period_value is not None:
            found.append((count_value, period_value))
            spans.append(match.span())

    for match in _EN_FREQUENCY_COUNT_RE.finditer(text):
        period = match.group("period")
        if period.casefold() not in {"daily", "weekly", "monthly"} and not re.search(
            r"\b(?:a|per)\s+$", text[max(0, match.start("period") - 8):match.start("period")],
            re.IGNORECASE,
        ):
            continue
        add(match, match.group("count"), period)
    for match in _EN_DAYS_PER_WEEK_RE.finditer(text):
        add(match, match.group("count"), "week")
    for match in _ES_DAYS_PER_WEEK_RE.finditer(text):
        add(match, match.group("count"), "week")
    for match in _ES_FREQUENCY_COUNT_RE.finditer(text):
        add(match, match.group("count"), match.group("period"))
    for match in _ES_FREQUENCY_DIRECT_RE.finditer(text):
        if any(match.start() < end and start < match.end() for start, end in spans):
            continue
        add(match, match.group("count"), match.group("period"))
    for match in _EN_FREQUENCY_PER_PERIOD_RE.finditer(text):
        if any(match.start() < end and start < match.end() for start, end in spans):
            continue
        before = text[max(0, match.start() - 64):match.start()]
        if re.search(r"\b\d+(?:[.,]\d+)?\s*[\w-]+\s*$", before):
            found.append(("1", _frequency_period(match.group("period"))))
            spans.append(match.span())
    for pattern in (_EN_FREQUENCY_EVERY_RE, _ES_FREQUENCY_EVERY_RE):
        for match in pattern.finditer(text):
            if any(match.start() < end and start < match.end() for start, end in spans):
                continue
            period = _frequency_period(
                match.group("period"), match.group("interval"), source
            )
            if period is not None:
                found.append(("1", period))
                spans.append(match.span())

    for match in _FREQUENCY_HOURS_RE.finditer(text):
        try:
            hours = Decimal(match.group("interval").replace(",", "."))
            doses_per_day = Decimal(24) / hours
        except (ValueError, ArithmeticError):
            continue
        if hours > 0 and doses_per_day == doses_per_day.to_integral_value():
            found.append((_canonical_decimal(str(doses_per_day)), "day"))
            spans.append(match.span())

    for pattern in (_EN_FREQUENCY_DAILY_RE, _ES_FREQUENCY_SINGLE_RE, _ES_FREQUENCY_ADJECTIVE_RE):
        for match in pattern.finditer(text):
            if any(match.start() < end and start < match.end() for start, end in spans):
                continue
            if pattern is _EN_FREQUENCY_DAILY_RE or pattern is _ES_FREQUENCY_ADJECTIVE_RE:
                before = text[max(0, match.start() - 64):match.start()]
                count = _FREQUENCY_EN_COUNT if pattern is _EN_FREQUENCY_DAILY_RE else (
                    rf"(?:\d+(?:[.,]\d+)?|{_ES_CARDINAL_NUMBER_PATTERN})"
                )
                units = (
                    rf"(?:tablets?|pills?|doses?|capsules?|units?|drops?|puffs?|{_DOSE_UNIT_PATTERN})"
                    if pattern is _EN_FREQUENCY_DAILY_RE else
                    rf"(?:comprimidos?|tabletas?|pastillas?|píldoras?|cápsulas?|dosis|{_DOSE_UNIT_PATTERN})"
                )
                spacing = r"\s*" if pattern is _EN_FREQUENCY_DAILY_RE else r"\s+"
                has_dose = re.search(rf"\b{count}{spacing}{units}\b[^.!?;:]*$", before, re.IGNORECASE)
                if not has_dose:
                    continue
                period = "day"
            else:
                if match.group(0).casefold().endswith(("semanalmente", "mensualmente")):
                    period = "week" if "semanal" in match.group(0).casefold() else "month"
                else:
                    period = "day"
            found.append(("1", period))
            spans.append(match.span())
    return sorted(found)


def _ordered_number_readings(text: str, source: bool = False):
    spans = []
    for match in _NUM_RE.finditer(text):
        parsed = _numbers(match.group(0), source=source)
        if parsed:
            spans.append((match.start(), match.end(), parsed[0][1]))
    if not source:
        for match in _ES_CARDINAL_RE.finditer(text):
            value = _es_cardinal_value(match.group("number"))
            if value is not None:
                spans.append((match.start(), match.end(), frozenset({str(value)})))
    selected = []
    for start, end, readings in sorted(spans, key=lambda item: (item[0], -(item[1] - item[0]))):
        if any(start < other_end and other_start < end for other_start, other_end, _ in selected):
            continue
        selected.append((start, end, readings))
    return [readings for _, _, readings in sorted(selected)]


def _dose_sequence_matches(source, translated):
    actual = iter(translated)
    for expected in source:
        if not any(expected in readings for readings in actual):
            return False
    return True


def _time_matches(text: str, source_minutes=(), source=False):
    """Return explicit 12-hour and 24-hour times as (canonical minutes, span).

    source_minutes lists the source's clock times; a bare "N h" in the translation is a time
    only when it renders one of them (otherwise it is a duration and stays a number)."""
    matches = []
    occupied = []
    ambiguous_count_ranges = []
    for range_match in _TIME_EN_WORD_RANGE_RE.finditer(text):
        before = text[max(0, range_match.start() - 48):range_match.start()]
        start = range_match.group("start").casefold()
        end = range_match.group("end").casefold()
        has_clock_context = bool(re.search(
            r"\b(?:open|opens|close|closes|work|works|working|meet|meets|leave|leaves|"
            r"store|shop|office|schedule|hours?)\b[^.!?;:]*$", before, re.IGNORECASE
        ))
        if start == "one" and end == "ten" and not has_clock_context:
            ambiguous_count_ranges.append(range_match.span())
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
    for match in _TIME_ES_NAMED_RE.finditer(text):
        hour = 12 if "mediod" in match.group(0).lower() else 0
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_PERIOD_RE.finditer(text):
        before = text[max(0, match.start() - 128):match.start()]
        tail = text[match.end():match.end() + 64].lstrip(" ,;:")
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        if not match.group("cue") and re.search(
            r"\b(?:eat|eats|ate|eaten|have|has|had|drink|drinks|drank|consume|consumes|consumed)\b"
            r"[^.!?;]*$", before, re.IGNORECASE
        ):
            continue
        if not match.group("cue") and following and following in _TIME_COUNT_NOUNS:
            continue
        if not match.group("cue") and not match.group("oclock") and re.search(
            r"\b(?:take|give|dose|tablet|pill|capsule)s?\b[^.!?;]*$", before, re.IGNORECASE
        ):
            continue
        if not match.group("cue") and not match.group("oclock") and re.search(
            r"\b(?:take|give|dose)\b[^.!?;]*\band\s*$", before, re.IGNORECASE
        ) and re.search(rf"\b\d+\s+(?:{_DOSE_UNIT_PATTERN})\b[^.!?;]*$", before, re.IGNORECASE):
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
        before = text[max(0, match.start() - 32):match.start()]
        tail = text[match.end():match.end() + 64].lstrip(" ,;:")
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        if not match.group("cue") and re.search(
            r"\b(?:eat|eats|ate|eaten|have|has|had|drink|drinks|drank|consume|consumes|consumed)\b"
            r"[^.!?;]*$", before, re.IGNORECASE
        ):
            continue
        if not match.group("cue") and following and following in _TIME_COUNT_NOUNS:
            continue
        if not match.group("cue") and not match.group("oclock") and re.search(
            r"\b(?:take|give|dose|tablet|pill|capsule)s?\b[^.!?;]*$", before, re.IGNORECASE
        ):
            continue
        if not match.group("cue") and not match.group("oclock") and re.search(
            r"\b(?:take|give|dose)\b[^.!?;]*\band\s*$", before, re.IGNORECASE
        ) and re.search(rf"\b\d+\s+(?:{_DOSE_UNIT_PATTERN})\b[^.!?;]*$", before, re.IGNORECASE):
            continue
        hour = _EN_TIME_WORDS[match.group("h").lower()] % 12
        period = (match.group("period") or match.group("night") or "").lower()
        if period in ("afternoon", "evening") or (period == "night" and hour > 4):
            hour += 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for range_match in _TIME_EN_WORD_RANGE_RE.finditer(text):
        if range_match.span() in ambiguous_count_ranges:
            continue
        tail = text[range_match.end():range_match.end() + 64].lstrip(" ,;:")
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        if following in _TIME_COUNT_NOUNS:
            continue
        start_hour = _EN_TIME_WORDS[range_match.group("start").casefold()]
        end_hour = _EN_TIME_WORDS[range_match.group("end").casefold()]
        matches.append((start_hour * 60, range_match.span("start")))
        matches.append((end_hour * 60, range_match.span("end")))
        occupied.extend((range_match.span("start"), range_match.span("end")))
    for match in _TIME_EN_WORD_HOUR_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in ambiguous_count_ranges):
            continue
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        tail = text[span[1]:span[1] + 64].lstrip(" ,;:")
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        before = text[max(0, span[0] - 40):span[0]]
        if following and (following in _TIME_COUNT_NOUNS or following in {"to", "of"}):
            continue
        if match.group("cue").casefold() in {"after", "before"} and text[span[1]:span[1] + 1] == ",":
            continue
        if match.group("cue").casefold() == "from" and re.search(
            r"\bcount\s*$", before, re.IGNORECASE
        ):
            continue
        if match.group("cue").casefold() == "by" and re.search(
            r"\b(?:divide|divided|multiply|multiplied|subtract|subtracted|add|added)\b[^.!?;]*$",
            before, re.IGNORECASE
        ):
            continue
        if match.group("cue").casefold() == "by" and re.search(
            r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*$",
            before, re.IGNORECASE
        ):
            continue
        matches.append((_EN_TIME_WORDS[match.group("h").lower()] * 60, span))
        occupied.append(span)
    for match in _TIME_EN_NOON_RE.finditer(text):
        hour = 0 if match.group("period").lower() == "midnight" else 12
        matches.append((hour * 60, match.span()))
        occupied.append(match.span())
    for match in _TIME_EN_OCLOCK_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        matches.append((int(match.group("h")) % 12 * 60, span))
        occupied.append(span)
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
    for match in _TIME_ES_WORD_RANGE_RE.finditer(text):
        tail = text[match.end():match.end() + 64].lstrip(" ,;:")
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        if following in _TIME_COUNT_NOUNS:
            continue
        start = _ES_TIME_WORDS[match.group("start").casefold()] * 60
        end = _ES_TIME_WORDS[match.group("end").casefold()] * 60
        matches.append((start, match.span("start")))
        matches.append((end, match.span("end")))
        occupied.extend((match.span("start"), match.span("end")))
    for match in _TIME_ES_DIGIT_WORD_HOUR_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        tail = text[span[1]:span[1] + 64].lstrip()
        following_match = _WORD_RE.match(tail)
        following = following_match.group(0).casefold() if following_match else ""
        following2_match = (
            _WORD_RE.match(tail[following_match.end():].lstrip()) if following_match else None
        )
        following2 = following2_match.group(0).casefold() if following2_match else ""
        count_nouns = {"chica", "chicas", "niña", "niñas", "mujeres", "enfermera",
                       "enfermeras", "girls", "nurses", "semanas", "semana", "meses",
                       "mes", "años", "año", "días", "día", "horas", "hora", "opción",
                       "opciones", "alternativa", "alternativas"}
        if following in count_nouns or following in _TIME_COUNT_NOUNS or following2 in {
            "opción", "opciones", "alternativa", "alternativas", "respuestas", "soluciones"
        }:
            continue
        minute = int(match.group("h")) * 60
        if match.group("verb") or minute in unclaimed or (source and match.group("prep")):
            if minute in unclaimed:
                unclaimed.remove(minute)
            matches.append((minute, span))
            occupied.append(span)
    for match in _TIME_ES_WORD_HOUR_RE.finditer(text):
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        after = _WORD_RE.match(text[span[1]:span[1] + 64].lstrip())
        following = after.group(0).casefold() if after else ""
        tail = text[span[1]:span[1] + 64].lstrip()
        following2_match = _WORD_RE.match(tail[after.end():].lstrip()) if after else None
        following2 = following2_match.group(0).casefold() if following2_match else ""
        if following in {"chica", "chicas", "niña", "niñas", "mujeres", "enfermera",
                         "enfermeras", "girls", "nurses", "semanas", "semana", "meses",
                         "mes", "años", "año", "días", "día", "horas", "hora", "opción",
                         "opciones", "alternativa", "alternativas"} or following in _TIME_COUNT_NOUNS or following2 in {
            "opción", "opciones", "alternativa", "alternativas", "respuestas", "soluciones"
        }:
            continue
        if following == "más" and following2 == "o":
            continue
        minute = _ES_TIME_WORDS[match.group("h").lower()] * 60
        if match.group("verb") or minute in unclaimed or (source and match.group("prep")):
            if minute in unclaimed:
                unclaimed.remove(minute)
            matches.append((minute, span))
            occupied.append(span)
    for match in spanish_hours:
        if not match.group("art"):
            continue
        span = match.span()
        if any(span[0] < end and start < span[1] for start, end in occupied):
            continue
        minute = int(match.group("h")) * 60
        has_cue = match.group("verb") or match.group("prep")
        is_clock_unit = match.group("unit").lower() == "h"
        if (is_clock_unit and (has_cue or minute in unclaimed)) or (not is_clock_unit and has_cue):
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


def _times_match(source: str, source_matches, source_values, translated_values) -> bool:
    if source_values == translated_values:
        return True
    if len(source_values) != len(translated_values):
        return False
    matched_spans = {span for _, span in source_matches}
    ambiguous = {
        _EN_TIME_WORDS[match.group("h").lower()] * 60
        for match in _TIME_EN_WORD_HOUR_RE.finditer(source)
        if match.span() in matched_spans
    }
    for match in _TIME_EN_WORD_RANGE_RE.finditer(source):
        if match.span("start") in matched_spans:
            ambiguous.add(_EN_TIME_WORDS[match.group("start").casefold()] * 60)
        if match.span("end") in matched_spans:
            ambiguous.add(_EN_TIME_WORDS[match.group("end").casefold()] * 60)
    remaining = list(translated_values)
    for source_value in source_values:
        index = next((
            index for index, translated_value in enumerate(remaining)
            if source_value == translated_value
            or source_value in ambiguous
            and source_value % (12 * 60) == translated_value % (12 * 60)
        ), None)
        if index is None:
            return False
        remaining.pop(index)
    return not remaining


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
    ordinal_context = _ordinal_source_context(src)
    translation_ordinal_context = _ordinal_translation_context(dst)
    src_matches = _time_matches(src, source=True)
    dst_matches = _time_matches(dst, [minute for minute, _ in src_matches])
    src_times = sorted(minute for minute, _ in src_matches)
    dst_times = sorted(minute for minute, _ in dst_matches)
    if not _times_match(src, src_matches, src_times, dst_times) and (src_times or dst_times):
        issues.append("Times from the source are missing or changed.")
    src_numbers, dst_numbers = _without_times(src, dst, src_matches, dst_matches)
    src_periods = _dose_periods(src, source=True, time_matches=src_matches)
    dst_periods = _dose_periods(dst, time_matches=dst_matches)
    if _units_changed(src_numbers, dst_numbers, src_periods, dst_periods):
        issues.append("Units attached to source numbers are missing or changed.")
    if src_periods:
        dose_periods_match = (
            _dose_periods_match(src_periods, dst_periods)
            if dst_periods
            else _dose_sequence_matches(
                _dose_number_sequence(src, source=True, time_matches=src_matches),
                _ordered_number_readings(dst_numbers),
            )
        )
        if not dose_periods_match:
            issues.append("Dose counts attached to day periods are missing or changed.")
    src_frequencies = _frequency_counts(src, source=True)
    dst_frequencies = _frequency_counts(dst)
    if (src_frequencies or dst_frequencies) and src_frequencies != dst_frequencies:
        issues.append("Frequency counts from the source are missing or changed.")
    same_number_text = src_numbers.casefold() == dst_numbers.casefold()
    missing = [] if same_number_text else list(_numbers(src_numbers, source=True))
    extra = []
    convertible_unit_pairs = (
        [] if same_number_text else _convertible_unit_number_pairs(src_numbers, dst_numbers)
    )
    missing_by_readings = {}
    for item in missing:
        missing_by_readings.setdefault(item[1], deque()).append(item)
    consumed_numbers = set()
    normalized_src = " " + re.sub(r"[^\w]+", " ", src.casefold()) + " "

    def has_scale(value):
        return bool(re.search(
            r"(?:k|thousand|million|billion|trillion|mil(?:\s+millones?)?|mill[oó]n(?:es)?|"
            r"bill[oó]n(?:es)?|trill[oó]n(?:es)?)$", value.casefold()))

    def ordinal_match_allowed(candidate):
        if not re.fullmatch(r"\d+(?:st|nd|rd|th)", candidate[0], re.IGNORECASE):
            return True
        if (_ordinal_cardinal_alias_allowed(candidate[0], src, ordinal_context)
                or _ordinal_cardinal_translation_alias_allowed(
                    candidate[0], dst, translation_ordinal_context
                )):
            return True
        return any(
            re.search(rf"(?<!\w){re.escape(value)}\s*(?:\.?[ºª°]|\.?er\b)", dst, re.IGNORECASE)
            for value in candidate[1] if re.fullmatch(r"\d+", value)
        )

    def decade_alias_allowed(candidate, readings, label):
        match = re.fullmatch(r"(?P<year>(?:19|20)\d{2})s", candidate[0], re.IGNORECASE)
        if not match:
            return True
        short_year = str(int(match.group("year")[-2:]))
        if short_year not in candidate[1] & readings:
            return True
        if re.fullmatch(r"\d{2}s", label, re.IGNORECASE):
            return True
        return bool(re.search(
            rf"\b(?:a[nñ]os?|d[eé]cada)\s+(?:de\s+)?{re.escape(short_year)}\b",
            dst, re.IGNORECASE,
        ))

    def take_exact(readings, label):
        nonlocal normalized_src
        candidates = missing_by_readings.get(readings)
        if not candidates:
            return None
        for _ in range(len(candidates)):
            candidate = candidates.popleft()
            if id(candidate) in consumed_numbers:
                continue
            if ordinal_match_allowed(candidate) and decade_alias_allowed(candidate, readings, label):
                consumed_numbers.add(id(candidate))
                source_forms = [candidate[0]]
                ordinal = bool(re.fullmatch(r"\d+(?:st|nd|rd|th)", candidate[0], re.IGNORECASE))
                if ordinal:
                    source_forms = [
                        form for value in candidate[1]
                        if re.fullmatch(r"\d+", value) and len(value) <= 6
                        for form in _en_ordinal_forms(int(value))
                    ]
                for form in source_forms:
                    span = _spelled_span(form, normalized_src, ordinal=ordinal)
                    if span is not None:
                        normalized_src = (
                            normalized_src[:span[0]] + (" " * (span[1] - span[0]))
                            + normalized_src[span[1]:]
                        )
                        break
                return candidate
            candidates.append(candidate)
        return None

    for label, readings in ([] if same_number_text else _numbers(dst_numbers)):
        hit = take_exact(readings, label)
        converted_pair = None
        if hit is None:
            converted_pair = next((pair for pair in convertible_unit_pairs if pair[1] == readings), None)
            if converted_pair is not None:
                hit = take_exact(converted_pair[0], label)
                if hit is None:
                    converted_pair = None
        if hit is None:
            hit = next((m for m in missing if id(m) not in consumed_numbers and m[1] & readings
                        and ordinal_match_allowed(m) and decade_alias_allowed(m, readings, label)
                        and not (has_scale(m[0]) and has_scale(label))), None)
            if hit is not None:
                consumed_numbers.add(id(hit))
        if hit is not None:
            if converted_pair is not None:
                convertible_unit_pairs.remove(converted_pair)
        else:
            # Spelled Spanish readings can satisfy a source number, but are not
            # independently treated as extra quantities when the source has none.
            if re.match(r"^[+\-−]?\d", label):
                extra.append((label, readings))
    missing = [item for item in missing if id(item) not in consumed_numbers]
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
        normalized_dst = " " + re.sub(r"[^\w]+", " ", dst.casefold()) + " "
        for item in list(extra):
            forms = [f for v in sorted(item[1]) if re.fullmatch(r"\d+", v) and len(v) <= 6
                     for f in _en_number_forms(int(v)) + _es_cardinal_forms(int(v))]
            if "1" in item[1]:
                forms.extend(("a", "an"))
            span = next((candidate for form in forms
                         if (candidate := _spelled_span(form, normalized_src)) is not None), None)
            if span is None:
                for value in item[1]:
                    if not re.fullmatch(r"\d+", value) or len(value) > 6:
                        continue
                    span = next((candidate for form in _en_ordinal_forms(int(value))
                                 if (candidate := _english_ordinal_in_translation(
                                     form, normalized_src, normalized_dst, int(value))) is not None), None)
                    if span is not None:
                        break
            if span is not None:
                extra.remove(item)
                normalized_src = normalized_src[:span[0]] + (" " * (span[1] - span[0])) + normalized_src[span[1]:]
        if (re.search(r"\bhalf\s+an?\s+hour\b", src, re.IGNORECASE)
                and re.search(r"(?<!\d)30(?:[.,]0+)?\s+minutos\b", dst, re.IGNORECASE)):
            item = next((item for item in extra if "30" in item[1]), None)
            if item is not None:
                extra.remove(item)
    if missing:
        normalized_dst = " " + re.sub(r"[^\w]+", " ", dst.casefold()) + " "
        for item in list(missing):
            ordinal = bool(re.fullmatch(r"\d+(?:st|nd|rd|th)", item[0], re.IGNORECASE))
            forms = [(form, True) for value in sorted(item[1])
                     if re.fullmatch(r"\d+", value) and len(value) <= 6
                     for form in _ES_ORDINALS.get(value, ())] if ordinal else []
            if not ordinal or _ordinal_cardinal_alias_allowed(item[0], src, ordinal_context):
                forms.extend((form, False) for value in sorted(item[1])
                             if re.fullmatch(r"\d+", value) and len(value) <= 6
                             for form in _es_cardinal_forms(int(value)))
            if item[0].lower().endswith("x"):
                if "2" in item[1]:
                    forms.append(("doble", False))
                if "3" in item[1]:
                    forms.append(("triple", False))
            span = next((candidate for form, is_ordinal in forms
                         if (candidate := _spelled_span(form, normalized_dst, ordinal=is_ordinal)) is not None), None)
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
    try:
        issues = _guard_issues(source, translated)
    except Exception:
        issues = ["Validation guard failed closed."]
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
