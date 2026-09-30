# Codex fact-check — refreshed comparison listicles (DocTalk, Release B)

Do NOT run git. Read these files (repo root = cwd):
- frontend/content/blog/chatpdf-alternatives-2026.md
- frontend/content/blog/best-ai-pdf-tools-2026.md
- frontend/content/blog/best-ai-tools-academic-research-2026.md
- The research they are based on: .collab/reviews/2026-10-01-listicle-refresh/competitor-facts-2026-09-30.md (checked 2026-09-30; "direct" = vendor page opened; "search-only" = lower confidence)
- DocTalk product rules: CLAUDE.md, .claude/rules/frontend.md (Quote Finder trust copy: no unconditional word-for-word/verbatim claim; free plan copy: 500 starter credits then 300/month from month two; plans Plus $9.99/3,000 credits, Pro $19.99/9,000 credits; page caps 750/1,500/3,000; two modes Flash/Pro; layout translation must not over-promise), frontend/src/i18n/locales/en.json for the product's own wording, frontend/tests/free-plan-credit-copy.test.cjs.

Check, adversarially:
1. Every competitor claim in the three posts vs the research file. Flag: (a) claims stated as fact that the research marks search-only/unverified, without a hedge; (b) numbers that differ from the research; (c) claims in the posts not supported by the research at all (the writer's own knowledge) — list each with a suggested hedge or removal. Pay special attention to: ScholarAI section, Consensus "Deep" price ($65/mo or $540/yr — the research text has a self-correction; decide if the post reads it correctly), ChatDOC pricing cadence, Gemini Notebook rename date/claims, Claude limits, Humata limits.
2. Every DocTalk claim vs the product rules and code (e.g. Quote Finder "copy with APA in-text citation", "evidence board", "OCR for scanned PDFs", "AES-256", "does not use documents for AI training", "DocTalk answers within one document per chat session and uses collections", "Interface in 11 languages", demo without signup). Grep the frontend/backend to confirm each; flag anything not true or overstated.
3. Fairness/defamation risk: anything that disparages a competitor without support.
4. Markdown/rendering issues (tables, footnote marker "¹", links to routes that do not exist — check frontend/src/app for each internal link).
Output numbered findings with severity (BLOCKER / SHOULD / NIT), file:line, and a concrete fix. Final line: SHIP / SHIP-WITH-FIXES / REWORK.
