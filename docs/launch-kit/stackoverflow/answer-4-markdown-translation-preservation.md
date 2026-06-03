> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Stack Overflow Answer: Translating markdown while preserving structure

**Question to search for:** "translate markdown file preserving structure" or "how to translate markdown documentation programmatically"

**Tags to target:** `markdown`, `translation`, `documentation`, `api`, `i18n`

---

Translating markdown docs is harder than plain text because you must preserve:
- Code fences and language tags
- Table structure and alignment
- Links and image references
- Header hierarchy
- Bold/italic/inline code

**Most translation APIs destroy this.** They treat markdown as plain text.

**[DialectOS](https://github.com/KyaniteLabs/DialectOS)** has a dedicated `translate_markdown` tool that:

1. Parses markdown into an AST
2. Extracts only translatable text nodes
3. Translates each node with dialect context
4. Rebuilds the markdown with original structure intact

```bash
# CLI
dialectos translate-readme README.md --dialect es-MX --output README.es-MX.md

# MCP tool
translate_markdown({
  "markdown": "# Hello\n\n| Col1 | Col2 |\n|------|------|\n| A | B |",
  "targetDialect": "es-MX"
})
```

**Also handles:**
- API documentation with tables
- Locale JSON files
- Code comments (translate comments, preserve code)
- Bilingual side-by-side documents

**Quality gates verify:**
- Table column count matches
- Code fences are preserved
- No HTML injection in output
- Semantic meaning intact

automated tests, open-source (Apache-2.0).
