Findings first.

- should-fix — [ai-document-analysis-languages.md](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/agent-a9daf84316792c4e8/frontend/content/blog/ai-document-analysis-languages.md:60) — “the citations take you to the original German passages … and highlight them” is plural and reads as every citation gets a highlight. Product truth allows `Page location only`. Fix by adding the fallback sentence or changing to “can highlight the cited passage.”

- should-fix — [how-to-chat-with-pdf-ai.md](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/agent-a9daf84316792c4e8/frontend/content/blog/how-to-chat-with-pdf-ai.md:149) — “In all of these formats, clicking a citation jumps to the source and highlights the cited passage” is a universal all-format claim without the fallback. The PowerPoint slide caveat is present, but the sentence still overpromises for citations DocTalk cannot pinpoint. Add “When DocTalk cannot pinpoint the passage, it shows the cited page instead.”

- should-fix — [notebooklm-alternatives-2026.md](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/agent-a9daf84316792c4e8/frontend/content/blog/notebooklm-alternatives-2026.md:14) — “check each answer against the highlighted passage in the original file” is an “each answer” highlight promise. Some citations resolve to `Page location only`, and DOCX uses Text view rather than original layout. Fix to “check answers against cited passages in the document viewer” or add the fallback nearby.

Verified fixes from round 1: `page.tsx` no longer says “any” or “exact”; `citation-highlighting-matters.md:154` and `:188` now carry the fallback; `blog.post.aboutDescription` is restored to the base value; `notebooklm-alternatives-2026.md:43` is back to “the original PDF.”

Checks that looked clean: no remaining changed “PDF and .txt” / “plain-text (.txt)” limit; frozen posts are absent from the patch; competitor cells appear unchanged; `featuresCitations.metaDescription == featuresCitations.heroSubtitle` and `compareAskyourpdf.metaDescription == compareAskyourpdf.heroDescription` hold in the sampled/current locale values; I did not see backend, infra, or `version.json` scope creep.

VERDICT: SHIP-WITH-FIXES (fix the three universal/fallback gaps above)

