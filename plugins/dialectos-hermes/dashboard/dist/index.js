/* DialectOS dashboard tab. Hand-written plain JS (no build step) against the web
 * dashboard SDK on window.__HERMES_PLUGIN_SDK__, same pattern as memory-wiki.
 * Reads the shared backend at /api/plugins/dialectos/. Detect and Check run on
 * this machine; Translate sends the text to the provider named in settings. */
(() => {
  var SDK = window.__HERMES_PLUGIN_SDK__;
  var React = SDK.React;
  var h = React.createElement;
  var useState = SDK.hooks.useState, useEffect = SDK.hooks.useEffect, useCallback = SDK.hooks.useCallback;
  var C = SDK.components;
  var Card = C.Card, CardHeader = C.CardHeader, CardTitle = C.CardTitle, CardContent = C.CardContent, Badge = C.Badge, Button = C.Button;
  var API = "/api/plugins/dialectos";
  var PROVIDERS = { llm: "LLM", deepl: "DeepL", libre: "LibreTranslate", mymemory: "MyMemory" };
  var TOOLS = { dialectos_translate: "Translate", dialectos_detect: "Detect", dialectos_validate: "Check", dialectos_list_dialects: "List" };
  var FIELD = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm";

  function post(path, body) {
    return SDK.fetchJSON(API + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  function ago(ts) {
    if (!ts) return "";
    return new Date(ts * 1e3).toLocaleString(void 0, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function Verdict(props) {
    var c = props.check;
    if (!c) return null;
    if (!c.ok && c.valid == null) return h("p", { role: "alert", className: "text-sm" }, "Check could not run: " + (c.error || "unknown error"));
    var issues = c.issues || [];
    var blocking = issues.filter(function (i) { return i.blocking; }).length;
    var label = c.valid === true && !blocking ? "Passed the form checks (meaning not checked)" : blocking ? blocking + " blocking issue" + (blocking === 1 ? "" : "s") : "Did not pass";
    return h("div", { className: "space-y-2" },
      h("div", { className: "flex flex-wrap items-center gap-2 text-sm" },
        h(Badge, { variant: c.valid === true && !blocking ? "default" : "outline" }, label),
        h("span", { className: "text-muted-foreground" }, c.dialect + " · advisory, not proof of meaning")),
      issues.length ? h("ul", { className: "list-disc pl-5 text-sm text-muted-foreground space-y-1" }, issues.slice(0, 8).map(function (i, n) {
        return h("li", { key: n }, i.blocking ? h("strong", { className: "mr-1" }, "Blocking") : null, i.message);
      })) : null);
  }

  function DialectSelect(props) {
    var list = props.dialects.length ? props.dialects : [{ code: props.value, name: "" }];
    return h("select", { "aria-label": "Dialect", className: "rounded-md border border-border bg-background px-2 py-1 text-sm", value: props.value, onChange: function (e) { props.onChange(e.target.value); } },
      list.map(function (d) { return h("option", { key: d.code, value: d.code }, d.name ? d.code + " · " + d.name : d.code); }));
  }

  function TryIt(props) {
    var t = useState(""), text = t[0], setText = t[1];
    var b = useState(""), busy = b[0], setBusy = b[1];
    var o = useState(null), out = o[0], setOut = o[1];
    var provider = props.status && props.status.provider;
    function run(kind) {
      if (!text.trim()) return;
      setBusy(kind); setOut(null);
      post("/" + kind, kind === "translate" ? { text: text, dialect: props.target } : { text: text })
        .then(function (r) { setOut({ kind: kind, res: r, text: text, dialect: props.target }); }, function (e) { setOut({ kind: kind, res: { ok: false, error: (e && e.message) || "request failed" }, text: text, dialect: props.target }); })
        .finally(function () { setBusy(""); props.refresh(); });
    }
    var r = out && out.res, det = out && out.kind === "detect" && r && r.ok ? r.data : null;
    var stale = !!out && (out.text !== text || (out.kind === "translate" && out.dialect !== props.target));
    return h(Card, null,
      h(CardHeader, { className: "pb-3" }, h(CardTitle, { className: "text-base" }, "Translate or detect"),
        h("p", { className: "text-sm text-muted-foreground" }, "Detect runs on this machine. Translate sends the text to your provider, then checks the result against your text.")),
      h(CardContent, { className: "space-y-3" },
        h("textarea", { "aria-label": "Text", className: FIELD, rows: 4, maxLength: 8000, value: text, placeholder: "Paste English to translate, or Spanish to detect its dialect.", onChange: function (e) { setText(e.target.value); } }),
        h("div", { className: "flex flex-wrap items-center gap-2" },
          h(DialectSelect, { value: props.target, onChange: props.setTarget, dialects: props.dialects }),
          h(Button, { size: "sm", disabled: !provider || !text.trim() || !!busy, onClick: function () { run("translate"); } }, busy === "translate" ? "Translating…" : "Translate"),
          h(Button, { size: "sm", variant: "outline", disabled: !text.trim() || !!busy, onClick: function () { run("detect"); } }, busy === "detect" ? "Detecting…" : "Detect dialect")),
        !provider ? h("p", { className: "text-sm text-muted-foreground" }, "Translate is off until you name a provider in the plugin settings. Detect and checks work without one.") : null,
        h("div", { role: "status", "aria-live": "polite", className: "space-y-3" },
        stale ? h("p", { className: "text-sm text-muted-foreground" }, "Your text or variant changed after this result. Run it again to update it.") : null,
        r && !r.ok ? h("p", { role: "alert", className: "text-sm" }, r.error || "DialectOS returned no error message. Try again.") : null,
        out && out.kind === "translate" && r && r.ok ? h("div", { className: "space-y-2 rounded-md border border-border p-3" },
          h("p", { className: "text-xs text-muted-foreground" }, r.dialect + " via " + (PROVIDERS[provider] || provider)),
          h("p", { lang: r.dialect, className: "whitespace-pre-wrap text-sm" }, r.text),
          stale ? null : h(Verdict, { check: r.check })) : null,
        det ? h("p", { className: "rounded-md border border-border p-3 text-sm" }, det.dialect
          ? "Looks like " + det.dialect + (det.name ? " · " + det.name : "") + " · confidence " + Math.round((det.confidence || 0) * 100) + "%" + (det.isReliable === false ? ", low" : "")
          : "Not enough regional markers to name a dialect.") : null)));
  }

  function CheckPair(props) {
    var s = useState(""), source = s[0], setSource = s[1];
    var t = useState(""), translated = t[0], setTranslated = t[1];
    var b = useState(false), busy = b[0], setBusy = b[1];
    var r = useState(null), res = r[0], setRes = r[1];
    function run() {
      setBusy(true); setRes(null);
      var sent = { source: source, translated: translated, dialect: props.target };
      post("/validate", sent)
        .then(function (r) { setRes(Object.assign({}, r, { sent: sent })); }, function (e) { setRes({ ok: false, error: (e && e.message) || "request failed", sent: sent }); })
        .finally(function () { setBusy(false); props.refresh(); });
    }
    return h(Card, null,
      h(CardHeader, { className: "pb-3" }, h(CardTitle, { className: "text-base" }, "Check a translation"),
        h("p", { className: "text-sm text-muted-foreground" }, "Runs on this machine. Checks placeholders, structure and regional terms against the source.")),
      h(CardContent, { className: "space-y-3" },
        h("textarea", { "aria-label": "Source", className: FIELD, rows: 3, maxLength: 8000, placeholder: "The original text, usually English.", value: source, onChange: function (e) { setSource(e.target.value); } }),
        h("textarea", { "aria-label": "Translation", className: FIELD, rows: 3, maxLength: 100000, placeholder: "The Spanish translation you want to check.", value: translated, onChange: function (e) { setTranslated(e.target.value); } }),
        h("div", { className: "flex flex-wrap items-center gap-2" },
          h(DialectSelect, { value: props.target, onChange: props.setTarget, dialects: props.dialects }),
          h(Button, { size: "sm", disabled: busy || !source.trim() || !translated.trim(), onClick: run }, busy ? "Checking…" : "Check")),
        h("div", { role: "status", "aria-live": "polite" }, res ? (res.sent.source !== source || res.sent.translated !== translated || res.sent.dialect !== props.target
          ? h("p", { className: "text-sm text-muted-foreground" }, "The text or variant changed after this check. Check again to update it.")
          : h(Verdict, { check: res })) : null)));
  }

  function DialectosPage() {
    var st = useState(null), status = st[0], setStatus = st[1];
    var dl = useState([]), dialects = dl[0], setDialects = dl[1];
    var lg = useState(null), ledger = lg[0], setLedger = lg[1];
    var er = useState(null), error = er[0], setError = er[1];
    var tg = useState(null), picked = tg[0], setTarget = tg[1];

    var loadLedger = useCallback(function () {
      SDK.fetchJSON(API + "/ledger?limit=20").then(function (r) { setLedger(r && r.ok === false ? { failed: true } : r); }, function () { setLedger({ failed: true }); });
    }, []);
    useEffect(function () {
      SDK.fetchJSON(API + "/status").then(function (s) { setStatus(s); setError(null); }, function (e) { setError((e && e.message) || "DialectOS's backend is not answering"); });
      SDK.fetchJSON(API + "/dialects").then(function (r) { if (r && r.ok) setDialects(r.data); }, function () {});
      loadLedger();
    }, [loadLedger]);

    var target = picked || (status && status.default_dialect) || "es-MX";
    var shared = { status: status, dialects: dialects, target: target, setTarget: setTarget, refresh: loadLedger };
    var head = h("div", null,
      h("h1", { className: "text-xl font-semibold" }, "DialectOS"),
      h("p", { className: "text-sm text-muted-foreground" }, "Spanish for the region you mean, checked before you send it."));
    if (error) return h("div", { className: "space-y-6" }, head, h("div", { role: "alert", className: "rounded-md border border-border p-3 text-sm" }, error + ". Turn on the DialectOS plugin, then reload."));

    var by = ((ledger && ledger.by_dialect) || []).filter(function (r) { return r.dialect !== "-" && r.dialect !== "?"; }).slice(0, 10);
    var rows = ((ledger && ledger.rows) || []).slice(0, 10);
    return h("div", { className: "space-y-6" }, head,
      h(Card, null, h(CardContent, { className: "pt-6 flex flex-wrap items-center gap-2 text-sm" },
        h(Badge, { variant: "outline" }, "CLI " + (status ? (status.cli === "release" ? "v" + status.cli_version + " release" : "custom build") : "…")),
        h(Badge, { variant: "outline" }, "Provider " + (status ? (status.provider ? PROVIDERS[status.provider] : "none, translate off") : "…")),
        h(Badge, { variant: "outline" }, "Default " + ((status && status.default_dialect) || "…")),
        h(Badge, { variant: "outline" }, "Chat hint " + (status ? (status.inject_on_spanish ? "on" : "off") : "…")),
        status && !status.runner_found ? h(Badge, { variant: "destructive" }, "Node not found") : null)),
      h("div", { role: "note", className: "rounded-md border border-border p-3 text-sm" },
        h("strong", null, "Checks are advisory. "), "A translation can pass with its meaning changed, such as a flipped negation or the wrong sense of a word. Read it before you use it."),
      h("div", { className: "grid gap-4 lg:grid-cols-2" }, h(TryIt, shared), h(CheckPair, shared)),
      h("div", { className: "grid gap-4 lg:grid-cols-2" },
        h(Card, null,
          h(CardHeader, { className: "pb-3" }, h(CardTitle, { className: "text-base" }, "Checks by dialect")),
          h(CardContent, null, !ledger ? h("p", { className: "text-sm text-muted-foreground" }, "Loading…")
            : ledger.failed ? h("div", { role: "alert", className: "flex flex-wrap items-center gap-2 text-sm" }, "Could not load the check history.", h(Button, { size: "sm", variant: "outline", onClick: loadLedger }, "Try again"))
            : !by.length ? h("p", { className: "text-sm text-muted-foreground" }, "No checks yet. Checks the agent or this tab runs show up here. Verdicts only, never your text.")
            : h("ul", { className: "space-y-2" }, by.map(function (r) {
                return h("li", { key: r.dialect, className: "flex items-center gap-3 text-sm" },
                  h("code", { className: "mr-auto" }, r.dialect),
                  h("span", { className: "text-muted-foreground" }, r.checked ? r.passed + " of " + r.checked + " passed" : r.calls + " call" + (r.calls === 1 ? "" : "s")));
              })))),
        h(Card, null,
          h(CardHeader, { className: "pb-3" }, h(CardTitle, { className: "text-base" }, "Recent")),
          h(CardContent, null, !ledger ? h("p", { className: "text-sm text-muted-foreground" }, "Loading…")
            : ledger.failed ? h("div", { role: "alert", className: "flex flex-wrap items-center gap-2 text-sm" }, "Could not load the check history.", h(Button, { size: "sm", variant: "outline", onClick: loadLedger }, "Try again"))
            : !rows.length ? h("p", { className: "text-sm text-muted-foreground" }, "Nothing yet. Ask the agent for Spanish, or use the tools above.")
            : h("ul", { className: "space-y-2" }, rows.map(function (r, n) {
                var v = r.tool !== "dialectos_validate" ? (r.ok ? "done" : "failed") : r.passed === true ? "passed" : r.ok === false || r.passed == null ? "failed to run" : r.blocking_issue_count ? r.blocking_issue_count + " blocking" : "did not pass";
                return h("li", { key: n, className: "flex items-center gap-3 text-sm" },
                  h("span", { className: "w-28 text-muted-foreground" }, ago(r.ts)),
                  h("span", { className: "mr-auto" }, (TOOLS[r.tool] || r.tool) + (r.dialect && r.dialect !== "-" ? " · " + r.dialect : "")),
                  h(Badge, { variant: "outline" }, v));
              }))))));
  }

  window.__HERMES_PLUGINS__.register("dialectos", DialectosPage);
})();
