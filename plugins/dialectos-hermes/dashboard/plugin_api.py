"""DialectOS backend routes, mounted by Hermes at /api/plugins/dialectos/.

They serve the desktop page and the dashboard tab, and reuse the plugin's own
operations, so the page runs the same CLI, settings, scrubbed environment and
limits as the agent tools. Detect, list and validate run offline. Translate
sends text only to the provider named in settings, and only when a person
presses Translate on the page. The QA ledger stores verdicts, never text.
"""
from __future__ import annotations

import importlib.util
import shlex
import shutil
import sys
import threading
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field


def _load_core():
    name = "dialectos_hermes_core"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, Path(__file__).resolve().parent.parent / "__init__.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


core = _load_core()
router = APIRouter()

_DIALECTS: Dict[str, Any] = {}
_DIALECTS_LOCK = threading.Lock()


def _err(exc: Exception) -> Dict[str, Any]:
    return {"ok": False, "error": str(exc) if isinstance(exc, ValueError) else f"{type(exc).__name__}: {exc}"}


def _record(tool: str, dialect: str, res: Dict[str, Any]) -> None:
    """Same verdict-only ledger entry the agent tools write, marked as from the page."""
    entry: Dict[str, Any] = {"ts": int(time.time()), "tool": tool, "dialect": dialect, "ok": bool(res.get("ok")), "via": "page"}
    data = res.get("data")
    if tool == "dialectos_validate" and isinstance(data, dict):
        entry["passed"] = data.get("valid", data.get("passed"))
        entry["issue_count"], entry["blocking_issue_count"] = core._issue_counts(data)
    try:
        core._append_ledger(entry)
    except Exception:
        pass


def _issues(data: Any) -> list[Dict[str, Any]]:
    """Flatten a CLI report into [{message, blocking}] for display (deduplicated)."""
    if not isinstance(data, dict):
        return []
    judge = data.get("outputJudge") if isinstance(data.get("outputJudge"), dict) else {}
    out: Dict[str, bool] = {}

    def msg(x: Any) -> str:
        if isinstance(x, dict):
            return str(x.get("message") or x.get("code") or x)
        return str(x)

    for x in (judge.get("issues") or []) + (data.get("issues") or []):
        out.setdefault(msg(x), False)
    for x in (judge.get("blockingIssues") or []) + (data.get("blockingIssues") or []):
        out[msg(x)] = True
    return [{"message": m, "blocking": b} for m, b in list(out.items())[:40]]


@router.get("/status")
def status():
    managed = core._managed()
    command = str(core._cfg("dialectos_command") or "")
    first = "node" if managed else (shlex.split(command) or [""])[0]
    provider = str(core._cfg("provider") or "").strip().lower()
    ledger = core._load_json(core._ledger_path(), [])
    return {
        "cli": "release" if managed else "custom",
        "cli_version": core.RELEASE_VERSION if managed else None,
        "cli_installed": core.release_installed() if managed else None,
        "runner_found": bool(first and shutil.which(first)),
        "provider": provider if provider in core.PROVIDERS else "",
        "default_dialect": str(core._cfg("default_dialect")),
        "inject_on_spanish": bool(core._cfg("inject_on_spanish")),
        "ledger_entries": len(ledger) if isinstance(ledger, list) else 0,
        "limits": {"text": core.MAX_TEXT, "translated": core.MAX_OUT},
    }


@router.get("/dialects")
def dialects():
    with _DIALECTS_LOCK:
        if _DIALECTS.get("data"):
            return _DIALECTS
        try:
            res = core.list_dialects()
        except Exception as exc:
            return _err(exc)
        if res.get("ok") and isinstance(res.get("data"), list):
            _DIALECTS.update(ok=True, data=[{"code": d["code"], "name": d["name"]} for d in res["data"]])
            return _DIALECTS
        return {"ok": False, "error": res.get("error") or "dialect list unavailable"}


@router.get("/ledger")
def ledger(limit: int = Query(40, ge=1, le=200)):
    rows = core._load_json(core._ledger_path(), [])
    rows = [r for r in rows if isinstance(r, dict)] if isinstance(rows, list) else []
    by: Dict[str, Dict[str, int]] = defaultdict(lambda: {"checked": 0, "passed": 0, "blocked": 0, "advisory": 0, "calls": 0})
    for r in rows:
        d = by[str(r.get("dialect") or "?")]
        d["calls"] += 1
        if r.get("tool") == "dialectos_validate" and r.get("passed") is not None:
            d["checked"] += 1
            if r.get("passed") is True:
                d["passed"] += 1
            elif r.get("blocking_issue_count") == 0:
                d["advisory"] += 1  # did not pass, but nothing blocking
            else:
                d["blocked"] += 1  # blocking issues, or a count we cannot read
    summary = sorted(({"dialect": k, **v} for k, v in by.items()), key=lambda x: (-x["checked"], -x["calls"], x["dialect"]))
    return {"ok": True, "total": len(rows), "rows": list(reversed(rows))[:limit], "by_dialect": summary}


class DetectIn(BaseModel):
    text: str = Field(..., max_length=8000)


class ValidateIn(BaseModel):
    source: str = Field(..., max_length=8000)
    translated: str = Field(..., max_length=100_000)
    dialect: Optional[str] = Field(None, max_length=5)


class TranslateIn(BaseModel):
    text: str = Field(..., max_length=8000)
    dialect: Optional[str] = Field(None, max_length=5)
    formal: Optional[bool] = None
    check: bool = True


@router.post("/detect")
def detect(body: DetectIn):
    try:
        res = core.detect(body.text)
    except Exception as exc:
        return _err(exc)
    _record("dialectos_detect", "-", res)
    return res


def _validate(source: str, translated: str, dialect: Optional[str]) -> Dict[str, Any]:
    d = core._dialect(dialect)
    res = core.validate(translated, d, source)
    _record("dialectos_validate", d, res)
    data = res.get("data") if isinstance(res.get("data"), dict) else None
    return {"ok": bool(res.get("ok")), "error": res.get("error"), "dialect": d,
            "valid": data.get("valid") if data else None, "issues": _issues(data)}


@router.post("/validate")
def validate(body: ValidateIn):
    try:
        return _validate(body.source, body.translated, body.dialect)
    except Exception as exc:
        return _err(exc)


@router.post("/translate")
def translate(body: TranslateIn):
    try:
        d = core._dialect(body.dialect)
        res = core.translate(body.text, d, body.formal)
    except Exception as exc:
        return _err(exc)
    _record("dialectos_translate", d, res)
    if not res.get("ok"):
        return {"ok": False, "error": res.get("error") or "translation failed", "dialect": d}
    text = str(res.get("text") or res.get("data") or "").strip()
    out: Dict[str, Any] = {"ok": True, "dialect": d, "text": text}
    if body.check and text:
        try:
            out["check"] = _validate(body.text, text, d)
        except Exception as exc:
            out["check"] = _err(exc)
    return out
