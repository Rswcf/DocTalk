# Codex fact-check of the refreshed listicles (gpt-5.5, 2026-10-01) — final section

codex
Read-only review complete. I did not run `git`.

1. **BLOCKER** — Future `updated` dates.
`frontend/content/blog/chatpdf-alternatives-2026.md:5`, `frontend/content/blog/best-ai-pdf-tools-2026.md:5`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:5`
All three say `updated: "2026-10-07"`, which is future-dated for this review. The blog renderer exposes this visibly and in metadata/JSON-LD via `post.updated` ([BlogPostClient.tsx](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/blog/[slug]/BlogPostClient.tsx:262), [page.tsx](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/blog/[slug]/page.tsx:35)).
Fix: set to the real publication/modification date, e.g. `2026-10-01` if publishing now, or `2026-09-30` if tied to the research check.

2. **BLOCKER** — Academic post overstates sourcing coverage.
`frontend/content/blog/best-ai-tools-academic-research-2026.md:24`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:298`
It says prices/limits come from each vendor’s own pricing page, but the research file only has direct one-liners for Elicit/Connected Papers and search-only for Semantic Scholar; ScholarAI/Zotero feature claims are not supported by this research file.
Fix: rewrite the methodology to separate direct vendor-verified facts from search-only/unrefreshed product descriptions, or remove unsupported sections.

3. **BLOCKER** — ScholarAI section is essentially unsupported.
`frontend/content/blog/best-ai-tools-academic-research-2026.md:242`
Claims about current GPT availability, own-site offering, open-access focus, access limits, and pricing are not backed by the research file.
Fix: source ScholarAI directly, or replace with: “ScholarAI has existed as a ChatGPT-era research-search tool; we did not verify its current pricing or access model in this refresh.”

4. **BLOCKER** — Consensus limitations include unsupported negative claims.
`frontend/content/blog/best-ai-tools-academic-research-2026.md:125`
Research supports Consensus pricing, 220M+ papers, Deep reviews, discounts, and paper links. It does not support “consensus meter” detail, DOI-per-claim links, “weaker in humanities/engineering,” or “sometimes surfaces low-quality or irrelevant studies.”
Fix: keep the verified claims, change “via DOI” to “links to papers,” and remove or source the discipline/quality criticisms.

5. **SHOULD** — Elicit, Connected Papers, Semantic Scholar, and Zotero feature lists exceed the supplied research.
`frontend/content/blog/best-ai-tools-academic-research-2026.md:148`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:172`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:195`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:219`
These sections contain many product/quality claims not in the research file. The Semantic Scholar negative claims are especially risky because the only research note is search-only.
Fix: either add direct source research for each section or label them as unrefreshed/product-positioning summaries and remove unsupported negative assertions.

6. **SHOULD** — AskYourPDF integration claims need a hedge/source.
`frontend/content/blog/chatpdf-alternatives-2026.md:67`, `frontend/content/blog/best-ai-pdf-tools-2026.md:83`
The research file directly supports pricing/limits, but not Chrome extension or Zotero integration. API is partially supported by the “citation/API platform” positioning, but the integrations are not.
Fix: “AskYourPDF is reported to offer Chrome/Zotero integrations…” or verify directly.

7. **SHOULD** — Gemini Notebook rename timing is more specific than the research supports.
`frontend/content/blog/chatpdf-alternatives-2026.md:125`, `frontend/content/blog/best-ai-pdf-tools-2026.md:100`, `frontend/content/blog/best-ai-tools-academic-research-2026.md:75`
The research directly confirms current redirect/branding, but says the exact rename date is search-only.
Fix: say “NotebookLM is now Gemini Notebook” / “the old address redirects,” and avoid “renamed in 2026” unless sourced.

8. **SHOULD** — DocTalk multi-document FAQ is inaccurate.
`frontend/content/blog/best-ai-pdf-tools-2026.md:227`
It says DocTalk answers within one document per chat session, but collection sessions create collection chats and backend retrieval runs across collection documents ([collections page](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/collections/[collectionId]/page.tsx:106), [ChatPanel wiring](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/collections/[collectionId]/page.tsx:454), [backend retrieval](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/backend/app/services/chat_service.py:2041)).
Fix: “DocTalk supports single-document chats and collection workspaces for cross-document questions; Quote Finder remains document-scoped.”

9. **NIT** — “Exact sentence” is too narrow.
`frontend/content/blog/best-ai-tools-academic-research-2026.md:45`
Product wording supports exact passage/source text, while quote-card jumps can be approximate for highlight location ([utils.ts](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/components/Quotes/utils.ts:11)).
Fix: change to “exact passage” or “source text.”

Clear checks: Consensus Deep price is read correctly as `$65/mo or $540/yr`; ChatDOC cadence is correct; Claude and Humata limits match the research; DocTalk pricing/page caps/modes/OCR/AES/no-training/demo/11-language claims are supported. Internal Markdown links all resolve, and blog tables render through `remark-gfm`.

SHIP-WITH-FIXES


