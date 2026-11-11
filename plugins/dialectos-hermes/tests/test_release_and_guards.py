"""The pinned CLI is fetched once and verified; validate blocks what the CLI misses.

No test touches the network: downloads are replaced with local tarballs.
"""
import hashlib
import io
import json
import shutil
import sys
import tarfile
import threading
import urllib.error

import pytest

from conftest import FakeCtx

CLI_JS = (
    "const a = process.argv.slice(2);\n"
    "if (a[0] === 'dialects' && a[1] === 'list') {\n"
    "  process.stdout.write(JSON.stringify([{code: 'es-MX', name: 'Mexican Spanish'}]));\n"
    "} else { process.stdout.write('?'); }\n"
)


def _tarball(path, entries):
    with tarfile.open(path, "w:gz") as tar:
        for name, data, kind in entries:
            info = tarfile.TarInfo(name)
            if kind == "symlink":
                info.type = tarfile.SYMTYPE
                info.linkname = data
                tar.addfile(info)
            else:
                raw = data.encode()
                info.size = len(raw)
                tar.addfile(info, io.BytesIO(raw))
    return path


@pytest.fixture
def release(plugin, tmp_path, monkeypatch):
    """A local stand-in for the release tarball; counts 'downloads'."""
    tgz = _tarball(tmp_path / "rel.tgz", [
        ("package/package.json", '{"name":"@dialectos/cli"}', "file"),
        ("package/dist/cli.js", CLI_JS, "file"),
    ])
    calls = []

    def fake_download(dest, timeout):
        calls.append(timeout)
        shutil.copyfile(tgz, dest)

    monkeypatch.setattr(plugin, "RELEASE_SHA256", hashlib.sha256(tgz.read_bytes()).hexdigest())
    monkeypatch.setattr(plugin, "_download_release", fake_download)
    monkeypatch.setattr(plugin, "_node_binary", lambda: "/usr/bin/node-standin")
    return {"tgz": tgz, "calls": calls}


def test_default_is_the_managed_release(plugin):
    assert plugin.DEFAULTS["dialectos_command"] == ""
    assert plugin._managed() is True


def test_the_old_npx_default_counts_as_managed(plugin):
    plugin._ctx = FakeCtx({"dialectos_command": plugin.LEGACY_NPX_COMMAND})
    assert plugin._managed() is True
    plugin._ctx = FakeCtx({"dialectos_command": "dialectos"})
    assert plugin._managed() is False
    assert plugin._cli_command(5) == ["dialectos"]


def test_release_is_downloaded_once_then_reused(plugin, release):
    first = plugin._cli_command(5)
    second = plugin._cli_command(5)
    assert first == second == ["/usr/bin/node-standin", str(plugin._release_entry())]
    assert release["calls"] == [5]
    assert plugin.release_installed() is True
    assert plugin._release_entry().read_text() == CLI_JS


def test_a_tarball_in_the_data_folder_installs_without_network(plugin, release):
    shutil.copyfile(release["tgz"], plugin._data_dir() / plugin.RELEASE_NAME)
    plugin._cli_command(5)
    assert release["calls"] == []
    assert plugin.release_installed() is True


def test_a_tampered_tarball_is_refused(plugin, release, monkeypatch):
    monkeypatch.setattr(plugin, "RELEASE_SHA256", "0" * 64)
    res = plugin.run_dialectos(["dialects", "list"])
    assert res["ok"] is False and "sha256" in res["error"]
    assert not plugin._release_dir().exists()


@pytest.mark.parametrize("entry", [
    ("../escape.js", "x", "file"),
    ("package/dist/link.js", "/etc/passwd", "symlink"),
])
def test_an_unsafe_tarball_is_refused(plugin, release, tmp_path, monkeypatch, entry):
    bad = _tarball(tmp_path / "bad.tgz", [("package/dist/cli.js", CLI_JS, "file"), entry])
    monkeypatch.setattr(plugin, "RELEASE_SHA256", hashlib.sha256(bad.read_bytes()).hexdigest())
    monkeypatch.setattr(plugin, "_download_release", lambda dest, timeout: shutil.copyfile(bad, dest))
    res = plugin.run_dialectos(["dialects", "list"])
    assert res["ok"] is False and "unsafe entry" in res["error"]
    assert not plugin._release_dir().exists()
    assert not (tmp_path / "escape.js").exists()


def test_offline_first_use_says_how_to_install(plugin, release, monkeypatch):
    def offline(dest, timeout):
        raise urllib.error.URLError("network is unreachable")

    monkeypatch.setattr(plugin, "_download_release", offline)
    res = plugin.run_dialectos(["dialects", "list"])
    assert res["ok"] is False
    assert "Offline?" in res["error"] and plugin.RELEASE_NAME in res["error"]


def test_missing_node_names_the_version(plugin, monkeypatch):
    monkeypatch.setattr(plugin.shutil, "which", lambda name: None)
    res = plugin.run_dialectos(["dialects", "list"])
    assert res["ok"] is False and "Node 22.13" in res["error"]


@pytest.mark.skipif(shutil.which("node") is None, reason="needs node")
def test_installed_release_runs_with_node(plugin, release, monkeypatch):
    monkeypatch.setattr(plugin, "_node_binary", lambda: shutil.which("node"))
    res = plugin.list_dialects()
    assert res["ok"] is True
    assert res["data"] == [{"code": "es-MX", "name": "Mexican Spanish"}]
    assert release["calls"] == [120]


# --- validate guards ----------------------------------------------------------

SRC = ("Refunds are issued within 14 days. Shipping takes 3 to 5 business days. "
       "The warranty excludes water damage and expires after 2 years.")
GOOD = ("Los reembolsos se emiten en un plazo de 14 días. El envío tarda de 3 a 5 días hábiles. "
        "La garantía excluye daños por agua y vence a los 2 años.")


@pytest.fixture
def passing_cli(fake_cli):
    fake_cli('print(json.dumps({"valid": True, "dialect": "es-MX", "blockingIssues": []}))')


def _verdict(plugin, translated, source=SRC):
    res = plugin.validate(translated, "es-MX", source)
    assert res["ok"] is True
    return res["data"]


def test_a_good_translation_still_passes(plugin, passing_cli):
    data = _verdict(plugin, GOOD)
    assert data["valid"] is True and data["blockingIssues"] == []
    assert data["pluginGuards"]["passed"] is True
    assert "not meaning" in data["pluginGuards"]["scope"]


def test_spelled_out_small_numbers_pass(plugin, passing_cli):
    data = _verdict(plugin, GOOD.replace("de 3 a 5", "de tres a cinco").replace("los 2 años", "los dos años"))
    assert data["valid"] is True


@pytest.mark.parametrize("translated", [
    "Che, solo ha sido un día largo.",
    "Os enviamos dos correos con vuestra factura.",
])
def test_valid_regional_spanish_is_not_flagged_as_italian_or_portuguese(plugin, passing_cli, translated):
    data = _verdict(plugin, translated, "Please review this short message.")
    assert data["valid"] is True
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "translated"), [
    ("You have 15 days to return the item.", "Tienes quince días para devolverlo."),
    ("The meeting starts at 3:30 PM today.", "La reunión empieza a las 15:30."),
])
def test_guards_accept_spelled_numbers_and_localized_24_hour_times(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True
    assert data["pluginGuards"]["passed"] is True


def test_dont_forget_spanish_request_is_not_treated_as_a_refusal(plugin):
    assert plugin._wants_spanish("Don't forget to reply in Spanish") is True


def test_release_install_does_not_hold_up_ledger_writes(plugin, monkeypatch):
    download_started = threading.Event()
    allow_download_to_finish = threading.Event()
    ledger_written = threading.Event()
    install_errors = []

    def slow_download(_dest, _timeout):
        download_started.set()
        assert allow_download_to_finish.wait(2)
        raise plugin.CliUnavailable("stop after lock probe")

    def install():
        try:
            plugin._ensure_release(1)
        except plugin.CliUnavailable as exc:
            install_errors.append(str(exc))

    def write_ledger():
        plugin._append_ledger({"probe": True})
        ledger_written.set()

    monkeypatch.setattr(plugin, "_download_release", slow_download)
    install_thread = threading.Thread(target=install)
    ledger_thread = threading.Thread(target=write_ledger)
    install_thread.start()
    assert download_started.wait(1)
    ledger_thread.start()
    try:
        assert ledger_written.wait(0.5), "ledger write waited for the release download"
    finally:
        allow_download_to_finish.set()
        install_thread.join(2)
        ledger_thread.join(2)
    assert not install_thread.is_alive() and not ledger_thread.is_alive()
    assert install_errors == ["stop after lock probe"]


@pytest.mark.parametrize(("source", "translated"), [
    ("El total es 1.5 euros.", "El total es 15 euros."),
    ("El total es 12 euros.", "El total es -12 euros."),
])
def test_guards_block_changed_decimal_magnitude_and_sign(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False
    assert any("Numbers from the source" in issue for issue in data["blockingIssues"])


def test_guards_accept_equivalent_grouping_and_decimal_styles(plugin, passing_cli):
    data = _verdict(plugin, "El total es 1.000,5 euros.", "El total es 1,000.5 euros.")
    assert data["valid"] is True
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize("translated, expect", [
    ("Les remboursements sont effectués sous 14 jours. La livraison prend 3 à 5 jours ouvrables. "
     "La garantie exclut les dégâts des eaux et expire après 2 ans.", "reads as French"),
    ("Os reembolsos são emitidos em 14 dias. O envio leva de 3 a 5 dias úteis. "
     "A garantia não cobre danos por água e expira após 2 anos.", "reads as Portuguese"),
    (GOOD.replace("14", "41").replace("de 3 a 5", "de 30 a 50"), "Numbers from the source"),
    ("Los reembolsos se emiten en un plazo de 14 días.", "part of it may be missing"),
    ("Me gusta el helado de vainilla.", "Numbers from the source"),
])
def test_guards_block_what_the_cli_passes(plugin, passing_cli, translated, expect):
    data = _verdict(plugin, translated)
    assert data["valid"] is False
    assert any(expect in m for m in data["blockingIssues"])
    assert data["pluginGuards"]["passed"] is False


def test_guards_ignore_numbers_inside_code_and_links(plugin, passing_cli):
    src = "Open https://example.com/v2/docs and run `npm i -g pkg@4` before you read the guide again today."
    dst = "Abre https://example.com/v2/docs y ejecuta `npm i -g pkg@4` antes de leer la guía otra vez hoy."
    assert _verdict(plugin, dst, src)["valid"] is True


def test_guards_never_turn_a_cli_failure_into_a_pass(plugin, fake_cli):
    fake_cli('print(json.dumps({"valid": False, "blockingIssues": ["Negation was dropped"]})); sys.exit(1)')
    data = _verdict(plugin, GOOD)
    assert data["valid"] is False and data["blockingIssues"] == ["Negation was dropped"]


def test_the_ledger_counts_guard_failures(plugin, passing_cli):
    res = plugin.validate("Los reembolsos se emiten en un plazo de 14 días.", "es-MX", SRC)
    plugin._on_post_tool("dialectos_validate", {"dialect": "es-MX"}, json.dumps(res))
    row = json.loads(plugin._ledger_path().read_text())[-1]
    assert row.get("passed") is False or row.get("valid") is False
