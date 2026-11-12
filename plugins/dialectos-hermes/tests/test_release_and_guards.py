"""The pinned CLI is fetched once and verified; validate blocks what the CLI misses.

No test touches the network: downloads are replaced with local tarballs.
"""
import hashlib
import io
import json
import shutil
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


@pytest.mark.parametrize(("source", "translated"), [
    ("Take twenty-one tablets.", "Tome 1 comprimido."),
    ("Wait two hundred twenty-one days.", "Espera 21 días."),
])
def test_spelled_number_suffixes_are_not_whole_quantities(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False


def test_compound_english_number_aliases_accumulate_without_grammatical_forms(
    plugin, passing_cli
):
    assert "one hundred and one" in plugin._EN_SPELLED["101"]
    assert "one hundred and twelve" in plugin._EN_SPELLED["112"]
    assert "one hundred once" not in plugin._EN_SPELLED["101"]
    assert "one hundred and once" not in plugin._EN_SPELLED["101"]
    assert "one hundred dozen" not in plugin._EN_SPELLED["112"]
    assert "one hundred and dozen" not in plugin._EN_SPELLED["112"]
    data = _verdict(plugin, "Espera 101 días.", "Wait one hundred and one days.")
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


@pytest.mark.parametrize(("source", "translated", "expected_valid"), [
    ("10ml", "20ml", False),
    ("10ml", "10 ml", True),
    ("500MB", "900MB", False),
    ("500MB", "500 MB", True),
    ("100cm", "200cm", False),
    ("100cm", "100 cm", True),
    ("5cm", "5 cm", True),
    ("100MB", "100 MB", True),
    ("Wait 30min.", "Espera 30 min.", True),
    ("60fps", "60 fps", True),
    ("220V", "220 V", True),
    ("5lbs", "5 lbs", True),
    ("3GHz", "3 GHz", True),
    ("100W", "100 W", True),
    ("It costs $10k.", "Cuesta $10 mil.", True),
])
def test_attached_units_keep_numbers_in_validation(
    plugin, passing_cli, source, translated, expected_valid
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is expected_valid
    assert data["pluginGuards"]["passed"] is expected_valid


def test_bare_celsius_unit_keeps_source_number(plugin):
    assert plugin._guard_issues("Heat to 180C.", "Caliente a 180 °C.") == []
    assert plugin._guard_issues("Heat to 180C.", "Caliente a 280 °C.")


@pytest.mark.parametrize(("source", "translated"), [
    ("The party is on May 1st.", "La fiesta es el 1 de mayo."),
    ("4th of July", "4 de julio"),
    ("November 5th, 2026", "5 de noviembre de 2026"),
    ("Take 10mg twice a day.", "Tome 10 mg dos veces al día."),
    ("5km", "5 km"),
    ("2GB", "2 GB"),
    ("3rd floor", "3.er piso"),
    ("1st place", "1.er lugar"),
    ("In the 1990s.", "En los años 90."),
    ("Twenty-five", "25"),
    ("Three hundred", "300"),
    ("once a day", "1 vez al día"),
])
def test_r5_1_source_number_forms_are_preserved(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "translated"), [
    ("Go to the 2nd floor.", "Ve al segundo piso."),
    ("Second floor.", "Piso 2."),
    ("Take the second dose.", "Tome la dosis 2."),
    ("Art of the 21st century.", "Arte del siglo XXI."),
    ("It is her 3rd attempt.", "Es su tercer intento."),
    ("This is the 4th time.", "Es la cuarta vez."),
    ("The 5th page.", "La quinta página."),
    ("The 6th attempt.", "El sexto intento."),
    ("The 7th floor.", "La séptima planta."),
    ("The 8th time.", "La octava vez."),
    ("The 9th chapter.", "El noveno capítulo."),
    ("The 10th anniversary.", "El décimo aniversario."),
    ("The 20th anniversary.", "El vigésimo aniversario."),
    ("Twenty-first floor.", "Piso 21."),
])
def test_ordinal_numbers_allow_spanish_ordinals_and_century_roman_numerals(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "translated"), [
    ("Two thousand people came.", "Vinieron 2000 personas."),
    ("One thousand two hundred users.", "1200 usuarios."),
    ("In the 1990s.", "En los años 1990."),
    ("In the 1990s.", "En los años 90."),
    ("Twice a day.", "2 veces al día."),
])
def test_thousands_decades_and_twice_match_numeric_translations(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "translated"), [
    ("Open from 9 am to 5 pm.", "Abierto de 9 a 17 horas."),
])
def test_spanish_time_ranges_accept_full_hour_word(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "translated"), [
    ("Meet at noon.", "Nos vemos al mediodía."),
    ("The shop closes at midnight.", "La tienda cierra a medianoche."),
    ("The shop closes at midnight.", "La tienda cierra a la medianoche."),
    ("Call me at five pm.", "Llámame a las cinco de la tarde."),
    ("Open from 8 in the morning until 5 in the afternoon.",
     "Abierto de 8 de la mañana a 5 de la tarde."),
    ("Come before 6 in the evening.", "Ven antes de las 6 de la tarde."),
    ("The meeting is at 5 pm.", "La reunión es sobre las 17 h."),
    ("Arrive before 5 pm.", "Llegue antes de las 17 h."),
    ("It is 5 pm.", "Son las 17 h."),
])
def test_english_and_spanish_standard_times_match(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]
    assert data["pluginGuards"]["passed"] is True


@pytest.mark.parametrize(("source", "expected"), [
    ("Open from 8 in the morning.", [8 * 60]),
    ("Stay until 5 in the afternoon.", [17 * 60]),
    ("Come before 6 in the evening.", [18 * 60]),
    ("Leave after 5 in the afternoon.", [17 * 60]),
    ("Finish by 4 in the evening.", [16 * 60]),
    ("Meet around 3 in the afternoon.", [15 * 60]),
])
def test_english_day_period_times_accept_common_cues(plugin, source, expected):
    assert [minute for minute, _ in plugin._time_matches(source)] == expected


@pytest.mark.parametrize(("source", "translated"), [
    ("Take 2 tablets with a glass of water.", "Tome 1 tableta con 2 vasos de agua."),
    ("Take the pills with a meal.", "Tome 1 pastilla con la comida."),
    ("Wait an hour.", "Espera 1 hora y 1 hora."),
])
def test_articles_before_nonunits_do_not_hide_extra_numbers(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False


@pytest.mark.parametrize("source", [
    "Take 2 in the morning and 1 at night.",
    "Give 5 in the evening.",
])
def test_r5_2_dose_counts_are_not_parsed_as_times(plugin, source):
    assert plugin._time_matches(source) == []


@pytest.mark.parametrize(("text", "source_minutes", "expected"), [
    ("Las 8 horas de sueño importan.", [8 * 60], []),
    ("Durante las 3 horas siguientes, descanse.", [3 * 60], []),
    ("El turno dura 15 horas y empieza a las 15 h.", [15 * 60], [15 * 60]),
])
def test_r5_3_duration_hours_are_not_parsed_as_times(plugin, text, source_minutes, expected):
    assert [minute for minute, _ in plugin._time_matches(text, source_minutes)] == expected


@pytest.mark.parametrize(("source", "translated"), [
    ("Open from 9 am to 5 pm.", "Abierto de 9 a 17 h."),
    ("at five pm", "a las 17:00"),
    ("at noon", "a las 12:00"),
    ("It is -5 °C.", "Hace 5 °C bajo cero."),
    ("Version 2.10 is out.", "Ya salió la v2.10."),
])
def test_r5_4_standard_times_temperatures_and_versions_pass(plugin, passing_cli, source, translated):
    if source == "Open from 9 am to 5 pm.":
        actual = sorted(minute for minute, _ in plugin._time_matches(translated, [9 * 60, 17 * 60]))
        assert actual == [9 * 60, 17 * 60]
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]
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


@pytest.mark.parametrize(("source", "translated"), [
    ("Open 9-5", "Open 9-6"),
    ("Call 555-1234 now.", "Call 555-9999 now."),
    ("Range 10-20", "Range 10-99"),
    ("The date is 2020-2024.", "The date is 2020-2031."),
    ("Take 1-2 tablets every 4-6 hours.", "Take 1-8 tablets every 4-12 hours."),
    ("The date is 2026-11-11.", "The date is 2026-12-25."),
    ("Use code B-12.", "Use code B-13."),
    ("The rate is 0.125 euros.", "The rate is 125 euros."),
    ("Meet at 5 PM.", "Meet at 5 AM."),
    ("Meet at 3:30 PM.", "Meet at 3:30 AM."),
    ("Meet at 3:30 PM.", "Meet at 03:30."),
    ("Use release 2.10.", "Usa la versión 2.1."),
    ("Enter code 0042.", "Ingresa el código 42."),
    ("Meet at 4 pm.", "Nos vemos a las 4 de la mañana."),
    ("Meet at 9 pm.", "Nos vemos a las 9 de la tarde y 9 de la noche."),
    # "un/una" must not hide a dose the translation added (roast r4).
    ("Take 1 tablet with water.", "Tome 2 comprimidos con un vaso de agua."),
    ("Take 1 tablet.", "Tome 3 comprimidos una vez."),
    ("Wait 4 hours.", "Espera 4 horas, o 6 horas."),
    ("100 days", "ciento veinte días"),
    ("Take twenty-one tablets.", "Tome 20 comprimidos."),
    ("Wait two hundred days.", "Espera 100 días."),
    ("Wait two hundred twenty-one days.", "Espera 200 días."),
    ("Wait one hundred twenty-one days.", "Espera 100 días."),
    ("The rate is 1.125 euros.", "La tarifa es 1125 euros."),
    ("The rate is 1.125 euros.", "La tarifa es 1.125,00 euros."),
])
def test_adversarial_numbers_and_times_are_not_lost(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False


@pytest.mark.parametrize(("source", "translated"), [
    ("The event is on March 3rd.", "El evento es el 3 de marzo."),
    ("2nd floor", "2.º piso"),
    ("due on the 15th", "el día 15"),
    ("Wait an hour.", "Espera 1 hora."),
    ("Wait a day.", "Espera 1 día."),
    ("Wait a week.", "Espera 1 semana."),
    ("Once a day", "1 vez al día"),
    ("Twenty-one days", "21 días"),
    # Decades should be localized as decades; the old En 1990 expectation was incorrect.
    ("In the 1990s", "En los años 90."),
    ("one hundred twenty", "120"),
    ("The store opens at 10am.", "La tienda abre a las 10 a. m."),
    ("Meet at 3:30 PM.", "Reúnete a las 3:30 p. m."),
    ("Sleep for 8 hours a night.", "Duerma las 8 horas por noche."),
    ("Fast for the next 2 hours.", "Ayuna durante las 2 horas siguientes."),
    ("At 5 pm, wait 17 hours.", "A las 17 h, espera 17 horas."),
    ("It is 1 hour long and starts at 1 am.", "Dura 1 hora y empieza a la 1 h."),
    ("It is -5 degrees.", "Hace 5 grados bajo cero."),
    ("It is -5 degrees.", "Hace −5 grados."),
    ("There are 31 pages.", "Hay treinta y una páginas."),
    ("There are 100 pages.", "Hay cien páginas."),
    ("There are 1,000 pages.", "Hay mil páginas."),
    ("Take twenty-one tablets.", "Tome 21 comprimidos."),
    ("Wait two hundred days.", "Espera 200 días."),
    ("Wait two hundred twenty-one days.", "Espera 221 días."),
    ("Wait one hundred twenty-one days.", "Espera 121 días."),
    ("Meet at 17 h.", "Reúnete a las 17 horas."),
    ("Call me at 5 pm.", "Llámame a las 17 h."),
    ("Come between 3 and 4 pm.", "Ven entre las 3 y las 4 de la tarde."),
    ("Lunch is at 12 pm.", "El almuerzo es a las 12 del mediodía."),
    ("Dinner at 9:30 pm.", "Cena a las 9:30 de la noche."),
    ("The shift ends at 12 am.", "El turno termina a las 12 de la noche."),
    ("Leave at 6 am.", "Sal a las 6 de la mañana."),
    # Durations are numbers, not clock times (roast r4).
    ("Take 1-2 tablets every 4-6 hours.", "Tome 1-2 comprimidos cada 4-6 horas."),
    ("Wait 2 hours.", "Espera 2 horas."),
    ("It takes 10 hours.", "Tarda 10 h."),
    ("It lasts 1 hour.", "Dura 1 hora."),
    ("The store opens at 14:00.", "La tienda abre a las 14 h."),
    ("The store opens at 14:00.", "La tienda abre 14 h."),
    ("Dose: 0.500 mg.", "Dosis: 0,5 mg."),
    ("Take three tablets.", "Tome 3 comprimidos."),
    ("Rated 100 percent.", "Calificado ciento por ciento."),
    ("Total is 1.5 euros.", "El total es 1,50 euros."),
    ("The rate is 1.125 euros.", "La tarifa es 1,125 euros."),
    ("There are 1,125 pages.", "Hay 1.125 páginas."),
    ("There are 1,125 pages.", "Hay 1125 páginas."),
    ("Upgrade to version 2.10.", "Actualiza a la versión 2.10."),
    # Roast r4 (Fable): durations, English day periods and leading zeros.
    ("The trip takes 3 hours.", "El viaje dura 3 horas."),
    ("Take one tablet every 6 hours.", "Tome un comprimido cada 6 horas."),
    ("Support replies within 12 hours.", "El soporte responde en 12 horas."),
    ("It lasts 1.5 hours.", "Dura 1,5 horas."),
    ("I worked 5 hours at 3 pm.", "Trabajé 5 horas a las 15:00."),
    ("Come at 8 in the morning.", "Ven a las 8 de la mañana."),
    ("Call at 9 at night.", "Llama a las 21:00."),
    ("Meeting on 05/03/2026.", "Reunión el 5/3/2026."),
])
def test_equivalent_signed_and_spelled_numbers_pass(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True
    assert data["pluginGuards"]["passed"] is True


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


@pytest.mark.parametrize(("source", "translated"), [
    ("Wait 2 seconds before retrying.", "Espere un segundo antes de volver a intentarlo."),
    ("Take 2 doses.", "Tome la segunda dosis."),
    ("Give the 5 tablets.", "Dé la quinta tableta."),
    ("Book 4 rooms.", "Reserve un cuarto."),
    ("Add 3 eggs.", "Agregue el tercer huevo."),
    ("The 20 children.", "El vigésimo niño."),
    ("Take 3 tablets.", "Tome un tercer comprimido."),
])
def test_cardinal_source_numbers_do_not_match_spanish_ordinal_words(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False


@pytest.mark.parametrize(("source", "translated"), [
    ("Take two and rest.", "Tome 2 y descanse."),
    ("Take 2 and rest.", "Tome dos y descanse."),
    ("Between five and seven people.", "Entre 5 y 7 personas."),
    ("Give one now and one later.", "Dé 1 ahora y 1 después."),
    ("Wait one second.", "Espere 1 segundo."),
    ("Three first aid kits.", "3 botiquines de primeros auxilios."),
    ("Read chapters one and two.", "Lea los capítulos 1 y 2."),
    ("Use four and a half cups.", "Use 4 tazas y media."),
])
def test_conjunctions_and_half_phrases_do_not_join_cardinal_numbers(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


@pytest.mark.parametrize(("source", "translated"), [
    ("Wait a second.", "Espere 2 minutos."),
    ("On second thought, take one.", "Pensándolo bien, tome 2."),
    ("A third of patients improved.", "3 pacientes mejoraron."),
])
def test_english_ordinal_words_do_not_match_cardinal_counts(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False


@pytest.mark.parametrize(("source", "translated"), [
    ("Wait 2 days.", "Espera treinta y dos días."),
    ("Wait 30 days.", "Espera ciento treinta días."),
    ("The 20th floor.", "La vigésima primera planta."),
])
def test_complete_spanish_number_phrases_are_compared(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is False


@pytest.mark.parametrize(("source", "translated", "expected_valid"), [
    ("Limit: 100bytes.", "Límite: 900bytes.", False),
    ("Walk 10miles.", "Camina 20miles.", False),
    ("Wait 10hours.", "Espera 10 horas.", True),
    ("Take 500µg daily.", "Tome 500 mg al día.", False),
    ("Take 10ml.", "Tome 10 l.", False),
    ("Wait 30min.", "Espera 30 h.", False),
    ("Take 5mg daily.", "Tome 5 g al día.", False),
    ("Set to 20°C.", "Fije a 20 °F.", False),
    ("10mg", "10 mg", True),
])
def test_attached_unit_names_are_preserved_and_compared(
    plugin, passing_cli, source, translated, expected_valid
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is expected_valid, data["blockingIssues"]


def test_articles_are_consumed_at_the_matching_occurrence(plugin, passing_cli):
    data = _verdict(
        plugin,
        "Tome 1 comprimido con 2 comidas y 1 taza de agua.",
        "Take 2 tablets with a meal and a cup of water.",
    )
    assert data["valid"] is False
    assert data["pluginGuards"]["passed"] is False


@pytest.mark.parametrize(("source", "translated"), [
    ("Come at three in the afternoon.", "Ven a las tres de la tarde."),
    ("We open at eight in the morning.", "Abrimos a las ocho de la mañana."),
    ("Dinner is at nine at night.", "La cena es a las nueve de la noche."),
    ("He left at one in the morning.", "Se fue a la una de la madrugada."),
    ("We meet at three o'clock.", "Nos vemos a las tres."),
    ("At midday.", "Al mediodía."),
])
def test_spelled_clock_times_match_between_languages(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


def test_afternoon_class_counts_are_not_clock_times(plugin, passing_cli):
    assert plugin._time_matches("Two of the afternoon classes are full.") == []


@pytest.mark.parametrize(("source", "translated"), [
    ("Add 2 tablets after 1 in the morning dose.", "Agregue 2 tabletas después de la dosis de la 1 de la mañana."),
    ("Take 2 tablets before 8 in the morning meal.", "Tome 2 tabletas antes de la comida de las 8 de la mañana."),
])
def test_day_period_followed_by_a_noun_is_not_a_clock_time(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


@pytest.mark.parametrize(("source", "translated"), [
    ("It is 2x faster.", "Es el doble de rápido."),
    ("In the 90s.", "En la década de 1990."),
])
def test_multipliers_and_short_decades_keep_their_readings(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


@pytest.mark.parametrize(("source", "translated"), [
    ("Take a pill every 8 hours.", "Tome 1 pastilla cada 8 horas."),
    ("Take a tablet daily.", "Tome 1 tableta al día."),
    ("Apply a drop in each eye.", "Aplique 1 gota en cada ojo."),
    ("A single dose.", "1 dosis."),
])
def test_articles_before_dose_nouns_count_as_one(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


def test_english_thousand_aliases_are_built_on_demand(plugin):
    assert len(plugin._EN_SPELLED) < 1100
    normalized = " ten thousand steps "
    assert plugin._spelled_alone("ten thousand", normalized)


@pytest.mark.parametrize(("source", "translated"), [
    ("Open between 9 am and 5 pm.", "Abre entre las 9 y las 17 h."),
    ("Costs 10k dollars.", "Cuesta 10 000 dólares."),
    ("Twenty twenty-six.", "2026."),
    ("Ten thousand steps.", "10 000 pasos."),
])
def test_alternative_clock_ranges_years_and_ten_thousand_match(
    plugin, passing_cli, source, translated
):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


def test_dose_numbers_remain_attached_to_their_day_period(plugin, passing_cli):
    data = _verdict(
        plugin,
        "Tome 1 por la mañana y 2 por la noche.",
        "Take 2 in the morning and 1 at night.",
    )
    assert data["valid"] is False


def test_half_an_hour_is_not_one_hour(plugin, passing_cli):
    data = _verdict(plugin, "1 hora.", "Half an hour.")
    assert data["valid"] is False


@pytest.mark.parametrize(("source", "translated"), [
    ("Meet at noon.", "Nos vemos a mediodía."),
    ("It is 5 pm.", "Son las 17 horas."),
])
def test_additional_spanish_time_spellings_match(plugin, passing_cli, source, translated):
    data = _verdict(plugin, translated, source)
    assert data["valid"] is True, data["blockingIssues"]


@pytest.mark.parametrize(
    ("source", "translated", "expected_valid"),
    [
        ("Call 5551234567.", "Llame al 5551234568.", False),
        ("One million users.", "1 000 000 usuarios.", True),
        ("One million users.", "Un millón de usuarios.", True),
        ("Population: eight million users.", "Población: 8 000 000 usuarios.", True),
        ("Three billion users.", "3 000 000 000 usuarios.", True),
        ("Wait 5ms.", "Espera 50ms.", False),
        ("Storage: 1TB.", "Almacenamiento: 2TB.", False),
        ("Set to 1080p.", "Ajústalo a 720p.", False),
        ("Take 10IU.", "Tome 100IU.", False),
        ("Take 2x faster.", "Tome 3x más rápido.", False),
        ("Take 2x faster.", "Tome 2 veces más rápido.", True),
        ("Take 5mg daily.", "Tome cinco miligramos al día.", True),
        ("Walk 10miles.", "Camina diez millas.", True),
        ("Wait 30min.", "Espera treinta minutos.", True),
        (
            "Take 2 in the morning and 1 at night.",
            "Tome dos en la mañana y uno en la noche.",
            True,
        ),
        (
            "Take 2 tablets in the morning and 1 at night.",
            "Tome dos comprimidos por las mañanas y uno por las noches.",
            True,
        ),
        ("Take 2 in the morning.", "Tome 2 cada mañana.", True),
        ("Take 2 in the morning.", "Tome 2 a la mañana.", True),
        ("Take 2 in the morning.", "Tome 2 de mañana.", True),
        ("Take 2 in the evening.", "Tome 2 por la tarde.", True),
        (
            "Take 2 in the morning and 1 at night.",
            "Tome 1 por la mañana y 2 por la noche.",
            False,
        ),
        ("The twenty-first floor.", "El piso 1.", False),
        ("The first floor.", "El piso 1 y el piso 1.", False),
        ("On July 4th.", "El cuatro de julio.", True),
        ("The third trimester.", "El 3.er trimestre.", True),
        ("The twenty-first century.", "El siglo XXI.", True),
        ("The 20th century.", "El siglo veinte.", True),
        ("The second edition.", "La 2.ª edición.", True),
        ("Give it to the three girls.", "Dáselo a las tres chicas.", True),
        ("She spoke to the two nurses.", "Habló a las dos enfermeras.", True),
        ("See you at five.", "Nos vemos a las cinco.", True),
        ("Wait until 3 in the afternoon.", "Espera hasta las tres de la tarde.", True),
        ("Wait 2 days.", "Espera doscientos dos días.", False),
        ("Wait 30 days.", "Espera doscientos treinta días.", False),
        ("Wait 2 days.", "Espera doscientas dos jornadas.", False),
        ("Wait 200 days.", "Espera doscientas jornadas.", True),
        ("Wait 500 pages.", "Espera quinientas páginas.", True),
        ("About 50 thousand people.", "Unas 50 mil personas.", True),
        ("About 50 thousand people.", "Unas 60 mil personas.", False),
        ("3 billion users.", "3 mil millones de usuarios.", True),
        ("3 billion users.", "3 million users.", False),
        ("Run a 5K on Sunday.", "Corre 5 km el domingo.", True),
        ("It costs $5M.", "Cuesta 5 millones de dólares.", True),
        ("80s music.", "Música de los 80.", True),
        ("In her 30s.", "En sus 30.", True),
        ("50c.", "50 centavos.", True),
        ("Heat to 180C.", "Calienta a 180 grados.", True),
        ("Use 2kg and 16GB.", "Usa 2 kilos y 16 gigas.", True),
        ("Take 5 mg daily.", "Tome 5 g al día.", False),
        ("500 mcg.", "500 mg.", False),
        ("Set to 20 °C.", "Ajústalo a 20 °F.", False),
        ("It is 2x faster.", "Es 3 veces más rápido.", False),
        ("It is 2x faster.", "Es el doble de rápido.", True),
        ("It is 3x faster.", "Es el triple de rápido.", True),
        ("A 2.5k run.", "Una carrera de 2500 metros.", True),
        ("It is 3 in the afternoon now.", "Ahora son las tres de la tarde.", True),
        ("In the 2010s.", "En 10 años.", False),
        ("20°C.", "20 grados centígrados.", True),
        ("20°C.", "20ºC.", True),
        ("3kg.", "3 kilos.", True),
        ("Take 2tabs.", "Tome 2 tabletas.", True),
    ],
)
def test_r8_numeric_guard_regressions(plugin, source, translated, expected_valid):
    issues = plugin._guard_issues(source, translated)
    if expected_valid:
        assert not issues, issues
    else:
        assert issues, "expected a guard failure"
