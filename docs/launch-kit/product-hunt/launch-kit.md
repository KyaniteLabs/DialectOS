> Status: draft, not approved for publication. Do not publish until `docs/plans/2026-05-10-launch-remediation-plan.md` final launch gates pass.
>
# Product Hunt Launch Kit

**Launch day:** Tuesday (highest engagement day)
**Launch time:** 12:01 AM PT (right when the day starts)

---

## Product Info

**Name:** DialectOS
**Tagline:** The first MCP server for Spanish dialects — 25 variants, quality gates, structure preservation
**Description:**

DialectOS is an open-source Spanish dialect translation server that runs as an MCP (Model Context Protocol) tool and CLI. It translates English and other languages into 25 regional Spanish variants while preserving markdown structure, enforcing glossary terms, and applying adversarial quality gates that catch semantic drift before it reaches users.

**Topics:** Developer Tools, AI, open-source, Translation
**Website:** https://kyanitelabs.github.io/DialectOS
**GitHub:** https://github.com/KyaniteLabs/DialectOS

---

## Gallery Images (5 images, 1270×760px each)

**Image 1: The Hook**
Title: "25 Spanish Dialects"
Visual: Map of Latin America with dialect codes highlighted
Text: "Google Translate has 1 Spanish option. We built 25."

**Image 2: The Problem**
Title: "Generic Spanish Fails"
Visual: Side-by-side comparison table
Text: "Orange juice → Puerto Rico: jugo de china. Not jugo de naranja."

**Image 3: MCP Integration**
Title: "Works Where You Work"
Visual: Claude Desktop / Cursor screenshots with DialectOS tools
Text: "17 MCP tools for AI assistants. Translate natively inside Claude."

**Image 4: Quality Gates**
Title: "Bad Translations Can't Hide"
Visual: Receipt-style quality report
Text: "4 quality gates + semantic backstop. Auto-reject negation drops."

**Image 5: The Numbers**
Title: "Built for Audits"
Visual: Metrics dashboard
Text: "automated tests · 25 dialects · 17 MCP tools · 0 silent fallbacks"

---

## Maker Comment (First Comment)

Hey Product Hunt! 👋

Simon here, builder of DialectOS.

We built this after a real production incident: we shipped Spain Spanish to Mexico, and users thought we were being intentionally rude. That's when we learned that "Spanish" is not one language — it's 25 regional variants with different vocabulary, grammar, and formality levels.

**Three things I'm most proud of:**

1. **MCP-native** — DialectOS isn't a web app you copy-paste into. It's 17 tools that Claude Desktop, Cursor, and any MCP client can use natively.

2. **Adversarial quality gates** — We don't trust translations blindly. If "Do not click" becomes "Haz clic" (the opposite meaning), it's auto-rejected. We maintain a corpus of semantic traps and run them against every release.

3. **automated tests for v0.3.0** — We test harder than we market. Grammar detection (voseo, leísmo, laísmo), semantic backstop, translation memory torture tests — everything is tested.

**Tech stack:** TypeScript monorepo, pnpm workspace, 7 packages, stdio MCP.

Would love your feedback on the architecture, the quality gate design, or any Spanish localization horror stories you have. 🙏

---

## Hunter Strategy

If you don't have a top hunter:
- Post yourself as a maker
- Share on Twitter/LinkedIn immediately after posting
- Ask friends to upvote in the first hour (critical for ranking)
- Respond to every comment within 15 minutes

**Do NOT:**
- Ask for upvotes directly (against PH rules)
- Use upvote rings or bots
- Post on weekends

---

## Launch Day Schedule

**12:01 AM PT — Launch**
- Post goes live
- Share on personal Twitter/LinkedIn
- Share in relevant Slack/Discord communities

**7:00 AM PT — Morning Push**
- Share on r/selfhosted, r/LocalLLaMA, r/javascript
- Email newsletter to any existing contacts

**9:00 AM PT — Engagement Peak**
- Respond to all PH comments
- Post Twitter thread
- Share on Hacker News (Show HN)

**12:00 PM PT — Midday Boost**
- Share on LinkedIn
- Reply to any new PH comments
- Share in MCP Discord, AI dev Discords

**5:00 PM PT — Evening Push**
- Final social push
- Thank commenters
- Monitor ranking

---

## Follow-Up

**Day 2:**
- Thank everyone who supported
- Share "Day 1 recap" on Twitter
- Add PH badge to README

**Day 7:**
- Post "What we learned from our Product Hunt launch" on Dev.to
- Update roadmap based on feedback
