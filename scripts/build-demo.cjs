/**
 * Build script: extracts pure functions from actual TypeScript source
 * and generates a browser-compatible JS module for the demo.
 */
const fs = require('fs');
const path = require('path');

function extractBalanced(source, startIndex, openChar, closeChar) {
  const openIndex = source.indexOf(openChar, startIndex);
  if (openIndex === -1) throw new Error(`Could not find ${openChar}`);
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  throw new Error(`Could not find matching ${closeChar}`);
}

function findBalancedEnd(source, startIndex, openChar, closeChar) {
  const openIndex = source.indexOf(openChar, startIndex);
  if (openIndex === -1) throw new Error(`Could not find ${openChar}`);
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  throw new Error(`Could not find matching ${closeChar}`);
}

function extractConstArray(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(`export const ${name}`);
  if (start === -1) throw new Error(`Could not find ${name}`);
  const assignment = source.indexOf('=', start);
  if (assignment === -1) throw new Error(`Could not find assignment for ${name}`);
  const array = extractBalanced(source, assignment, '[', ']');
  return `${source.slice(start, assignment)}= ${array};`;
}

function extractConst(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(`const ${name}`);
  if (start === -1) throw new Error(`Could not find ${name}`);
  const assignment = source.indexOf('=', start);
  const open = source.slice(assignment + 1).search(/[[{]/) + assignment + 1;
  const [openChar, closeChar] = source[open] === '[' ? ['[', ']'] : ['{', '}'];
  const end = findBalancedEnd(source, open, openChar, closeChar);
  return source.slice(start, source[end] === ';' ? end + 1 : end);
}

function extractFunction(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const exportStart = source.indexOf(`export function ${name}`);
  const start = exportStart >= 0 ? exportStart : source.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`Could not find ${name}`);
  return source.slice(start, findBalancedEnd(source, start, '{', '}'));
}

const d = path.join(__dirname, '../packages/cli/src/lib/dialect-info.ts');
const m = path.join(__dirname, '../packages/cli/src/commands/i18n/manage-variants.ts');

// Extract source-backed demo blocks by symbol name so generated docs do not
// silently drift when implementation line numbers change.
const blocks = [
  extractConstArray(d, 'DIALECT_METADATA'),
  extractFunction(d, 'getWordBoundaries'),
  extractFunction(d, 'detectDialect'),
  extractConst(m, 'VOSOTROS_ADAPTATION'),
  extractConst(m, 'TECH_ADAPTATIONS'),
  extractConst(m, 'DIALECT_ADAPTATIONS'),
  extractFunction(m, 'applyAdaptations'),
];

function stripTS(code) {
  return code
    .replace(/:\s*Record<\s*SpanishDialect\s*,\s*Array<\{[\s\S]*?\}>\s*>/g, '')
    .replace(/:\s*Record<\n\s*SpanishDialect,\n\s*Array<\{[\s\S]*?\}>\n\s*>/g, '')
    .replace(/:\s*DialectMetadata\[\]/g, '')
    .replace(/:\s*DialectMetadata\s*\|\s*undefined/g, '')
    .replace(/:\s*SpanishDialect\s*\|\s*null/g, '')
    .replace(/:\s*string\s*\|\s*null/g, '')
    .replace(/:\s*SpanishDialect/g, '')
    .replace(/:\s*string\[\]/g, '')
    .replace(/:\s*string/g, '')
    .replace(/:\s*number/g, '')
    .replace(/:\s*boolean/g, '')
    .replace(/:\s*Set<string>/g, '')
    .replace(/:\s*RegisterPreference/g, '')
    .replace(/:\s*DetectionResult/g, '')
    .replace(/:\s*"formal"\s*\|\s*"slang"\s*\|\s*"neutral"/g, '')
    .replace(/:\s*"any"\s*\|\s*"formal"\s*\|\s*"slang"/g, '')
    .replace(/:\s*Array<\{[\s\S]*?\}>/g, '')
    .replace(/:\s*VariantResult/g, '')
    .replace(/:\s*I18nEntry\[\]/g, '')
    .replace(/:\s*I18nEntry/g, '')
    .replace(/:\s*ManageVariantsOptions/g, '')
    .replace(/:\s*Promise<VariantResult>/g, '')
    .replace(/readonly /g, '')
    .replace(/export /g, '')
    .replace(/new Set<string>\(\)/g, 'new Set()')
    .replace(/^import .* from .*;\n?/gm, '')
    .replace(/^import type .* from .*;\n?/gm, '');
}

// Bundle the shared lexical substitution engine for the browser. The engine
// reads its data files with node:fs at load time, so those reads are served
// from inlined JSON. Fields the engine never reads (notes, glosses) are
// dropped to keep the bundle small.
function compactDictionary() {
  const file = path.join(__dirname, '../packages/types/src/dialectal-dictionary.json');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  return entries.map((e) => {
    const out = { concept: e.concept };
    if (e.panHispanic) out.panHispanic = e.panHispanic;
    if (e.variants) {
      out.variants = {};
      for (const [code, v] of Object.entries(e.variants)) {
        const kept = { term: v.term, frequency: v.frequency, register: v.register };
        if (v.ambiguous) kept.ambiguous = true;
        out.variants[code] = kept;
      }
    }
    return out;
  });
}

async function bundleLexicalEngine() {
  const esbuild = require('esbuild');
  const typesDir = path.join(__dirname, '../packages/types/src');
  const dataFiles = {
    'dialectal-dictionary.json': JSON.stringify(compactDictionary()),
    'gender-overrides.json': fs.readFileSync(path.join(typesDir, 'gender-overrides.json'), 'utf8'),
    // Verb tables are not used by vocabulary swaps.
    'verb-conjugations.json': '[]',
  };
  const nodeShim = `
    const DATA = ${JSON.stringify(dataFiles)};
    export function readFileSync(p) {
      const name = String(p).split('/').pop();
      if (!(name in DATA)) throw new Error('demo bundle has no data file ' + name);
      return DATA[name];
    }
    export function fileURLToPath(u) { return String(u).slice('file://'.length); }
    export function dirname(p) { return p.slice(0, p.lastIndexOf('/')); }
    export function join(...parts) { return parts.join('/'); }
  `;
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'demo-engine/entry.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'DialectOSLexical',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    define: { 'import.meta.url': '"file:///demo/engine.js"' },
    logLevel: 'silent',
    plugins: [{
      name: 'demo-shims',
      setup(build) {
        build.onResolve({ filter: /^@dialectos\/types$/ }, () => ({
          path: path.join(__dirname, 'demo-engine/types-shim.ts'),
        }));
        build.onResolve({ filter: /^node:(fs|url|path)$/ }, (args) => ({ path: args.path, namespace: 'demo-node' }));
        build.onLoad({ filter: /.*/, namespace: 'demo-node' }, () => ({ contents: nodeShim, loader: 'js' }));
      },
    }],
  });
  return result.outputFiles[0].text;
}

async function main() {
const lexicalBundle = await bundleLexicalEngine();

const output = `// AUTO-GENERATED from packages/cli/src/lib/dialect-info.ts,
// packages/cli/src/commands/i18n/manage-variants.ts
// and packages/providers/src/lexical-substitution.ts (bundled with esbuild)
// Do not edit manually. Run: node scripts/build-demo.cjs

${lexicalBundle}
${blocks.map(stripTS).join('\n\n')}

// Same pipeline as the CLI's manage-variants: the shared engine swaps
// vocabulary with article and adjective agreement, then the table covers
// what the engine does not (vosotros -> ustedes, a few verbs).
function adaptForDialect(value, variant) {
  if (variant === 'es-ES') return value;
  return applyAdaptations(DialectOSLexical.applyLexicalSubstitution(value, variant), variant);
}

// Browser exports
if (typeof window !== 'undefined') {
  window.DIALECT_METADATA = DIALECT_METADATA;
  window.detectDialect = detectDialect;
  window.adaptForDialect = adaptForDialect;
  window.DIALECT_ADAPTATIONS = DIALECT_ADAPTATIONS;
}
`;

const outputPath = path.join(__dirname, '../docs/dialectos-engine.js');
if (process.argv.includes('--check')) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
  if (current !== output) {
    console.error('docs/dialectos-engine.js is stale. Run: node scripts/build-demo.cjs');
    process.exit(1);
  }
  console.log('Generated docs/dialectos-engine.js is current');
} else {
  fs.writeFileSync(outputPath, output);
  console.log('Generated docs/dialectos-engine.js (' + output.length + ' chars)');
}

try {
  require('child_process').execSync('node --check docs/dialectos-engine.js', { cwd: path.join(__dirname, '..') });
  console.log('Syntax OK');
} catch (e) {
  console.error('Syntax check failed:', e.stdout?.toString() || e.message);
  process.exit(1);
}
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
