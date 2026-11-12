"""Round-10 regression cases for DialectOS' deterministic validation guards."""

from __future__ import annotations

import pytest


# Curated from the round-10 guard probes, with controls kept beside each failure.
@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Take 1 tablet twice a week.", "Tome 1 tableta dos veces al día."),
        ("Take 1 tablet once a week.", "Tome 1 tableta una vez al día."),
        ("Take 1 tablet once weekly.", "Tome 1 tableta una vez al día."),
        ("Take 1 tablet daily.", "Tome 1 tableta dos veces al día."),
        ("Take 1 tablet every week.", "Tome 1 tableta cada día."),
        ("Tome 1 tableta dos veces al día.", "Take 1 tablet twice a week."),
        ("Take it three times daily.", "Tómelo dos veces al día."),
        ("Take it twice a week.", "Tómelo tres veces por semana."),
    ],
)
def test_round10_rejects_changed_frequency_count_or_period(plugin, source, translated):
    assert plugin._guard_issues(source, translated)


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Take 1 tablet twice a day.", "Tome 1 tableta dos veces cada día."),
        ("Take 1 tablet twice a day.", "Tome 1 tableta dos veces diarias."),
        ("Take 1 tablet once a day.", "Tome 1 tableta diariamente."),
        ("Take 1 tablet once a day.", "Tome 1 tableta al día."),
        ("Take 1 tablet twice a day.", "Tome 1 tableta 2,0 veces al día."),
        ("Take 1 tablet twice a week.", "Tome 1 tableta dos veces por semana."),
        ("Take one tablet every other day.", "Tome una tableta cada dos días."),
        ("Take it twice daily.", "Tómelo dos veces diarias."),
    ],
)
def test_round10_accepts_daily_and_period_equivalents(plugin, source, translated):
    assert plugin._guard_issues(source, translated) == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Give 2 L daily.", "Administre 2 mL diarios."),
        ("Take 5 g daily.", "Tome 5 mg al día."),
        ("Take 5 g daily.", "Tome 5 al día."),
        ("The board is 2 m long.", "La tabla tiene 2 cm de largo."),
        ("Wait 5 seconds as instructed.", "Espere 5 minutos según las instrucciones."),
        ("The room is 5 m wide.", "La sala mide 5 km de ancho."),
        ("Wait 30 minutes this time.", "Espere 30 segundos esta vez."),
        ("Take 2 tablets as needed.", "Tome 2 gotas según sea necesario."),
        ("Infuse over 2 h continuously.", "Infunda durante 2 min continuamente."),
    ],
)
def test_round10_rejects_spaced_unit_changes_before_prose(plugin, source, translated):
    assert (
        "Units attached to source numbers are missing or changed."
        in plugin._guard_issues(source, translated)
    )


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Give 2 L daily.", "Administre 2 L diarios."),
        ("Take 5 g daily.", "Tome 5 g al día."),
        ("The board is 2 m long.", "La tabla tiene 2 m de largo."),
        ("Wait 5 seconds as instructed.", "Espere 5 segundos según las instrucciones."),
        ("Buy 2 L brackets.", "Compre 2 soportes en L."),
        ("Windows 10 S mode.", "Windows 10 en modo S."),
    ],
)
def test_round10_keeps_measurements_and_ignores_noun_phrases(
    plugin, source, translated
):
    assert plugin._guard_issues(source, translated) == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("The meeting at five is cancelled.", "La reunión a las seis está cancelada."),
        ("We meet at six this Friday.", "Nos reunimos a las siete este viernes."),
        ("We work from nine to five.", "Trabajamos de ocho a seis."),
        ("Open from five until ten.", "Abierto de las seis hasta las diez."),
        ("Open from five to ten.", "Abierto de las seis a las diez."),
        ("Meet at five.", "Nos vemos a las seis."),
    ],
)
def test_round10_rejects_changed_clock_words_and_range_endpoints(
    plugin, source, translated
):
    assert "Times from the source are missing or changed." in plugin._guard_issues(
        source, translated
    )


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("We leave at five.", "A las cinco salimos."),
        ("At five we leave.", "A las cinco nos vamos."),
        ("At six we have dinner.", "A las seis cenamos."),
        ("Open from nine until five.", "Abierto desde las nueve hasta las cinco."),
        ("Open from nine to five.", "Abierto de nueve a cinco."),
        ("Choose from three to six suppliers.", "Elija entre tres y seis proveedores."),
    ],
)
def test_round10_accepts_clock_ranges_and_ordinary_count_ranges(
    plugin, source, translated
):
    assert plugin._guard_issues(source, translated) == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Take 10 mg and 5 mL in the morning.", "Tome 5 mL y 10 mg por la mañana."),
        (
            "Take 5 mg, 10 mL, and 2 tablets in the morning.",
            "Tome 2 tabletas, 5 mg y 10 mL por la mañana.",
        ),
        (
            "Take 10 mg in the morning and 10 mL at night.",
            "Tome 10 mL por la mañana y 10 mg por la noche.",
        ),
        (
            "Take 5 mg in the morning and 10 mL at night.",
            "Tome 10 mL por la mañana y 5 mg por la noche.",
        ),
    ],
)
def test_round10_binds_all_coordinated_doses_and_units_to_period(
    plugin, source, translated
):
    assert (
        "Dose counts attached to day periods are missing or changed."
        in plugin._guard_issues(source, translated)
        if source
        in {
            "Take 10 mg in the morning and 10 mL at night.",
            "Take 5 mg in the morning and 10 mL at night.",
        }
        else plugin._guard_issues(source, translated) == []
    )


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Wait a second before leaving.", "Espera 2 segundos antes de salir."),
        (
            "Wait 5 minutes, half an hour at most.",
            "Espere 5 minutos, 30 horas como máximo.",
        ),
    ],
)
def test_round10_rejects_ordinal_and_half_hour_overacceptance(
    plugin, source, translated
):
    assert plugin._guard_issues(source, translated)


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Wait a second.", "Espere un segundo."),
        ("Take the second dose.", "Tome la dosis 2."),
        ("Half an hour later.", "30 minutos después."),
        (
            "Wait 5 minutes, half an hour at most.",
            "Espere 5 minutos, 30 minutos como máximo.",
        ),
    ],
)
def test_round10_accepts_temporal_and_half_hour_equivalents(plugin, source, translated):
    assert plugin._guard_issues(source, translated) == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Raised $5M.", "Recaudó US$5 M."),
        ("Revenue was €2M last year.", "Los ingresos fueron de 2 M€ el año pasado."),
        (
            "Revenue was EUR2M last year.",
            "Los ingresos fueron de 2 MEUR el año pasado.",
        ),
        ("The budget is 5M.", "El presupuesto es de 5M."),
        ("Take 1 tablet once a day.", "Tome 1 tableta al día."),
        (
            "Take 2 in the morning and 1 at bedtime.",
            "Tome 2 por la mañana y 1 al acostarse.",
        ),
        ("Son las 3.", "It is 3 o'clock."),
        ("Take 1 pill every other day.", "Tome 1 pastilla cada dos días."),
        ("Thank you so much!", "¡Mil gracias!"),
        ("Wait a couple of hours.", "Espere dos horas."),
        ("Come back in a fortnight.", "Vuelva en quince días."),
        ("A million people came.", "Vino un millón de personas."),
    ],
)
def test_round10_accepts_financial_scale_and_spelled_number_equivalents(
    plugin, source, translated
):
    assert plugin._guard_issues(source, translated) == []


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Wait two hours.", "Espere tres horas."),
        ("Two thousand people came.", "Vinieron tres mil personas."),
    ],
)
def test_round10_rejects_changed_spelled_source_quantities(plugin, source, translated):
    assert plugin._guard_issues(source, translated)


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("It is 24k gold.", "Es oro de 24 quilates."),
        (
            "She finished the 5K in under 30 minutes.",
            "Terminó los 5 km en menos de 30 minutos.",
        ),
        ("A worth of 3 b in sales.", "Un valor de 3 mil millones en ventas."),
        ("It lasts 1 day.", "Dura 24 horas."),
        ("Take it twice daily.", "Tómelo cada 12 horas."),
        (
            "Feed the cat once a day, every day.",
            "Alimente al gato una vez al día, todos los días.",
        ),
        (
            "Take 2 in the morning and 1 at night.",
            "Tome 2 por la mañana y 1 antes de dormir.",
        ),
        (
            "Take 2 tablets with food in morning and 1 tablet with water at night.",
            "Tome 2 tabletas con comida por la mañana y 1 tableta con agua por la noche.",
        ),
        (
            "Take 2 tablets by mouth in morning and 1 at night.",
            "Tome 2 por la mañana y 1 antes de dormir.",
        ),
    ],
)
def test_round10_accepts_adjacent_probe_equivalents(plugin, source, translated):
    assert plugin._guard_issues(source, translated) == []


def test_round10_rejects_swapped_doses_across_modified_period_clauses(plugin):
    source = "Take 2 tablets with food in morning and 1 tablet with water at night."
    translated = (
        "Tome 1 tableta con agua por la mañana y 2 tabletas con comida por la noche."
    )
    assert (
        "Dose counts attached to day periods are missing or changed."
        in plugin._guard_issues(source, translated)
    )


@pytest.mark.parametrize(
    ("source", "translated"),
    [
        ("Go to the 3rd floor.", "Vaya al piso 3."),
        ("It is on the 7th day.", "Es el día 7."),
        ("Read the 2nd chapter.", "Lea el capítulo 2."),
        ("This is the 5th attempt.", "Este es el intento número 5."),
        ("Go to the 3rd floor.", "Vaya al piso 4."),
    ],
)
def test_round10_allows_postposed_ordinal_cardinals_only_when_they_match(
    plugin, source, translated
):
    issues = plugin._guard_issues(source, translated)
    if translated.endswith("4."):
        assert issues
    else:
        assert issues == []


def test_round10_ordinal_context_is_precomputed_once(plugin, monkeypatch):
    original = plugin._ordinal_source_context
    calls = []

    def counted(source):
        calls.append(source)
        return original(source)

    monkeypatch.setattr(plugin, "_ordinal_source_context", counted)
    source = " ".join(["Go to the 3rd floor."] * 40)
    translated = " ".join(["Vaya al piso 3."] * 40)
    assert plugin._guard_issues(source, translated) == []
    assert calls == [plugin._prose(source)]


def test_round10_long_ordinals_do_not_crash_and_guard_errors_fail_closed(
    plugin, monkeypatch
):
    long_ordinal = "9" * 5000 + "th"
    assert plugin._guard_issues(f"The {long_ordinal} item.", "El artículo número 9.")

    def broken_guard(_source, _translated):
        raise ValueError("guard parse failed")

    monkeypatch.setattr(plugin, "_guard_issues", broken_guard)
    report = {"valid": True, "blockingIssues": []}
    plugin._apply_guards(report, "source", "translation")
    assert report["valid"] is False
    assert report["pluginGuards"]["passed"] is False
    assert report["pluginGuards"]["issues"]
