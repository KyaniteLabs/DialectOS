// DialectOS desktop half. Plain ESM for the Hermes desktop plugin SDK: no build
// step, imports only from the SDK and React. Data comes from the agent half's
// dashboard/plugin_api.py through ctx.rest, so the page runs the same CLI,
// settings and limits as the agent tools. Fonts: Chakra Petch (OFL) Latin subset
// and the r16 mark, embedded between the generated markers below.
import {
  Button, CopyButton, EmptyState, ErrorState, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA,
  Skeleton, host, relativeTime, useQuery, useQueryClient
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'dialectos'
const PATH = '/dialectos'
const FACE = 'DialectOS Chakra Petch'
const VIEWS = ['translate', 'check', 'dialects', 'by_dialect', 'recent']
const isObject = p => p !== null && typeof p === 'object' && !Array.isArray(p)
const isDialect = s => typeof s === 'string' && s.length === 5 && /^es-[A-Z]{2}$/.test(s)

function validPaneEvent(name, p) {
  if (!isObject(p)) return false
  if (name === 'ledger.updated') return Object.keys(p).length === 1
    && Number.isInteger(p.count) && p.count >= 0 && p.count <= 200
  return name === 'view.set' && VIEWS.includes(p.view)
    && Object.keys(p).every(k => k === 'view' || k === 'item_id')
    && (!Object.hasOwn(p, 'item_id') || isDialect(p.item_id))
}

function createPaneEvents(host, ctx) {
  let state = { view: null, item_id: null, revision: 0, viewRevision: 0 }
  const listeners = new Set()
  // Register before the route mounts so section changes wait for the page to open.
  const disposers = typeof host.onEvent !== 'function' ? [] : ['ledger.updated', 'view.set'].map(name =>
    host.onEvent(`plugin.${ID}.${name}`, frame => {
      const payload = frame?.payload
      if (!validPaneEvent(name, payload)) return
      state = { ...state, revision: state.revision + 1 }
      if (name === 'view.set') state = { ...state, view: payload.view, item_id: payload.item_id || null, viewRevision: state.viewRevision + 1 }
      for (const listener of listeners) listener(state)
    }))
  return {
    snapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      listener(state) // covers an event between render and effect subscription
      return () => listeners.delete(listener)
    },
    async read(path) {
      // A REST request begun before a live event may contain an older ledger.
      // Read again before publishing either its result or its error to React Query.
      for (;;) {
        const revision = state.revision
        try {
          const data = await ctx.rest(path)
          if (revision === state.revision) return data
        } catch (error) {
          if (revision === state.revision) throw error
        }
      }
    },
    dispose() {
      for (const dispose of disposers) if (typeof dispose === 'function') dispose()
      listeners.clear()
    }
  }
}

function focusPaneItem(root, pane) {
  if (!root || !VIEWS.includes(pane.view)) return
  const section = root.querySelector(`[data-view="${pane.view}"]`)
  const item = isDialect(pane.item_id) ? section?.querySelector(`[data-item-id="${pane.item_id}"]`) : null
  const target = item || section
  target?.scrollIntoView?.({ block: 'center' })
  target?.focus?.({ preventScroll: true })
}

// Keep the requested dialect visible even when it falls outside the first ten rows.
const visibleRows = (rows, item) => {
  const visible = rows.slice(0, 10)
  const focused = rows.find(r => r.dialect === item)
  if (focused && !visible.includes(focused)) visible.push(focused)
  return visible
}

// --- FONTS (generated) -------------------------------------------------------
const FONTS = {
  600: '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'
}
// --- MARK (generated) --------------------------------------------------------
const MARK = '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'
// --- end generated -----------------------------------------------------------

// Blue apatite: a petrol slab for the header, its pale mist face for the ground,
// petrol as the one identity accent. Receipt: docs/DESIGN-PREFLIGHT.md §8. Every state has a label.
const CSS = `
${Object.entries(FONTS).map(([w, b]) => `@font-face{font-family:'${FACE}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff;base64,${b}) format('woff')}`).join('\n')}
.dos-host{container-type:inline-size;width:100%;min-height:100vh;box-sizing:border-box;color-scheme:light;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .07 0 0 0 0 .19 0 0 0 0 .23 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)'/%3E%3C/svg%3E") #e3edef;color:#12303a;--ui-bg-primary:#e3edef;--ui-bg-editor:#e3edef;--ui-bg-secondary:#eaf2f3;--ui-bg-elevated:#eef4f5;--ui-bg-card:#f4f8f9;--ui-bg-tertiary:#e8f0f2;--ui-bg-input:#fbfdfd;--ui-control-hover-background:#dde9ec;--ui-control-active-background:#d2e2e6;--ui-row-hover-background:#e6eff1;--ui-text-primary:#12303a;--ui-text-secondary:#2a4752;--ui-text-tertiary:#3d5a65;--ui-stroke-primary:#5d7780;--ui-stroke-secondary:#76929b;--ui-stroke-tertiary:#c6d7db;--ui-stroke-quaternary:#d8e4e7;--ui-accent:#135668;--dos-id:#135668;--dos-pass:#2f6337;--dos-block:#992e2e;--dos-adv:#46596a;--dos-slab:#0c3d50}
.dos{max-width:1120px;margin:0 auto;padding:24px 32px 48px;display:grid;gap:24px;font-family:var(--font-sans,system-ui,sans-serif);font-size:14px;line-height:1.45;color:var(--ui-text-primary);--dos-display:'${FACE}',var(--font-sans,system-ui,sans-serif)}
.dos *{box-sizing:border-box}
.dos-head{position:relative;isolation:isolate;overflow:hidden;border-radius:12px;color:#eaf5f6;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .80 0 0 0 0 .93 0 0 0 0 .95 0 0 0 .13 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E"),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.004 .09' numOctaves='4' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 .78 0 0 0 0 .92 0 0 0 0 .94 0 0 0 .42 -.30'/%3E%3C/filter%3E%3Crect width='480' height='240' filter='url(%23f)'/%3E%3C/svg%3E"),linear-gradient(90deg,#0a3446 0%,rgba(10,52,70,.7) 38%,rgba(10,52,70,0) 72%),radial-gradient(60% 130% at 86% 10%,#1a6c76 0%,transparent 62%),radial-gradient(35% 80% at 60% 85%,#0d4457 0%,transparent 70%),linear-gradient(118deg,#0c3d50 0%,#145a6a 42%,#1a6c76 64%,#0f4a5e 100%);background-color:#0c3d50;box-shadow:inset 0 1px 0 rgba(234,245,246,.14),0 1px 2px rgba(12,61,80,.18)}
.dos-id{display:grid;grid-template-columns:64px minmax(0,1fr);gap:4px 18px;align-items:center;padding:20px 24px 18px}
.dos-tile{grid-row:span 2;width:64px;height:64px;display:grid;place-items:center;border-radius:8px;background:#e3edef;box-shadow:inset 0 0 0 1px #c6d7db,0 2px 6px rgba(6,32,43,.35)}
.dos-tile img{width:48px;height:48px;display:block}
.dos-title{margin:0;text-shadow:0 1px 2px #0a3446;font-family:var(--dos-display);font-weight:600;font-size:26px;letter-spacing:.04em;line-height:1.05;color:#f3fafb}
.dos-tag{margin:0;font-size:14px;color:#eaf5f6;max-width:60ch;text-shadow:0 1px 2px #0a3446}
.dos-facts{margin:0;display:flex;flex-wrap:wrap;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .80 0 0 0 0 .93 0 0 0 0 .95 0 0 0 .09 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E") #0a3344;border-top:1px solid rgba(234,245,246,.12)}
.dos-fact{display:grid;gap:1px;padding:9px 24px 10px;min-width:0;border-right:1px solid rgba(234,245,246,.12)}
.dos-fact:last-child{border-right:0}
.dos-fact dt{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9fc9cf}
.dos-fact dd{margin:0;font-family:var(--font-mono,ui-monospace,monospace);font-size:13px;color:#f3fafb;white-space:nowrap}
.dos-fact[data-off] dd{color:#f6d6d6}
.dos-note{display:block;margin:0;padding:11px 16px;border:1px solid var(--ui-stroke-tertiary);border-radius:8px;background:var(--ui-bg-elevated);font-size:13px;color:var(--ui-text-secondary)}
.dos-note b{color:var(--ui-text-primary)}
.dos-label{margin:0;display:flex;align-items:center;gap:8px;font-family:var(--dos-display);font-weight:600;font-size:16px;letter-spacing:.03em;color:var(--ui-text-primary)}
.dos-label::before{content:'';flex:none;width:10px;height:11px;background:var(--dos-id);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
.dos-sub{margin:4px 0 0 18px;font-size:13px;color:var(--ui-text-tertiary)}
.dos-card{background:var(--ui-bg-card);border:1px solid var(--ui-stroke-tertiary);border-radius:12px;padding:16px;display:grid;gap:12px;min-width:0;align-content:start}
.dos-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
.dos-field{display:grid;gap:5px;font-size:13px;font-weight:500;color:var(--ui-text-secondary)}
.dos textarea,.dos select,.dos input{font:inherit;font-size:14px;color:var(--ui-text-primary);background:var(--ui-bg-input);border:1px solid #6b8993;border-radius:6px;padding:8px 10px;width:100%;transition:border-color .12s}
.dos textarea::placeholder{color:#5d7780}
.dos textarea:hover,.dos select:hover{border-color:#4f6e78}
.dos textarea{min-height:88px;resize:vertical;line-height:1.5}
.dos select{height:32px;padding:0 8px;width:auto;min-width:220px}
.dos textarea:focus-visible,.dos select:focus-visible,.dos input:focus-visible,.dos button:focus-visible{outline:2px solid var(--dos-id);outline-offset:1px}
.dos-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dos-why{font-size:13px;color:var(--ui-text-tertiary)}
.dos-out{border:1px solid var(--ui-stroke-tertiary);border-radius:8px;background:var(--ui-bg-input);padding:12px 14px;display:grid;gap:10px;box-shadow:inset 3px 0 0 var(--dos-id)}
.dos-out pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:14px;line-height:1.6;color:var(--ui-text-primary)}
.dos-verdict{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:6px;border:1px solid currentColor;background:var(--ui-bg-input);font-size:12px;font-weight:600}
.dos-verdict[data-v=pass]{color:var(--dos-pass)}.dos-verdict[data-v=block]{color:var(--dos-block)}.dos-verdict[data-v=adv]{color:var(--dos-adv)}
.dos-verdict i{width:7px;height:7px;border-radius:50%;background:currentColor}
.dos-verdict[data-v=adv] i{background:transparent;border:1.5px solid currentColor}
.dos-issues{margin:0;padding-left:18px;display:grid;gap:4px;font-size:13px;color:var(--ui-text-secondary)}
.dos-issues b{color:var(--dos-block);font-weight:600;margin-right:4px}
.dos-err{margin:0;font-size:13px;color:var(--dos-block)}
.dos-sum{display:grid;grid-template-columns:128px minmax(48px,1fr) 96px;white-space:nowrap;gap:10px;align-items:center;min-height:32px;border-top:1px solid var(--ui-stroke-quaternary);font-size:13px}
.dos-sum:first-of-type{border-top:0}
.dos-code{font-family:var(--font-mono,ui-monospace,monospace);font-size:12px;color:var(--ui-text-primary)}
.dos-bar{display:flex;gap:2px;height:8px;border-radius:2px;overflow:hidden;background:var(--ui-stroke-quaternary)}
.dos-bar i{display:block;height:100%}
.dos-num{text-align:right;font-variant-numeric:tabular-nums;color:var(--ui-text-secondary)}
.dos-ev{display:grid;grid-template-columns:80px minmax(0,1fr) 52px 104px;white-space:nowrap;gap:10px;align-items:center;min-height:32px;border-top:1px solid var(--ui-stroke-quaternary);font-size:13px;color:var(--ui-text-secondary);font-variant-numeric:tabular-nums}
.dos-ev:first-of-type{border-top:0}
.dos-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px}
.dos-chip{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;min-height:36px;padding:8px 10px;border:1px solid var(--ui-stroke-secondary);border-radius:6px;background:var(--ui-bg-input);font-size:13px;color:var(--ui-text-secondary);transition:background-color .12s,border-color .12s}
.dos-chip:hover{background:var(--ui-row-hover-background);border-color:var(--ui-stroke-primary)}
.dos-chip[aria-pressed=true]{border-color:var(--dos-slab);background:var(--dos-slab);color:#eaf5f6}.dos-chip[aria-pressed=true] .dos-code,.dos-chip[aria-pressed=true] small{color:#eaf5f6}
.dos-chip:focus-visible{outline:2px solid var(--dos-id);outline-offset:2px}
.dos [data-view]:focus,.dos [data-item-id]:focus{outline:2px solid var(--dos-id);outline-offset:2px}
.dos-chip small{margin-left:auto;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
.dos-stale{margin:0;font-size:13px;color:var(--dos-adv)}
.dos-err-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dos-pick{display:grid;gap:5px;font-size:13px;font-weight:500;color:var(--ui-text-secondary)}
@media (prefers-reduced-motion:reduce){.dos *{transition:none!important}}
@container (max-width:760px){.dos{padding:16px 16px 36px;gap:18px}.dos-id{grid-template-columns:52px minmax(0,1fr);gap:2px 14px;padding:16px;background:linear-gradient(rgba(10,52,70,.4),rgba(10,52,70,.4))}.dos-tile{width:52px;height:52px}.dos-tile img{width:40px;height:40px}.dos-title{font-size:22px}.dos-tag{font-size:13px}.dos-fact{padding:8px 16px;flex:1 1 40%;border-bottom:1px solid rgba(234,245,246,.12)}.dos-cols{grid-template-columns:minmax(0,1fr)}.dos select{min-width:0;width:100%}.dos-ev{grid-template-columns:76px minmax(0,1fr) 46px 96px;gap:8px}.dos-ev>*{overflow:hidden;text-overflow:ellipsis}.dos-fact dd{white-space:normal}.dos-grid{grid-template-columns:repeat(auto-fill,minmax(118px,1fr))}}
@container (max-width:420px){.dos-sum{grid-template-columns:minmax(0,1fr) auto;row-gap:4px;padding-block:6px}.dos-sum .dos-bar{grid-column:1/-1;grid-row:2}.dos-ev{grid-template-columns:minmax(0,1fr) auto!important;grid-template-areas:'tool verdict' 'time code';row-gap:2px;padding-block:6px;white-space:normal}.dos-ev>*{overflow:visible!important}.dos-ev>:nth-child(1){grid-area:time}.dos-ev>:nth-child(2){grid-area:tool;color:var(--ui-text-primary)}.dos-ev>:nth-child(3){grid-area:code;text-align:right}.dos-ev>:nth-child(4){grid-area:verdict;text-align:right}.dos button,.dos select,.dos-chip{min-height:44px}.dos-fact{flex-basis:100%}}
`

const PROVIDER_NAMES = { llm: 'LLM', deepl: 'DeepL', libre: 'LibreTranslate', mymemory: 'MyMemory' }
const TOOL_NAMES = { dialectos_translate: 'Translate', dialectos_detect: 'Detect', dialectos_validate: 'Check', dialectos_list_dialects: 'List' }

const post = (ctx, path, body) => ctx.rest(path, { method: 'POST', body })
const ago = ts => (ts ? relativeTime(ts * 1000) : '')

function Verdict({ check }) {
  if (!check) return null
  if (!check.ok && check.valid == null) return jsx('p', { className: 'dos-err', role: 'alert', children: `Check could not run: ${check.error || 'unknown error'}` })
  const blocking = (check.issues || []).filter(i => i.blocking)
  const v = check.valid === true && !blocking.length ? 'pass' : blocking.length ? 'block' : 'adv'
  const label = v === 'pass' ? 'Passed the form checks (meaning not checked)' : v === 'block' ? `${blocking.length} blocking issue${blocking.length === 1 ? '' : 's'}` : 'Did not pass'
  return jsxs('div', { style: { display: 'grid', gap: 8 }, children: [
    jsxs('div', { className: 'dos-row', children: [
      jsxs('span', { className: 'dos-verdict', 'data-v': v, children: [jsx('i', {}), label] }),
      jsx('span', { className: 'dos-why', children: `${check.dialect} · advisory, not proof of meaning` })
    ] }),
    (check.issues || []).length ? jsx('ul', { className: 'dos-issues', children: check.issues.slice(0, 8).map((i, n) =>
      jsxs('li', { children: [i.blocking ? jsx('b', { children: 'Blocking' }) : null, i.message] }, n)) }) : null
  ] })
}

function DialectSelect({ value, onChange, dialects, id }) {
  return jsx('select', { id, value, onChange: e => onChange(e.target.value), children: (dialects.length ? dialects : [{ code: value, name: '' }]).map(d =>
    jsx('option', { value: d.code, children: d.name ? `${d.code} · ${d.name}` : d.code }, d.code)) })
}

function TryIt({ ctx, status, dialects, target, setTarget, refresh }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [out, setOut] = useState(null)
  const provider = status?.provider
  const run = async kind => {
    if (!text.trim()) return
    setBusy(kind); setOut(null)
    try {
      const res = await post(ctx, `/${kind}`, kind === 'translate' ? { text, dialect: target } : { text })
      setOut({ kind, res, text, dialect: target })
    } catch (e) {
      setOut({ kind, res: { ok: false, error: String(e?.message || e) }, text, dialect: target })
    } finally { setBusy(''); refresh() }
  }
  const r = out?.res
  const det = out?.kind === 'detect' && r?.ok ? r.data : null
  const stale = out && (out.text !== text || (out.kind === 'translate' && out.dialect !== target))
  return jsxs('section', { className: 'dos-card', 'data-view': 'translate', tabIndex: -1, 'aria-labelledby': 'dos-try', children: [
    jsxs('div', { children: [jsx('h2', { id: 'dos-try', className: 'dos-label', children: 'Translate or detect' }),
      jsx('p', { className: 'dos-sub', children: 'Detect runs on this machine. Translate sends the text to your provider, then checks the result against your text.' })] }),
    jsxs('label', { className: 'dos-field', children: ['Text', jsx('textarea', { value: text, maxLength: status?.limits?.text || 8000, id: 'dos-text', placeholder: 'Paste English to translate, or Spanish to detect its dialect.', onChange: e => setText(e.target.value) })] }),
    jsxs('div', { className: 'dos-row', children: [
      jsx('label', { htmlFor: 'dos-target', className: 'dos-why', children: 'Into' }),
      jsx(DialectSelect, { id: 'dos-target', value: target, onChange: setTarget, dialects }),
      jsx(Button, { size: 'sm', disabled: !provider || !text.trim() || !!busy, onClick: () => run('translate'), children: busy === 'translate' ? 'Translating…' : 'Translate' }),
      jsx(Button, { size: 'sm', variant: 'ghost', disabled: !text.trim() || !!busy, onClick: () => run('detect'), children: busy === 'detect' ? 'Detecting…' : 'Detect dialect' })
    ] }),
    !provider ? jsx('p', { className: 'dos-why', children: 'Translate is off until you name a provider (llm, deepl, libre or mymemory) in the plugin settings. Detect and checks work without one.' }) : null,
    jsxs('div', { role: 'status', 'aria-live': 'polite', style: { display: 'grid', gap: 10 }, children: [
    stale ? jsx('p', { className: 'dos-stale', children: 'Your text or variant changed after this result. Run it again to update it.' }) : null,
    r && !r.ok ? jsx('p', { className: 'dos-err', role: 'alert', children: r.error || 'DialectOS returned no error message. Try again.' }) : null,
    out?.kind === 'translate' && r?.ok ? jsxs('div', { className: 'dos-out', children: [
      jsxs('div', { className: 'dos-row', style: { justifyContent: 'space-between' }, children: [
        jsx('span', { className: 'dos-why', children: `${r.dialect} via ${PROVIDER_NAMES[provider] || provider}` }),
        jsx(CopyButton, { text: r.text, label: 'Copy', buttonVariant: 'ghost', buttonSize: 'xs' })] }),
      jsx('pre', { lang: r.dialect, children: r.text }),
      stale ? null : jsx(Verdict, { check: r.check })
    ] }) : null,
    det ? jsx('div', { className: 'dos-out', children: det.dialect
      ? jsxs('p', { style: { margin: 0 }, children: [jsx('b', { children: `Looks like ${det.dialect}` }), det.name ? ` · ${det.name}` : '',
          jsx('span', { className: 'dos-why', children: ` · confidence ${Math.round((det.confidence || 0) * 100)}%${det.isReliable === false ? ', low' : ''}${(det.matchedKeywords || []).length ? ` · markers: ${det.matchedKeywords.slice(0, 6).join(', ')}` : ''}` })] })
      : jsx('p', { style: { margin: 0 }, children: 'Not enough regional markers to name a dialect. Short or neutral Spanish often reads the same everywhere.' }) }) : null
    ] })
  ] })
}

function CheckPair({ ctx, dialects, target, setTarget, refresh }) {
  const [source, setSource] = useState('')
  const [translated, setTranslated] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(null)
  const run = async () => {
    setBusy(true); setRes(null)
    const sent = { source, translated, dialect: target }
    try { setRes({ ...(await post(ctx, '/validate', sent)), sent }) }
    catch (e) { setRes({ ok: false, error: String(e?.message || e), sent }) }
    finally { setBusy(false); refresh() }
  }
  const stale = res && (res.sent.source !== source || res.sent.translated !== translated || res.sent.dialect !== target)
  return jsxs('section', { className: 'dos-card', 'data-view': 'check', tabIndex: -1, 'aria-labelledby': 'dos-check', children: [
    jsxs('div', { children: [jsx('h2', { id: 'dos-check', className: 'dos-label', children: 'Check a translation' }),
      jsx('p', { className: 'dos-sub', children: 'Runs on this machine. Checks placeholders, structure and regional terms against the source.' })] }),
    jsxs('label', { className: 'dos-field', children: ['Source', jsx('textarea', { value: source, maxLength: 8000, placeholder: 'The original text, usually English.', onChange: e => setSource(e.target.value) })] }),
    jsxs('label', { className: 'dos-field', children: ['Translation', jsx('textarea', { value: translated, maxLength: 100000, placeholder: 'The Spanish translation you want to check.', onChange: e => setTranslated(e.target.value) })] }),
    jsxs('div', { className: 'dos-row', children: [
      jsx('label', { htmlFor: 'dos-check-d', className: 'dos-why', children: 'Variant' }),
      jsx(DialectSelect, { id: 'dos-check-d', value: target, onChange: setTarget, dialects }),
      jsx(Button, { size: 'sm', disabled: busy || !source.trim() || !translated.trim(), onClick: run, children: busy ? 'Checking…' : 'Check' })] }),
    jsx('div', { role: 'status', 'aria-live': 'polite', children: res ? (stale ? jsx('p', { className: 'dos-stale', children: 'The text or variant changed after this check. Check again to update it.' }) : jsx(Verdict, { check: res })) : null })
  ] })
}

function LoadError({ what, onRetry }) {
  return jsxs('div', { className: 'dos-err-row', role: 'alert', children: [jsx('p', { className: 'dos-err', children: `Could not load ${what}.` }), jsx(Button, { size: 'sm', variant: 'ghost', onClick: onRetry, children: 'Try again' })] })
}

function ByDialect({ ledger, names, failed, retry, item }) {
  const rows = visibleRows((ledger?.by_dialect || []).filter(r => r.dialect !== '-' && r.dialect !== '?'), item)
  return jsxs('section', { className: 'dos-card', 'data-view': 'by_dialect', tabIndex: -1, 'aria-labelledby': 'dos-by', children: [
    jsxs('div', { children: [jsx('h2', { id: 'dos-by', className: 'dos-label', children: 'Checks by dialect' }),
      jsx('p', { className: 'dos-sub', children: 'From the check history. It keeps verdicts only, never your text.' })] }),
    failed ? jsx(LoadError, { what: 'the check history', onRetry: retry })
      : !ledger ? jsx(Skeleton, { style: { height: 90, borderRadius: 6 } })
      : !rows.length ? jsx(EmptyState, { title: 'No checks yet', description: 'Checks the agent or this page runs show up here, per dialect.' })
      : jsx('div', { children: rows.map(r => jsxs('div', { className: 'dos-sum', 'data-item-id': r.dialect, tabIndex: -1, children: [
          jsxs('span', { children: [jsx('span', { className: 'dos-code', children: r.dialect }), names[r.dialect] ? jsx('span', { className: 'dos-why', children: ` ${names[r.dialect].replace(/ Spanish$/, '')}` }) : null] }),
          jsxs('span', { className: 'dos-bar', role: 'img', 'aria-label': `${r.passed} passed, ${r.blocked} blocked, ${r.advisory || 0} did not pass on advisory issues`, children: [
            jsx('i', { style: { width: `${r.checked ? (r.passed / r.checked) * 100 : 0}%`, background: 'var(--dos-id)' } }),
            jsx('i', { style: { width: `${r.checked ? (r.blocked / r.checked) * 100 : 0}%`, background: 'var(--dos-block)' } }),
            jsx('i', { style: { width: `${r.checked ? ((r.advisory || 0) / r.checked) * 100 : 0}%`, background: 'var(--dos-adv)' } })] }),
          jsx('span', { className: 'dos-num', children: r.checked ? `${r.passed} of ${r.checked} passed` : `${r.calls} call${r.calls === 1 ? '' : 's'}` })
        ] }, r.dialect)) })
  ] })
}

function Recent({ ledger, failed, retry, item }) {
  const rows = visibleRows(ledger?.rows || [], item)
  const verdict = r => r.tool !== 'dialectos_validate' ? (r.ok ? 'done' : 'failed')
    : r.passed === true ? 'passed' : r.ok === false || r.passed == null ? 'failed to run' : r.blocking_issue_count ? `${r.blocking_issue_count} blocking` : 'did not pass'
  return jsxs('section', { className: 'dos-card', 'data-view': 'recent', tabIndex: -1, 'aria-labelledby': 'dos-recent', children: [
    jsxs('div', { children: [jsx('h2', { id: 'dos-recent', className: 'dos-label', children: 'Recent' }),
      jsx('p', { className: 'dos-sub', children: ledger ? `${ledger.total} recorded call${ledger.total === 1 ? '' : 's'}` : ' ' })] }),
    failed ? jsx(LoadError, { what: 'recent activity', onRetry: retry })
      : !ledger ? jsx(Skeleton, { style: { height: 90, borderRadius: 6 } })
      : !rows.length ? jsx(EmptyState, { title: 'Nothing yet', description: 'Ask the agent for Spanish, or use the tools above.' })
      : jsx('div', { children: rows.map((r, n) => jsxs('div', { className: 'dos-ev', 'data-item-id': r.dialect, tabIndex: -1, children: [
          jsx('span', { children: ago(r.ts) }),
          jsx('span', { children: `${TOOL_NAMES[r.tool] || r.tool}${r.via === 'page' ? ' · page' : ''}` }),
          jsx('span', { className: 'dos-code', children: r.dialect && r.dialect !== '-' ? r.dialect : '' }),
          jsx('span', { style: { color: r.tool === 'dialectos_validate' ? (r.passed === true ? 'var(--dos-pass)' : r.ok === false || r.passed == null ? 'var(--ui-text-tertiary)' : r.blocking_issue_count ? 'var(--dos-block)' : 'var(--dos-adv)') : undefined }, children: verdict(r) })
        ] }, n)) })
  ] })
}

function Dialects({ dialects, target, setTarget, defaultDialect, failed, retry }) {
  return jsxs('section', { className: 'dos-card', 'data-view': 'dialects', tabIndex: -1, 'aria-labelledby': 'dos-list', children: [
    jsxs('div', { children: [jsx('h2', { id: 'dos-list', className: 'dos-label', children: dialects.length ? `${dialects.length} variants` : 'Variants' }),
      jsx('p', { className: 'dos-sub', children: 'Choose the variant to translate into or check against.' })] }),
    failed ? jsxs('div', { style: { display: 'grid', gap: 8 }, children: [jsx(LoadError, { what: 'the variants', onRetry: retry }), typeof failed === 'string' ? jsx('p', { className: 'dos-why', children: failed }) : null] })
      : !dialects.length ? jsx(Skeleton, { style: { height: 120, borderRadius: 6 } })
      : jsx('div', { className: 'dos-grid', children: dialects.map(d => jsxs('button', { className: 'dos-chip', 'data-item-id': d.code, 'aria-pressed': d.code === target, onClick: () => setTarget(d.code), children: [
          jsx('span', { className: 'dos-code', children: d.code }), jsx('span', { children: d.name.replace(/ Spanish$/, '') }),
          d.code === defaultDialect ? jsx('small', { children: 'default' }) : null] }, d.code)) })
  ] })
}

const fact = (k, v, off) => jsxs('div', { className: 'dos-fact', 'data-off': off ? '' : undefined, children: [jsx('dt', { children: k }), jsx('dd', { children: v })] }, k)

function Learn({ ctx, target, revision }) {
  const [data, setData] = useState(null)
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const currentData = data?.dialect === target ? data : null
  const currentFeedback = feedback?.dialect === target ? feedback.data : null
  const load = async () => {
    const results = await Promise.all(['tip', 'stats', 'quiz'].map(action => ctx.rest(`/learn?action=${action}&dialect=${encodeURIComponent(target)}`)))
    const failed = results.find(r => !r.ok)
    if (failed) throw new Error(failed.error || 'Learning is unavailable.')
    return { tip: results[0].data, stats: results[1].data, quiz: results[2].data, dialect: target }
  }
  useEffect(() => {
    let active = true
    load().then(r => { if (active) { setData(r); setError('') } }, e => { if (active) setError(e.message || 'Could not load Learn.') })
    return () => { active = false }
  }, [ctx, target, revision])
  useEffect(() => { setAnswer(''); setFeedback(null); setError('') }, [target])
  const submit = async e => {
    e.preventDefault()
    if (busy || !answer.trim() || !currentData?.quiz?.concept) return
    setBusy(true); setError('')
    try {
      const res = await post(ctx, '/learn', { action: 'answer', dialect: target, concept: currentData.quiz.concept, answer })
      if (!res.ok) throw new Error(res.error || 'Could not check that answer.')
      setFeedback({ dialect: target, data: res.data }); setAnswer('')
      const refreshed = await load()
      setData(current => current?.dialect === target ? refreshed : current)
    } catch (err) { setError(err.message || 'Could not load Learn.') }
    finally { setBusy(false) }
  }
  return jsxs('section', { className: 'dos-card', 'aria-label': 'Learn', children: [
    jsx('h2', { className: 'dos-label', children: 'Learn' }),
    jsx('p', { className: 'dos-why', children: 'One regional word at a time. Offline, private, whenever you feel like it.' }),
    error ? jsx('p', { className: 'dos-err', role: 'alert', children: error }) : null,
    !currentData && !error ? jsx('p', { children: 'Loading Learn…' }) : null,
    currentData ? jsxs('div', { className: 'dos-cols', children: [
      jsxs('div', { children: [jsx('h3', { children: 'Tip of the day' }),
        jsx('p', { children: `${currentData.tip.englishGloss} · ${currentData.tip.concept}` }),
        jsxs('p', { children: [target, ': ', jsx('strong', { lang: target, children: currentData.tip.term })] }),
        currentData.tip.notes || currentData.tip.register && currentData.tip.register !== 'universal'
          ? jsx('p', { className: 'dos-why', children: [currentData.tip.register, currentData.tip.notes].filter(Boolean).join(' · ') }) : null,
        jsx('ul', { className: 'dos-issues', children: (currentData.tip.contrasts || []).map(r => jsxs('li', { children: [r.variant, ': ', jsx('span', { lang: r.variant, children: r.term })] }, r.variant)) })] }),
      jsxs('div', { children: [jsx('p', { children: `${currentData.stats.due} due · ${currentData.quiz.practice ? 'Just for practice' : 'One quick question'}` }),
        currentData.quiz.concept ? jsxs('form', { onSubmit: submit, children: [
          jsx('label', { className: 'dos-field', children: [currentData.quiz.question,
            jsx('input', { 'aria-label': currentData.quiz.question, value: answer, maxLength: 500, autoComplete: 'off', disabled: busy,
              onChange: e => setAnswer(e.target.value) })] }),
          jsx(Button, { type: 'submit', disabled: busy || !answer.trim(), children: busy ? 'Checking…' : 'Check answer' })] })
          : jsx('p', { children: 'All caught up. Come back when you feel like it.' }),
        jsx('p', { role: 'status', 'aria-live': 'polite', children: currentFeedback
          ? `${currentFeedback.correct ? 'Correct' : 'Good try'} · ${currentFeedback.comparison?.term || currentFeedback.term}. Due ${currentFeedback.card?.due || currentFeedback.due}.` : '' })] })
    ] }) : null
  ] })
}

function DialectosPage({ ctx, events }) {
  const qc = useQueryClient()
  const root = useRef(null)
  const [pane, setPane] = useState(events.snapshot)
  const status = useQuery({ queryKey: [ID, 'status'], queryFn: () => events.read('/status') })
  const list = useQuery({ queryKey: [ID, 'dialects'], queryFn: () => events.read('/dialects'), staleTime: Infinity })
  const ledger = useQuery({ queryKey: [ID, 'ledger'], queryFn: () => events.read('/ledger?limit=40'), refetchInterval: 30_000 })
  const s = status.data
  const ledgerFailed = ledger.isError || (ledger.data && ledger.data.ok === false)
  const ledgerOk = ledgerFailed ? null : ledger.data
  const dialects = list.data?.ok ? list.data.data : []
  const names = Object.fromEntries(dialects.map(d => [d.code, d.name]))
  const [picked, setTarget] = useState(null)
  useEffect(() => events.subscribe(next => {
    setPane(next)
    qc.invalidateQueries({ queryKey: [ID] })
  }), [events, qc])
  useEffect(() => { if (pane.item_id) setTarget(pane.item_id) }, [pane.viewRevision])
  useEffect(() => { focusPaneItem(root.current, pane) }, [pane.viewRevision, list.data, ledger.data])
  const target = picked || s?.default_dialect || 'es-MX'
  const refresh = () => { qc.invalidateQueries?.({ queryKey: [ID, 'ledger'] }); ledger.refetch?.() }
  const shared = { ctx, status: s, dialects, target, setTarget, refresh }
  return jsx('div', { ref: root, className: 'dos-host', children: jsxs('div', { className: 'dos', children: [
    jsxs('header', { className: 'dos-head', children: [
      jsxs('div', { className: 'dos-id', children: [
        jsx('span', { className: 'dos-tile', children: MARK ? jsx('img', { src: `data:image/webp;base64,${MARK}`, alt: '' }) : null }),
        jsx('h1', { className: 'dos-title', children: 'DialectOS' }),
        jsx('p', { className: 'dos-tag', children: 'Spanish for the region you mean, checked before you send it.' })
      ] }),
      status.isError ? null : jsxs('dl', { className: 'dos-facts', children: [
        fact('CLI', s ? (s.cli === 'release' ? `v${s.cli_version} release` : 'custom build') : '…'),
        fact('Provider', s ? (s.provider ? PROVIDER_NAMES[s.provider] : 'none · translate off') : '…', s && !s.provider),
        fact('Default', s?.default_dialect || '…'),
        fact('Chat hint', s ? (s.inject_on_spanish ? 'on' : 'off') : '…'),
        s && !s.runner_found ? fact('Runner', 'Node not found', true) : null
      ] })
    ] }),
    status.isError ? jsx(ErrorState, { title: 'DialectOS backend unavailable', description: 'Turn on the DialectOS plugin, then reopen this page.' }) : null,
    jsxs('p', { className: 'dos-note', children: [jsx('b', { children: 'Checks are advisory.' }), ' A translation can pass with its meaning changed, such as a flipped negation or the wrong sense of a word. Read it before you use it.'] }),
    jsxs('div', { className: 'dos-cols', children: [jsx(TryIt, shared), jsx(CheckPair, shared)] }),
    jsx(Learn, { ctx, target, revision: ledger.dataUpdatedAt }, target),
    jsx(Dialects, { dialects, target, setTarget, defaultDialect: s?.default_dialect, failed: list.isError ? true : list.data && !list.data.ok ? list.data.error : null, retry: () => list.refetch?.() }),
    jsxs('div', { className: 'dos-cols', children: [jsx(ByDialect, { ledger: ledgerOk, names, item: pane.item_id, failed: ledgerFailed, retry: () => ledger.refetch?.() }), jsx(Recent, { ledger: ledgerOk, item: pane.item_id, failed: ledgerFailed, retry: () => ledger.refetch?.() })] })
  ] }) })
}

export default {
  id: ID,
  name: 'DialectOS',
  register(ctx) {
    const events = createPaneEvents(host, ctx)
    ctx.onDispose(() => events.dispose())
    const style = document.createElement('style')
    style.dataset.plugin = ID
    style.textContent = CSS
    document.head.appendChild(style)
    ctx.onDispose(() => style.remove())
    ctx.registerMany([
      { id: 'page', area: ROUTES_AREA, data: { path: PATH }, render: () => jsx(DialectosPage, { ctx, events }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, data: { path: PATH, label: 'DialectOS', codicon: 'globe' } },
      { id: 'open', area: PALETTE_AREA, data: { id: 'dialectos.open', label: 'DialectOS: open', keywords: ['spanish', 'dialect', 'translate', 'localize', 'es-MX'], run: () => host.navigate(PATH) } }
    ])
  }
}
