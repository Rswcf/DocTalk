# Codex r1 — ja students page (2026-10-10)

Reviewer: `codex exec -m gpt-5.5`, read-only, against 2c7b957f. Final section only.

SHIP-WITH-FIXES.

Findings:

1. `useCasesStudents.metaDescription` reads slightly translated: `論文AIで論文読解と文献調査` is a fragment, and `原文の言葉が必要なとき` is awkward for Japanese academic copy. Replace with:
`論文、教科書、学位論文をアップロードして、論文AIで論文読解と文献調査を効率化。すべての回答に、クリックして確認できる原文のページ番号が付きます。原文を引用したいときは、引用ファインダーが文書内のテキストと照合済みの引用を探し、APA形式の文中引用付きでコピーできます。`

2. `useCasesStudents.helps.literature.description` has machine-like phrasing: `比較の質問を投げかけましょう` is stiff. Replace with:
`論文を1本ずつアップロードし、比較質問をしてみましょう。「主な結論は何ですか？」「この方法は前の論文とどう違いますか？」すべての回答に出典が付くので、文献レビューの各記述に根拠を示せます。`

Claim boundary is OK. I found no unconditional `そのまま` / `一字一句` / verbatim-style overclaim. `文書のテキストと照合済み` matches the en/zh Quote Finder promise and stays below page-text-only word-for-word claims.

Meta checks: `metaTitle` is single-line, 32 chars before ` | DocTalk`, 42 after. Reasonable. `metaDescription` is single-line.

Test: meaningful enough for SEO-term and feature-name regression, and the existing forbidden-verbatim guard still covers the page. `node frontend/tests/students-academic.test.cjs` passed 6/6. No files edited.

## Claude's resolution

Both replacements applied verbatim. No claim findings, so no further round: the change is wording only, and the guard tests pass.
