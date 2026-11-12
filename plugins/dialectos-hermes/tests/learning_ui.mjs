// Execute the actual page components against their SDK boundary, without a
// browser, provider, installed React, or changes to production exports.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const kind = process.argv[2]
const surface = kind.startsWith('desktop') ? 'desktop' : 'dashboard'
const fixture = process.argv.includes('--fixture') ? JSON.parse(fs.readFileSync(0, 'utf8')) : null
const root = new URL('../', import.meta.url)
const slots = []
const effects = []
let cursor = 0
const calls = []
const h = (type, props, ...children) => ({ type, props: { ...props, ...(children.length ? { children } : {}) } })
const hooks = {
  useState(initial) {
    const n = cursor++
    if (!(n in slots)) slots[n] = initial
    return [slots[n], value => { slots[n] = typeof value === 'function' ? value(slots[n]) : value }]
  },
  useEffect(fn, deps) {
    const n = cursor++
    if (!slots[n] || deps.some((x, i) => x !== slots[n][i])) { slots[n] = deps; effects.push(fn) }
  },
  useCallback: fn => fn,
}
const reply = path => {
  const dialect = new URLSearchParams(path.split('?')[1]).get('dialect')
  return path.includes('action=tip') ? { ok: true, data: { concept: 'bus', variant: dialect, term: dialect === 'es-MX' ? 'camión' : 'colectivo', englishGloss: 'public transit vehicle', contrasts: [{ variant: dialect === 'es-MX' ? 'es-AR' : 'es-MX', term: dialect === 'es-MX' ? 'colectivo' : 'camión' }] } }
  : path.includes('action=stats') ? { ok: true, data: { due: 1 } }
  : { ok: true, data: { concept: 'bus', variant: dialect, question: `In ${dialect}, what do you call a bus?` } }
}
const request = async (path, options) => {
  calls.push({ path, options })
  if (options?.method === 'POST' && fixture) return fixture.answer
  if (options?.method === 'POST') return { ok: true, data: { correct: true, term: 'colectivo', due: '2026-11-12' } }
  if (fixture) {
    const action = new URLSearchParams(path.split('?')[1]).get('action')
    return fixture[action]
  }
  return reply(path)
}
const components = Object.fromEntries(['Button', 'Card', 'CardHeader', 'CardTitle', 'CardContent', 'Badge'].map(x => [x, x]))
const sandbox = { ...hooks, ...components, jsx: (type, props) => h(type, props), jsxs: (type, props) => h(type, props),
  console, URLSearchParams, window: { __HERMES_PLUGIN_SDK__: { React: { createElement: h }, hooks, components, fetchJSON: request }, __HERMES_PLUGINS__: { register() {} } } }
vm.createContext(sandbox)
if (surface === 'desktop') {
  let src = fs.readFileSync(new URL('desktop/plugin.js', root), 'utf8')
  src = src.replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
  src = src.slice(0, src.indexOf('export default')) + '\nglobalThis.LearnForTest = Learn;'
  vm.runInContext(src, sandbox)
} else {
  let src = fs.readFileSync(new URL('dashboard/dist/index.js', root), 'utf8')
  src = src.replace('window.__HERMES_PLUGINS__.register', 'globalThis.LearnForTest = Learn; window.__HERMES_PLUGINS__.register')
  vm.runInContext(src, sandbox)
}
let activeTarget = 'es-AR'
function render() { cursor = 0; return sandbox.LearnForTest({ target: activeTarget, revision: 0, ctx: { rest: request } }) }
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)]
}
async function settle() { for (let i = 0; i < 15; i++) await Promise.resolve() }
let tree = render()
for (const effect of effects.splice(0)) effect()
await settle()
tree = render()
assert.match(JSON.stringify(tree), /colectivo/)
assert.match(JSON.stringify(tree), /camión/)
assert.match(JSON.stringify(tree), /1 due/)
const input = nodes(tree).find(x => x.type === 'input')
assert.ok(input?.props['aria-label'], 'answer input needs an accessible name')
input.props.onChange({ target: { value: 'colectivo' } })
tree = render()
const form = nodes(tree).find(x => x.type === 'form')
assert.ok(form, 'Enter submits a native form')
await form.props.onSubmit({ preventDefault() {} })
await settle()
const sent = calls.find(c => c.options?.method === 'POST')
const body = typeof sent.options.body === 'string' ? JSON.parse(sent.options.body) : JSON.parse(JSON.stringify(sent.options.body))
assert.deepEqual(body, { action: 'answer', dialect: 'es-AR', concept: 'bus', answer: 'colectivo' })
tree = render()
assert.match(JSON.stringify(tree), /Correct/)
assert.match(JSON.stringify(tree), /colectivo/)
assert.match(JSON.stringify(tree), /2026-11-12/)
assert.doesNotMatch(JSON.stringify(tree), /undefined/)
assert.ok(nodes(tree).some(x => x.props?.['aria-live'] === 'polite'))
if (kind === 'desktop-switch') {
  const oldInput = nodes(tree).find(x => x.type === 'input')
  oldInput.props.onChange({ target: { value: 'colectivo' } })
  tree = render()
  activeTarget = 'es-MX'
  tree = render()
  assert.equal(nodes(tree).some(x => x.type === 'form'), false, 'the old dialect quiz must not be answerable while the new one loads')
  assert.doesNotMatch(JSON.stringify(tree), /Question for es-AR|Correct/)
  for (const effect of effects.splice(0)) effect()
  await settle()
  tree = render()
  assert.match(JSON.stringify(tree), /In es-MX, what do you call a bus\?/)
  assert.doesNotMatch(JSON.stringify(tree), /Correct/)
  assert.equal(nodes(tree).find(x => x.type === 'input')?.props.value, '', 'an answer from the old dialect must be cleared')
  assert.equal(calls.filter(c => c.options?.method === 'POST').length, 1, 'switching dialect must not submit the old quiz')
}
console.log(`${kind}: comparison, due count, keyboard answer, feedback${kind === 'desktop-switch' ? ' and dialect switch' : ''} passed`)
