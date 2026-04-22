/**
 * Build script: extracts pure functions from actual TypeScript source
 * and generates a browser-compatible JS module for the demo.
 */
const fs = require('fs');
const path = require('path');

function getLines(file, start, end) {
  return fs.readFileSync(file, 'utf8').split('\n').slice(start - 1, end).join('\n');
}

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
  getLines(m, 32, 35),     // VOSOTROS_ADAPTATION
  getLines(m, 38, 302),    // TECH_ADAPTATIONS
  getLines(m, 308, 337),   // DIALECT_ADAPTATIONS
  getLines(m, 354, 365),   // applyAdaptations
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

const output = `// AUTO-GENERATED from packages/cli/src/lib/dialect-info.ts
// and packages/cli/src/commands/i18n/manage-variants.ts
// Do not edit manually. Run: node scripts/build-demo.cjs

${blocks.map(stripTS).join('\n\n')}

// Browser exports
if (typeof window !== 'undefined') {
  window.DIALECT_METADATA = DIALECT_METADATA;
  window.detectDialect = detectDialect;
  window.applyAdaptations = applyAdaptations;
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
