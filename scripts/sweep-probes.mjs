// Barrido wave-2: probes de confirmación para B-1, B-2, B-3 (dialectos-pm-002)
// Reproduces each confirmed sweep finding. Run: node scripts/sweep-probes.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const providers = await import(join(repoRoot, "packages/providers/dist/index.js"));
const sentinelMod = await import(join(repoRoot, "packages/providers/dist/sentinel-extraction.js"));
const { fixAccentuation } = providers;
const { extractSentinels, restoreSentinels } = sentinelMod;

console.log("=== B-1: fixAccentuation sobre condicional con inciso ===");
const b1 = "Si, como dices, llueve, cancelamos la cena.";
console.log("IN :", b1);
console.log("OUT:", fixAccentuation(b1));
console.log("¿Corrupto (Sí, como dices)?", fixAccentuation(b1).startsWith("Sí,") ? "SÍ — CONFIRMADO" : "no");

console.log("\n=== B-2: corrección parcial Tu estas / TU PUEDES ===");
console.log("IN : 'Tu estas cansado'  OUT:", JSON.stringify(fixAccentuation("Tu estas cansado")));
console.log("IN : 'TU PUEDES hacerlo' OUT:", JSON.stringify(fixAccentuation("TU PUEDES hacerlo")));

console.log("\n=== B-3: restoreSentinels sobre texto con placeholder literal del usuario ===");
// El usuario traduce documentación de plantillas (Jinja/Handlebars-style)
// y su texto contiene literalmente {{ CODE_0 }}-like tokens.
const source = "La plantilla usa {{ CODE_0 }} como marcador. Guarda el script.sh en disco.";
const { text, sentinels } = extractSentinels(source);
console.log("sentinels extraídos:", [...sentinels.entries()]);
// Simular salida LLM que preserva el texto con sentinels
const translated = text.replace("La plantilla usa", "La plantilla utiliza");
console.log("texto con sentinels:", translated);
const restored = restoreSentinels(translated, sentinels);
console.log("restaurado:", restored);
console.log("¿El {{ CODE_0 }} literal del usuario sobrevivió?", restored.includes("{{ CODE_0 }}") ? "SÍ" : "NO — fue sustituido");

console.log("\n=== B-3b: colisión real — sentinel CODE_0 presente + literal {{ CODE_0 }} del usuario ===");
const source2 = "Nuestro sistema usa marcadores tipo {{ CODE_0 }}. Ejemplo de código real:\n\n`const x = 1`\nFin.";
const ex2 = extractSentinels(source2);
console.log("sentinels:", [...ex2.sentinels.entries()]);
const restored2 = restoreSentinels(ex2.text, ex2.sentinels);
console.log("restaurado:", restored2);
console.log("el literal del usuario {{ CODE_0 }} (con espacios) sobrevivió?", restored2.includes("{{ CODE_0 }}") ? "SÍ" : "NO — SUSTITUIDO POR EL CÓDIGO: B-3 CONFIRMADO");

console.log("\n=== Control B-3c: sin coincidencia de nombre, todo bien ===");
const src3 = "El config.json y https://example.com/x?a=1 importan.";
const ex3 = extractSentinels(src3);
const r3 = restoreSentinels(ex3.text.replace("importan", "molan"), ex3.sentinels);
console.log("restaurado control:", r3, "== esperado:", src3.replace("importan", "molan"));
