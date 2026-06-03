> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# PR Draft: Add DialectOS to awesome-nlp

**Repo to submit to:** `keon/awesome-nlp`
**Your fork:** `simongonzalezdc/awesome-nlp` (fork if needed)
**Branch to create:** `add-dialectos`

---

## Step 1: Fork and edit

Fork `keon/awesome-nlp`, then edit `README.md`.

Find the section for **Translation** or **Multilingual NLP** tools.

Add this line alphabetically:

```markdown
- [DialectOS](https://github.com/KyaniteLabs/DialectOS) - Spanish dialect translation server with 25 regional variants, MCP integration, structure-preserving markdown translation, and adversarial quality gates.
```

## Step 2: Commit and push

```bash
git checkout -b add-dialectos
git add README.md
git commit -m "Add DialectOS to translation tools"
git push origin add-dialectos
```

## Step 3: Create PR

**Title:** `Add DialectOS — Spanish dialect translation with MCP support`

**Body:**
```
DialectOS is an open-source translation engine focused on Spanish regional dialects:

- 25 Spanish dialects with vocabulary, grammar, and register adaptation
- 17 MCP (Model Context Protocol) tools for AI assistant integration
- Structure-preserving markdown translation
- Adversarial quality gates (semantic drift, negation, structure validation)
- i18n locale file diff/merge
- Gender-neutral language support
- automated tests
```
