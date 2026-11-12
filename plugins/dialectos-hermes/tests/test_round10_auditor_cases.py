"""Regression replay of the relevant Round 9 and Round 10 auditor cases."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

_CASE_FILE = Path(__file__).with_name("data") / "round10_auditor_cases.jsonl"
_CASES = tuple(
    json.loads(line) for line in _CASE_FILE.read_text(encoding="utf-8").splitlines()
)


@pytest.mark.parametrize(
    "case",
    [pytest.param(case, id=case["origins"][0]) for case in _CASES],
)
def test_auditor_probe_guard_verdicts(plugin, case):
    issues = plugin._guard_issues(case["source"], case["translated"])
    if case["expected"] == "BAD":
        assert issues, case
    else:
        assert issues == [], (case, issues)
