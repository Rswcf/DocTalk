# Codex review of Release C (r2, gpt-5.5, 2026-10-10) — final section

codex
FIXED — ItemList shape: [blogSchema.ts](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/lib/blogSchema.ts:89) nests `name`/`url` under `ListItem.item`; [page.tsx](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/blog/[slug]/page.tsx:132) renders that builder.

FIXED — NotebookLM coverage: [blog-jsonld.test.cjs](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/tests/blog-jsonld.test.cjs:84) includes `notebooklm-alternatives-2026`.

FIXED — Academic no-ItemList coverage: page gates ranked lists to comparisons at [page.tsx](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/blog/[slug]/page.tsx:75); test asserts academic extraction empty at [blog-jsonld.test.cjs](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/tests/blog-jsonld.test.cjs:97).

FIXED with caveat — rendered shape is covered through the helper used by render, not a full SSR page parse: [blog-jsonld.test.cjs](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/tests/blog-jsonld.test.cjs:107), [page.tsx](/Users/mayijie/Projects/Code/010_DocTalk/.claude/worktrees/website-seo-audit-0bec36/frontend/src/app/blog/[slug]/page.tsx:136).

New real problems: none. Focused test passed: `node --test frontend/tests/blog-jsonld.test.cjs` = 7/7. No git run.

SHIP


