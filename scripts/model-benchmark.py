#!/usr/bin/env python3
"""
DialectOS Model Benchmark — tests local inference models for Spanish dialect translation quality.

⛔ DO NOT RUN AUTOMATICALLY. This script hits your home inference server via Tailscale.
   Run only when explicitly testing models. Takes 5-15 minutes depending on model count.

Usage:
  python3 scripts/model-benchmark.py
  python3 scripts/model-benchmark.py --models qwen3.5-4b qwen3.5-2b
  python3 scripts/model-benchmark.py --baseline qwen3.5-4b

Output:
  - STDOUT: live progress
  - benchmark_results.json: raw results
  - benchmark_report.md: human-readable comparison table
"""

import httpx
import json
import time
import sys
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

INFERENCE_URL = os.environ.get("DIALECTOS_BENCHMARK_URL", "http://100.66.225.85:1234")
INFERENCE_HOST = os.environ.get("DIALECTOS_BENCHMARK_HOST", "100.66.225.85")
INFERENCE_PORT = os.environ.get("DIALECTOS_BENCHMARK_PORT", "1234")
TIMEOUT = 120
BETWEEN_REQUESTS = 0.5
CONTEXT_LENGTH = 4096
OUTPUT_DIR = Path(__file__).parent.parent


def _lms(*args):
    """Run an lms CLI command against the remote host."""
    cmd = ["lms"] + list(args) + ["--host", INFERENCE_HOST, "--port", INFERENCE_PORT, "-y"]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result


def load_model(model: str) -> bool:
    """Unload all models, then load a single model with optimal params."""
    print(f"  [lms] Unloading all models...")
    _lms("unload", "--all")
    time.sleep(2)

    print(f"  [lms] Loading {model} (ctx={CONTEXT_LENGTH}, gpu=max)...")
    result = _lms("load", model, "--context-length", str(CONTEXT_LENGTH), "--gpu", "max")
    if result.returncode != 0:
        print(f"  [lms] FAILED to load: {result.stderr.strip()}")
        return False

    # Wait for model to be ready
    for attempt in range(30):
        try:
            resp = httpx.get(f"{INFERENCE_URL}/api/v0/models", timeout=5)
            models = resp.json().get("data", [])
            for m in models:
                if m["id"] == model and m.get("state") != "not-loaded":
                    print(f"  [lms] Model ready (attempt {attempt+1})")
                    return True
        except Exception:
            pass
        time.sleep(2)

    print(f"  [lms] Model never became ready")
    return False


def unload_model(model: str):
    """Unload a specific model."""
    _lms("unload", model)
    time.sleep(1)

# ── Dialect test cases ────────────────────────────────────────────────────────
# Each test has: source text, target dialect, and check functions

# Gender agreement: (noun, gender) — verifies that if an article appears
# immediately before the noun, it matches the noun's grammatical gender.
_NOUN_GENDER = {
    "carro": "m", "auto": "m", "coche": "m",
    "computadora": "f", "ordenador": "m", "computador": "m",
    "guagua": "f", "colectivo": "m", "autobús": "m", "autobus": "m",
    "zumo": "m", "jugo": "m",
    "móvil": "m", "movil": "m", "celular": "m",
    "tarta": "f", "pastel": "m", "torta": "f", "bizcocho": "m",
}

_MASC_ARTICLES = {"el", "un", "del", "al", "ese", "aquel", "ningún", "algún"}
_FEM_ARTICLES = {"la", "una", "de la", "a la", "esa", "aquella", "ninguna", "alguna"}


def _check_gender_agreement(text: str, noun: str) -> bool:
    """Return False if a preceding article disagrees with the noun's gender."""
    gender = _NOUN_GENDER.get(noun)
    if not gender:
        return True  # can't check unknown nouns
    lower = text.lower()
    # Check for immediate preceding article: "el <noun>", "la <noun>", etc.
    # Use word boundary to avoid false matches
    pattern = re.compile(r'\b(el|la|un|una|del|al|ese|esa|aquel|aquella|ning[úu]n|ninguna|alg[úu]n|alguna)\s+' + re.escape(noun) + r'\b', re.I)
    for match in pattern.finditer(lower):
        article = match.group(1).lower()
        if gender == "f" and article in _MASC_ARTICLES:
            return False
        if gender == "m" and article in _FEM_ARTICLES:
            return False
    return True


def _vocab_check(text: str, noun: str) -> bool:
    """Check that the target noun appears AND gender agreement is correct."""
    if noun not in text.lower():
        return False
    return _check_gender_agreement(text, noun)


TESTS = [
    # ── Vocabulary: car ─────────────────────────────────────────────────────
    {
        "id": "car-mx",
        "source": "I need to drive my car to work.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "carro"),
        "expected": "carro (m)",
    },
    {
        "id": "car-ar",
        "source": "I need to drive my car to work.",
        "dialect": "es-AR",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "auto"),
        "expected": "auto (m)",
    },
    {
        "id": "car-es",
        "source": "I need to drive my car to work.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "coche"),
        "expected": "coche (m)",
    },
    # ── Vocabulary: computer ─────────────────────────────────────────────────
    {
        "id": "comp-mx",
        "source": "I turned on the computer to open the file.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "computadora"),
        "expected": "computadora (f)",
    },
    {
        "id": "comp-es",
        "source": "I turned on the computer to open the file.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "ordenador"),
        "expected": "ordenador (m)",
    },
    {
        "id": "comp-co",
        "source": "I turned on the computer to open the file.",
        "dialect": "es-CO",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "computador"),
        "expected": "computador (m)",
    },
    # ── Vocabulary: bus ──────────────────────────────────────────────────────
    {
        "id": "bus-cu",
        "source": "I took the bus to the city center.",
        "dialect": "es-CU",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "guagua"),
        "expected": "guagua (f, NOT el guagua)",
    },
    {
        "id": "bus-ar",
        "source": "I took the bus to the city center.",
        "dialect": "es-AR",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "colectivo"),
        "expected": "colectivo (m)",
    },
    {
        "id": "bus-es",
        "source": "I took the bus to the city center.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: (_vocab_check(t, "autobús") or _vocab_check(t, "autobus")),
        "expected": "autobús (m)",
    },
    # ── Vocabulary: juice ────────────────────────────────────────────────────
    {
        "id": "juice-es",
        "source": "I drank a glass of orange juice.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "zumo"),
        "expected": "zumo (m)",
    },
    {
        "id": "juice-mx",
        "source": "I drank a glass of orange juice.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "jugo"),
        "expected": "jugo (m)",
    },
    # ── Vocabulary: drive ────────────────────────────────────────────────────
    {
        "id": "drive-es",
        "source": "I learned to drive last year.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: ("conduc" in t.lower()),
        "expected": "conducir",
    },
    {
        "id": "drive-mx",
        "source": "I learned to drive last year.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: ("manej" in t.lower()),
        "expected": "manejar",
    },
    # ── Vocabulary: mobile phone ─────────────────────────────────────────────
    {
        "id": "mobile-es",
        "source": "Call me on my mobile phone.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "móvil") or _vocab_check(t, "movil"),
        "expected": "móvil (m)",
    },
    {
        "id": "cell-mx",
        "source": "Call me on my cell phone.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "celular"),
        "expected": "celular (m)",
    },
    # ── Vocabulary: cake ─────────────────────────────────────────────────────
    {
        "id": "cake-es",
        "source": "The cake is in the oven.",
        "dialect": "es-ES",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "tarta"),
        "expected": "tarta (f)",
    },
    {
        "id": "cake-mx",
        "source": "The cake is in the oven.",
        "dialect": "es-MX",
        "category": "vocabulary",
        "check": lambda t: _vocab_check(t, "pastel"),
        "expected": "pastel (m)",
    },
    # ── Grammar: voseo (Argentina) ───────────────────────────────────────────
    {
        "id": "voseo-ar",
        "source": "You need to come here quickly and bring your things.",
        "dialect": "es-AR",
        "category": "grammar",
        "check": lambda t: bool(re.search(r"tené|vení|traé|hacé|comé|poné|salí|decí|tenés|venís|podés|sos", t, re.I)),
        "expected": "voseo (tenés/vení/podés)",
    },
    # ── Grammar: vosotros (Spain) ────────────────────────────────────────────
    {
        "id": "vosotros-es",
        "source": "You all need to submit the report by Friday.",
        "dialect": "es-ES",
        "category": "grammar",
        "check": lambda t: bool(re.search(r"vosotr|pod[eié]is|ten[eié]is|enviad|entregad|presentad", t, re.I)),
        "expected": "vosotros",
    },
    # ── Safety: false friend ─────────────────────────────────────────────────
    {
        "id": "embarrassed-mx",
        "source": "I was embarrassed by the situation.",
        "dialect": "es-MX",
        "category": "safety",
        "check": lambda t: ("embarazad" not in t.lower()),
        "expected": "avergonzado (NOT embarazada)",
    },
    # ── Safety: vulgar word trap ─────────────────────────────────────────────
    {
        "id": "coger-ar",
        "source": "I need to catch the bus to work.",
        "dialect": "es-AR",
        "category": "safety",
        "check": lambda t: ("coger" not in t.lower()),
        "expected": "tomar (NOT coger)",
    },
    # ── Cleanliness: no preamble/tags ────────────────────────────────────────
    {
        "id": "clean-mx",
        "source": "The weather is beautiful today.",
        "dialect": "es-MX",
        "category": "cleanliness",
        "check": lambda t: not bool(re.search(
            r"<think|</think|here is|here's|traducci|sure,? i can|okay,? i understand|"
            r"let me translate|```|###\s*(instruction|response|system)",
            t, re.I
        )),
        "expected": "no preamble/tags",
    },
    # ── Cleanliness: no English in output ────────────────────────────────────
    {
        "id": "no-english-mx",
        "source": "The ancient castle overlooks the peaceful valley below the mountains.",
        "dialect": "es-MX",
        "category": "cleanliness",
        "check": lambda t: not bool(re.search(
            r"\b(translation|translated|spanish|dialect|here is|below is)\b",
            t, re.I
        )),
        "expected": "no English meta-text",
    },
    # ── Edge: preserves structure ────────────────────────────────────────────
    {
        "id": "structure-mx",
        "source": "The API endpoint returns a 429 status code when the rate limit threshold is exceeded.",
        "dialect": "es-MX",
        "category": "structure",
        "check": lambda t: "429" in t and ("rate" in t.lower() or "límite" in t.lower() or "limite" in t.lower()),
        "expected": "preserves 429 and technical terms",
    },
    # ── Accentuation: always-accented words ──────────────────────────────────
    {
        "id": "accent-tambien",
        "source": "I also want to go to the store.",
        "dialect": "es-MX",
        "category": "accentuation",
        "check": lambda t: "también" in t.lower(),
        "expected": "también (NOT tambien)",
    },
    {
        "id": "accent-ademas",
        "source": "Besides, it's really cold outside.",
        "dialect": "es-ES",
        "category": "accentuation",
        "check": lambda t: "además" in t.lower(),
        "expected": "además (NOT ademas)",
    },
    {
        "id": "accent-ningun",
        "source": "I don't have any problem with that.",
        "dialect": "es-MX",
        "category": "accentuation",
        "check": lambda t: "ningún" in t.lower() or "ningun" not in t.lower(),
        "expected": "ningún (accented before masculine noun)",
    },
    # ── Punctuation: ¿ and ¡ ─────────────────────────────────────────────────
    {
        "id": "punct-question",
        "source": "Where is the nearest gas station?",
        "dialect": "es-MX",
        "category": "punctuation",
        "check": lambda t: bool(re.search(r"¿", t)),
        "expected": "¿...? (opening question mark)",
    },
    {
        "id": "punct-exclaim",
        "source": "That's really amazing!",
        "dialect": "es-ES",
        "category": "punctuation",
        "check": lambda t: bool(re.search(r"¡", t)),
        "expected": "¡...! (opening exclamation)",
    },
    {
        "id": "punct-multi",
        "source": "Hello. How are you? It's very cold!",
        "dialect": "es-MX",
        "category": "punctuation",
        "check": lambda t: bool(re.search(r"¿", t) and re.search(r"¡", t)),
        "expected": "both ¿ and ¡ in multi-sentence",
    },
    # ── Capitalization: Spanish rules ────────────────────────────────────────
    {
        "id": "cap-day",
        "source": "I'll see you on Monday at the office.",
        "dialect": "es-MX",
        "category": "capitalization",
        "check": lambda t: not bool(re.search(r"\b(el|la|un|en|del|al)\s+Lunes\b", t)),
        "expected": "lunes (lowercase, not Lunes)",
    },
    {
        "id": "cap-month",
        "source": "My birthday is in January.",
        "dialect": "es-ES",
        "category": "capitalization",
        "check": lambda t: not bool(re.search(r"\ben\s+Enero\b", t)),
        "expected": "enero (lowercase, not Enero)",
    },
    {
        "id": "cap-language",
        "source": "She speaks Spanish and French fluently.",
        "dialect": "es-MX",
        "category": "capitalization",
        "check": lambda t: not bool(re.search(r"habla\s+Español\b", t)),
        "expected": "español (lowercase mid-sentence)",
    },
    # ── Typography: ellipsis, dashes, quotes ─────────────────────────────────
    {
        "id": "typo-ellipsis",
        "source": "And so the story goes...",
        "dialect": "es-MX",
        "category": "typography",
        "check": lambda t: ("…" in t) or ("..." in t),  # … is ideal, ... is acceptable
        "expected": "… (ellipsis character)",
    },
    {
        "id": "typo-dash",
        "source": "The answer - surprisingly - was no.",
        "dialect": "es-ES",
        "category": "typography",
        "check": lambda t: ("—" in t) or (" - " in t),  # — is ideal, - is acceptable
        "expected": "— (em dash)",
    },
    # ── False friends: common traps ──────────────────────────────────────────
    {
        "id": "ff-library",
        "source": "I studied at the library all afternoon.",
        "dialect": "es-MX",
        "category": "false-friends",
        "check": lambda t: ("biblioteca" in t.lower() or "library" not in t.lower()),
        "expected": "biblioteca (NOT librería)",
    },
    {
        "id": "ff-actually",
        "source": "Actually, I don't think that's correct.",
        "dialect": "es-ES",
        "category": "false-friends",
        "check": lambda t: not bool(re.search(r"\bactualmente\b", t, re.I)),
        "expected": "en realidad (NOT actualmente for 'actually')",
    },
    {
        "id": "ff-success",
        "source": "The project was a great success.",
        "dialect": "es-MX",
        "category": "false-friends",
        "check": lambda t: ("suceso" not in t.lower()),
        "expected": "éxito (NOT suceso)",
    },
]


def build_prompt(source, dialect, pipeline=False):
    system = "You are a Spanish translation engine for DialectOS. Translate to the requested dialect. Output ONLY the Spanish translation — no preamble, explanations, alternatives, or English text."
    if pipeline:
        hint = build_pipeline_hint(source, dialect)
        user = f"Translate to {dialect} Spanish.\n{hint}\n{source}" if hint else f"Translate to {dialect} Spanish.\n{source}"
    else:
        user = f"Translate to {dialect} Spanish.\n{source}"
    return system, user


# Critical dialect vocabulary extracted from DialectOS dictionary.
# Maps (english_word, dialect) → (preferred_term, [avoid_terms])
_PIPELINE_VOCAB = {
    ("car", "es-MX"): ("carro", ["coche", "auto"]),
    ("car", "es-AR"): ("auto", ["coche", "carro"]),
    ("car", "es-ES"): ("coche", ["auto", "carro"]),
    ("car", "es-CO"): ("carro", ["coche", "auto"]),
    ("car", "es-CU"): ("carro", ["coche", "auto"]),
    ("car", "es-VE"): ("carro", ["coche", "auto"]),
    ("computer", "es-MX"): ("computadora", ["ordenador", "computador"]),
    ("computer", "es-AR"): ("computadora", ["ordenador", "computador"]),
    ("computer", "es-ES"): ("ordenador", ["computadora", "computador"]),
    ("computer", "es-CO"): ("computador", ["computadora", "ordenador"]),
    ("computer", "es-CU"): ("computadora", ["ordenador", "computador"]),
    ("computer", "es-VE"): ("computadora", ["ordenador", "computador"]),
    ("bus", "es-CU"): ("guagua", ["autobús", "colectivo"]),
    ("bus", "es-DO"): ("guagua", ["autobús", "colectivo"]),
    ("bus", "es-PR"): ("guagua", ["autobús", "colectivo"]),
    ("bus", "es-AR"): ("colectivo", ["autobús", "bus"]),
    ("bus", "es-ES"): ("autobús", ["colectivo", "bus"]),
    ("bus", "es-CL"): ("micro", ["autobús", "colectivo"]),
    ("bus", "es-PE"): ("micro", ["autobús", "colectivo"]),
    ("bus", "es-MX"): ("camión", ["autobús", "colectivo"]),
    ("juice", "es-ES"): ("zumo", ["jugo"]),
    ("juice", "es-MX"): ("jugo", ["zumo"]),
    ("juice", "es-AR"): ("jugo", ["zumo"]),
    ("drive", "es-ES"): ("conducir", ["manejar"]),
    ("drive", "es-MX"): ("manejar", ["conducir"]),
    ("drive", "es-AR"): ("manejar", ["conducir"]),
    ("drive", "es-CO"): ("manejar", ["conducir"]),
    ("drive", "es-CU"): ("manejar", ["conducir"]),
    ("phone", "es-ES"): ("móvil", ["celular"]),
    ("phone", "es-AD"): ("móvil", ["celular"]),
    ("phone", "es-MX"): ("celular", ["móvil"]),
    ("phone", "es-AR"): ("celular", ["móvil"]),
    ("phone", "es-CO"): ("celular", ["móvil"]),
    ("cake", "es-ES"): ("tarta", ["pastel", "torta"]),
    ("cake", "es-AD"): ("tarta", ["pastel", "torta"]),
    ("cake", "es-MX"): ("pastel", ["tarta", "torta"]),
    ("cake", "es-AR"): ("torta", ["pastel", "tarta"]),
    ("cake", "es-CU"): ("bizcocho", ["pastel", "tarta"]),
}

_PIPELINE_GRAMMAR = {
    "es-AR": "Use voseo: vos (not tú). Conjugate: tenés, venís, podés, sos. Use ustedes (not vosotros) for plural.",
    "es-ES": "Use vosotros for informal plural address (not ustedes). Use pretérito perfecto for recent past.",
    "es-MX": "Use ustedes for plural address. Use tú (not vos) for informal singular.",
}


def build_pipeline_hint(source, dialect):
    """Build a compact vocabulary + grammar hint matching the DialectOS pipeline."""
    source_lower = source.lower()
    source_words = set(source_lower.split())

    hints = []
    for word in source_words:
        for (eng, d), (preferred, avoid) in _PIPELINE_VOCAB.items():
            if d == dialect and (word == eng or eng in word):
                avoid_str = ", ".join(avoid[:2])
                hints.append(f"{eng} → {preferred} (NOT {avoid_str})")
                break

    grammar = _PIPELINE_GRAMMAR.get(dialect, "")
    parts = []
    if hints:
        parts.append(f"Dialect: {dialect}. Use: {'; '.join(hints)}.")
    if grammar:
        parts.append(grammar)
    return " ".join(parts) if parts else ""


def translate(client, model, source, dialect, pipeline=False):
    system, user = build_prompt(source, dialect, pipeline=pipeline)
    start = time.monotonic()
    resp = client.post(
        f"{INFERENCE_URL}/api/v0/chat/completions",
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.3,
            "max_tokens": 512,
        },
        timeout=TIMEOUT,
    )
    elapsed = time.monotonic() - start
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"].strip()
    # Strip think tags (some models emit them despite /no_think)
    text = re.sub(r"<think[^>]*>[\s\S]*?</think\s*>", "", text).strip()
    stats = data.get("stats", {})
    return text, elapsed, stats


def run_benchmark(models=None, pipeline=False, out_dir=None):
    client = httpx.Client()

    # Discover available models (v0 API lists all downloaded, not just loaded)
    resp = client.get(f"{INFERENCE_URL}/api/v0/models", timeout=10)
    resp.raise_for_status()
    available = [m["id"] for m in resp.json()["data"]]

    # Filter to translation-relevant models (skip embeddings)
    skip = {"text-embedding-nomic-embed-text-v1.5"}
    if models:
        candidates = [m for m in models if m in available]
        missing = set(models) - set(available)
        if missing:
            print(f"WARNING: requested models not found: {missing}")
    else:
        candidates = [m for m in available if m not in skip]

    candidates.sort(key=lambda m: (
        0 if any(x in m.lower() for x in ["qwen", "gemma", "lfm"]) else 1,
        m
    ))

    print(f"\n{'='*72}")
    print(f"  DIALECTOS MODEL BENCHMARK{' (PIPELINE)' if pipeline else ''}")
    print(f"  Inference: {INFERENCE_URL}")
    print(f"  Models: {len(candidates)}")
    print(f"  Tests: {len(TESTS)}")
    print(f"  Time: {datetime.now(timezone.utc).isoformat()}")
    if out_dir:
        print(f"  Per-model output: {out_dir}")
    print(f"{'='*72}\n")

    if out_dir:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

    all_results = {}

    for model in candidates:
        print(f"\n── {model} {'─'*(60 - len(model))}")

        # Load model with optimal params (unloads everything else first)
        if not load_model(model):
            print(f"  SKIP: could not load model")
            continue

        model_results = []
        total_time = 0
        errors = 0
        total_tps = 0
        total_ttft = 0
        tps_count = 0

        for test in TESTS:
            try:
                text, elapsed, stats = translate(client, model, test["source"], test["dialect"], pipeline=pipeline)
                total_time += elapsed
                passed = test["check"](text)
                status = "PASS" if passed else "FAIL"
                snippet = text[:70].replace("\n", " ")
                tps = stats.get("tokens_per_second")
                ttft = stats.get("time_to_first_token")
                tps_str = f"{tps:.0f}t/s" if tps else ""
                print(f"  {status} {test['id']:20s} {elapsed:5.1f}s {tps_str:>8s}  {snippet}")
                if tps:
                    total_tps += tps
                    tps_count += 1
                if ttft:
                    total_ttft += ttft
                model_results.append({
                    "id": test["id"],
                    "category": test["category"],
                    "dialect": test["dialect"],
                    "passed": passed,
                    "elapsed": round(elapsed, 2),
                    "tokens_per_second": round(tps, 1) if tps else None,
                    "time_to_first_token": round(ttft, 3) if ttft else None,
                    "output": text[:200],
                    "expected": test["expected"],
                })
            except Exception as e:
                errors += 1
                print(f"  ERR  {test['id']:20s}  {str(e)[:60]}")
                model_results.append({
                    "id": test["id"],
                    "category": test["category"],
                    "dialect": test["dialect"],
                    "passed": False,
                    "elapsed": 0,
                    "output": "",
                    "expected": test["expected"],
                    "error": str(e),
                })
            time.sleep(BETWEEN_REQUESTS)

        # Score
        def cat_pass(cat):
            return sum(1 for r in model_results if r["category"] == cat and r["passed"])
        def cat_total(cat):
            return sum(1 for r in model_results if r["category"] == cat)

        total_pass = sum(1 for r in model_results if r["passed"])

        avg_time = total_time / len(TESTS) if TESTS else 0
        avg_tps = round(total_tps / tps_count, 1) if tps_count else 0
        avg_ttft = round(total_ttft / len(TESTS), 3) if total_ttft else 0

        summary = {
            "vocab": f"{cat_pass('vocabulary')}/{cat_total('vocabulary')}",
            "grammar": f"{cat_pass('grammar')}/{cat_total('grammar')}",
            "safety": f"{cat_pass('safety')}/{cat_total('safety')}",
            "cleanliness": f"{cat_pass('cleanliness')}/{cat_total('cleanliness')}",
            "structure": f"{cat_pass('structure')}/{cat_total('structure')}",
            "accentuation": f"{cat_pass('accentuation')}/{cat_total('accentuation')}",
            "punctuation": f"{cat_pass('punctuation')}/{cat_total('punctuation')}",
            "capitalization": f"{cat_pass('capitalization')}/{cat_total('capitalization')}",
            "typography": f"{cat_pass('typography')}/{cat_total('typography')}",
            "false-friends": f"{cat_pass('false-friends')}/{cat_total('false-friends')}",
            "total": f"{total_pass}/{len(TESTS)}",
            "errors": errors,
            "avg_latency": round(avg_time, 2),
            "avg_tokens_per_second": avg_tps,
            "avg_time_to_first_token": avg_ttft,
            "results": model_results,
        }
        all_results[model] = summary

        print(f"\n  Summary: {total_pass}/{len(TESTS)} passed  "
              f"vocab={cat_pass('vocabulary')}/{cat_total('vocabulary')}  "
              f"grammar={cat_pass('grammar')}/{cat_total('grammar')}  "
              f"safety={cat_pass('safety')}/{cat_total('safety')}  "
              f"accent={cat_pass('accentuation')}/{cat_total('accentuation')}  "
              f"punct={cat_pass('punctuation')}/{cat_total('punctuation')}  "
              f"cap={cat_pass('capitalization')}/{cat_total('capitalization')}  "
              f"ff={cat_pass('false-friends')}/{cat_total('false-friends')}  "
              f"avg={avg_time:.1f}s  tps={avg_tps}  errors={errors}")

        # Unload model to free memory for next one
        unload_model(model)

        # Per-model incremental write
        if out_dir:
            safe_name = model.replace("/", "_").replace(".", "-")
            per_file = out_dir / f"{safe_name}.json"
            with open(per_file, "w") as f:
                json.dump({"model": model, "pipeline": pipeline, **summary}, f, indent=2, ensure_ascii=False)
            print(f"  → saved {per_file}")

    client.close()

    # ── Save results ────────────────────────────────────────────────────────
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    results_path = OUTPUT_DIR / "benchmark_results.json"
    report_path = OUTPUT_DIR / "benchmark_report.md"

    with open(results_path, "w") as f:
        json.dump({"timestamp": timestamp, "inference_url": INFERENCE_URL, "models": all_results}, f, indent=2, ensure_ascii=False)

    # ── Write report ────────────────────────────────────────────────────────
    categories = ["vocabulary", "grammar", "safety", "cleanliness", "structure",
                  "accentuation", "punctuation", "capitalization", "typography", "false-friends"]
    cat_counts = ", ".join(f"{len([t for t in TESTS if t['category']==c])} {c}" for c in categories)

    lines = [
        f"# DialectOS Model Benchmark",
        f"",
        f"**Date:** {timestamp}",
        f"**Inference:** {INFERENCE_URL}",
        f"**Tests:** {len(TESTS)} ({cat_counts})",
        f"",
        f"| Model | Vocab | Gram | Safe | Clean | Struct | Accent | Punct | Cap | Typo | FF | **Total** | Avg Latency | tok/s | TTFT |",
        f"|-------|-------|------|------|-------|--------|--------|-------|-----|------|----|-----------|-------------|-------|------|",
    ]

    # Sort by total pass rate descending
    sorted_models = sorted(all_results.items(), key=lambda x: (
        -int(x[1]["total"].split("/")[0]),
        x[1]["avg_latency"],
    ))

    for model, s in sorted_models:
        tps = s.get("avg_tokens_per_second", 0)
        ttft = s.get("avg_time_to_first_token", 0)
        lines.append(
            f"| {model} | {s['vocab']} | {s['grammar']} | {s['safety']} | "
            f"{s['cleanliness']} | {s['structure']} | {s['accentuation']} | "
            f"{s['punctuation']} | {s['capitalization']} | {s['typography']} | "
            f"{s['false-friends']} | **{s['total']}** | {s['avg_latency']}s | "
            f"{tps:.0f} | {ttft:.2f}s |"
        )

    lines.append("")
    lines.append("## Failures by Model")
    lines.append("")

    for model, s in sorted_models:
        failures = [r for r in s["results"] if not r["passed"]]
        if not failures:
            lines.append(f"**{model}**: All tests passed.")
        else:
            lines.append(f"**{model}**: {len(failures)} failures")
            for f in failures:
                err_detail = f" → got: {f['output'][:80]}" if f.get("output") else f" → {f.get('error', 'unknown')}"
                lines.append(f"  - {f['id']}: expected {f['expected']}{err_detail}")
        lines.append("")

    report = "\n".join(lines)
    with open(report_path, "w") as f:
        f.write(report)

    # ── Final summary ───────────────────────────────────────────────────────
    print(f"\n{'='*72}")
    print(f"  BENCHMARK COMPLETE")
    print(f"{'='*72}\n")
    print(lines[8])  # header
    print(lines[9])  # separator
    for line in lines[10:]:
        if line.startswith("|"):
            print(line)
        else:
            break
    print(f"\nResults: {results_path}")
    print(f"Report:  {report_path}")
    print()


if __name__ == "__main__":
    args = sys.argv[1:]
    pipeline = "--pipeline" in args
    if pipeline:
        args.remove("--pipeline")
    out_dir = None
    if "--out" in args:
        idx = args.index("--out")
        out_dir = Path(args[idx + 1])
        args = args[:idx] + args[idx + 2:]
    if "--models" in args:
        idx = args.index("--models")
        models = args[idx + 1:]
        run_benchmark(models=models, pipeline=pipeline, out_dir=out_dir)
    else:
        run_benchmark(pipeline=pipeline, out_dir=out_dir)
