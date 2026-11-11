import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The shipped plugin imports only host-provided modules. Exercise its event and
// focus code with a local event bus, without loading the Desktop application.
function fixture() {
  const handlers = new Map();
  const navigated = [];
  const host = {
    onEvent(name, handler) { handlers.set(name, handler); return () => handlers.delete(name); },
    navigate(path) { navigated.push(path); },
  };
  const source = readFileSync(new URL('../../plugins/dialectos-hermes/desktop/plugin.js', import.meta.url), 'utf8')
    .replace(/^import [\s\S]*? from ['"][^'"]+['"]\n/gm, '')
    .replace('export default {', 'globalThis.plugin = {');
  const sandbox = { host, ROUTES_AREA: 'routes', SIDEBAR_NAV_AREA: 'sidebar', PALETTE_AREA: 'palette' };
  vm.runInNewContext(source + '\nglobalThis.createPaneEvents = createPaneEvents; globalThis.focusPaneItem = focusPaneItem; globalThis.visibleRows = visibleRows;', sandbox);
  const emit = (name, payload) => handlers.get(`plugin.dialectos.${name}`)?.({ payload });
  return Object.assign(sandbox, { handlers, navigated, emit });
}
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('view request updates an already open route without navigating away from the current page', () => {
  const f = fixture();
  const pane = f.createPaneEvents(f.host, {});
  f.emit('view.set', { view: 'by_dialect', item_id: 'es-AR' });
  assert.deepEqual(f.navigated, []);
  const seen = [];
  const unmount = pane.subscribe(state => seen.push(plain(state)));
  assert.equal(seen[0].view, 'by_dialect');
  assert.equal(seen[0].item_id, 'es-AR');
  f.emit('ledger.updated', { count: 1 });
  assert.equal(seen.length, 2);
  unmount();
  f.emit('view.set', { view: 'recent' });
  assert.equal(seen.length, 2);
  pane.dispose();
  assert.equal(f.handlers.size, 0);
});

test('every real section is accepted and an omitted item clears old focus', () => {
  const f = fixture();
  const pane = f.createPaneEvents(f.host, {});
  for (const view of ['translate', 'check', 'dialects', 'by_dialect', 'recent']) {
    f.emit('view.set', { view, item_id: 'es-MX' });
    assert.equal(pane.snapshot().view, view);
  }
  f.emit('view.set', { view: 'recent' });
  assert.equal(pane.snapshot().item_id, null);
  pane.dispose();
});

test('invalid events cannot navigate, refresh or change focus', () => {
  const f = fixture();
  const pane = f.createPaneEvents(f.host, {});
  const initial = pane.snapshot();
  f.handlers.get('plugin.dialectos.view.set')(null);
  f.handlers.get('plugin.dialectos.ledger.updated')();
  for (const p of [null, [], {}, { view: 'unknown' }, { view: 'x'.repeat(1000) },
    { view: 'recent', item_id: 'private text' }, { view: 'recent', item_id: 'es-AR\n' },
    { view: 'recent', item_id: null }, { view: 'recent', text: 'private' }]) f.emit('view.set', p);
  for (const p of [null, [], {}, { count: -1 }, { count: 201 }, { count: true }, { count: 1.5 },
    { count: 1, text: 'private' }]) f.emit('ledger.updated', p);
  assert.equal(pane.snapshot(), initial);
  assert.deepEqual(f.navigated, []);
  pane.dispose();
});

test('a live event discards a stale REST snapshot already in flight', async () => {
  const f = fixture();
  const old = deferred();
  const paths = [];
  const pane = f.createPaneEvents(f.host, { rest(path) { paths.push(path); return paths.length === 1 ? old.promise : Promise.resolve({ total: 2 }); } });
  const pending = pane.read('/ledger?limit=40');
  f.emit('ledger.updated', { count: 2 });
  f.emit('view.set', { view: 'recent', item_id: 'es-AR' });
  old.resolve({ total: 1 });
  assert.deepEqual(await pending, { total: 2 });
  assert.deepEqual(paths, ['/ledger?limit=40', '/ledger?limit=40']);
  assert.equal(pane.snapshot().item_id, 'es-AR');
  pane.dispose();
});

test('a stale REST error is retried, while a current error reaches the page', async () => {
  const f = fixture();
  const old = deferred();
  let calls = 0;
  const pane = f.createPaneEvents(f.host, { rest() { return ++calls === 1 ? old.promise : Promise.resolve({ ok: true }); } });
  const pending = pane.read('/ledger');
  f.emit('ledger.updated', { count: 1 });
  old.reject(new Error('old failure'));
  assert.deepEqual(await pending, { ok: true });
  pane.dispose();
  const broken = f.createPaneEvents(f.host, { rest() { throw new Error('current failure'); } });
  await assert.rejects(broken.read('/ledger'), /current failure/);
  broken.dispose();
});

test('focus points to a dialect item or falls back to its section while data loads', () => {
  const f = fixture();
  const calls = [];
  const item = { scrollIntoView: () => calls.push('item scroll'), focus: () => calls.push('item focus') };
  const section = { querySelector: selector => selector === '[data-item-id="es-AR"]' ? item : null,
    scrollIntoView: () => calls.push('section scroll'), focus: () => calls.push('section focus') };
  const root = { querySelector: selector => selector === '[data-view="dialects"]' ? section : null };
  f.focusPaneItem(root, { view: 'dialects', item_id: 'es-AR' });
  f.focusPaneItem(root, { view: 'dialects', item_id: 'es-US' });
  f.focusPaneItem(null, { view: 'dialects' });
  assert.deepEqual(calls, ['item scroll', 'item focus', 'section scroll', 'section focus']);
});

test('registration listens before the page mounts without navigating on a view event', () => {
  const f = fixture();
  const cleanups = [];
  let removed = false;
  let routes;
  f.document = { createElement: () => ({ dataset: {}, remove: () => { removed = true; } }), head: { appendChild() {} } };
  // Register uses the same global object the bundle was evaluated in.
  vm.runInNewContext('plugin.register(ctx)', { ...f, ctx: { onDispose: fn => cleanups.push(fn), registerMany: items => { routes = items; }, rest() {} } });
  assert.ok(routes.some(r => r.id === 'page'));
  f.emit('view.set', { view: 'check' });
  assert.deepEqual(f.navigated, []);
  for (const dispose of cleanups) dispose();
  assert.equal(f.handlers.size, 0);
  assert.equal(removed, true);
});

test('the explicit palette command remains the route opener', () => {
  const f = fixture();
  let routes;
  f.document = { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } };
  f.plugin.register({ onDispose() {}, registerMany: items => { routes = items; }, rest() {} });
  routes.find(r => r.id === 'open').data.run();
  assert.deepEqual(f.navigated, ['/dialectos']);
});

test('the mounted page refreshes on events and removes its listener on unmount', async () => {
  const f = fixture();
  const effects = [];
  const invalidations = [];
  const queries = [];
  const cleanups = [];
  let routes;
  Object.assign(f, {
    document: { createElement: () => ({ dataset: {}, remove() {} }), head: { appendChild() {} } },
    useState: init => [typeof init === 'function' ? init() : init, () => {}],
    useRef: () => ({ current: null }),
    useEffect: effect => effects.push(effect),
    useQueryClient: () => ({ invalidateQueries: opts => invalidations.push(plain(opts)) }),
    useQuery: opts => { queries.push(opts); return {}; },
    jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }),
  });
  f.plugin.register({ onDispose: fn => cleanups.push(fn), registerMany: items => { routes = items; }, rest: async () => ({ ok: true }) });
  const page = routes.find(r => r.id === 'page').render();
  page.type(page.props);
  const unmount = effects.map(effect => effect()).filter(fn => typeof fn === 'function');
  const before = invalidations.length;
  f.emit('ledger.updated', { count: 1 });
  assert.equal(invalidations.length, before + 1);
  assert.deepEqual(invalidations.at(-1), { queryKey: ['dialectos'] });
  assert.deepEqual(await queries.find(q => q.queryKey[1] === 'ledger').queryFn(), { ok: true });
  unmount.forEach(fn => fn());
  f.emit('ledger.updated', { count: 2 });
  assert.equal(invalidations.length, before + 1);
  cleanups.forEach(fn => fn());
});

test('a focused dialect remains visible outside the initial ten summary or recent rows', () => {
  const f = fixture();
  const rows = Array.from({ length: 12 }, (_, n) => ({ dialect: `row-${n}` }));
  rows[11].dialect = 'es-AR';
  assert.equal(f.visibleRows(rows, null).length, 10);
  const visible = f.visibleRows(rows, 'es-AR');
  assert.equal(visible.length, 11);
  assert.equal(visible[10], rows[11]);
  assert.equal(f.visibleRows(rows, 'row-0').length, 10);
});
