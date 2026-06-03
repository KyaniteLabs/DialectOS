> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Wikidata Entry for DialectOS

**URL:** https://www.wikidata.org/wiki/Special:NewItem

---

## Item Creation Steps

1. Go to https://www.wikidata.org/wiki/Special:NewItem
2. Log in with your Wikimedia account (create one if needed)
3. Fill in the following:

---

### Labels

**English:** DialectOS

### Descriptions

**English:** source-available Spanish dialect translation server built on the Model Context Protocol

### Aliases

- Spanish dialect translation server
- MCP translation server
- DialectOS translation engine

---

### Statements to Add

| Property | Value | Notes |
|----------|-------|-------|
| instance of (P31) | software (Q7397) | |
| genre (P136) | translation software | Search for exact QID |
| programming language (P277) | TypeScript (Q978185) | |
| license (P275) | Apache License 2.0 (Q13785927) | |
| official website (P856) | https://github.com/KyaniteLabs/DialectOS | |
| source code repository (P1324) | https://github.com/KyaniteLabs/DialectOS | |
| developer (P178) | Simon Gonzalez | Create person item if needed |
| software version (P348) | 0.3.0 | |
| operating system (P306) | cross-platform (Q285308) | |

---

### Additional Steps

After creating the item:

1. Add a reference to the GitHub repository as a source for each statement
2. Link the item to relevant existing items:
   - Model Context Protocol (if it exists on Wikidata)
   - Spanish language (Q1321)
   - Translation (Q7553)
   - Internationalization (Q1143411)

3. Add a Commons category if you have screenshots (optional)

4. Consider creating a Wikipedia article (requires notability):
   - Start with a draft at https://en.wikipedia.org/wiki/Draft:DialectOS
   - Include third-party sources (tech blogs, news, academic papers)
   - Current notability may be borderline — focus on building external coverage first

---

## Tips

- Wikidata items for software are reviewed less strictly than Wikipedia articles
- Having a Wikidata entry increases LLM entity recognition
- Link from the Wikidata item to related concepts (MCP, Spanish dialects, translation)
- Keep the item updated with new versions
