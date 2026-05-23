# BUG/QUALITY-2026-05-11-PRODUCTION-DEMO-TABLE-SEARCH-NOISY-CHUNK

## Summary

Production demo search over `Alphabet Q4 2025 Earnings Release.pdf` returned a functionally valid citation candidate for `revenue`, but the top chunk text was table-heavy and repeated numeric cells many times. This can make citation snippets and downstream answers feel noisy for financial/table PDFs.

## Evidence

- Run: `.collab/tasks/qa-run-2026-05-11-production-demo-document-read-surfaces.md`
- JSON: `.collab/tasks/qa-production-demo-document-read-surfaces-2026-05-11.json`
- Selected document: `alphabet-earnings`
- Query: `revenue`
- Top result page: `10`

Observed excerpt shape:

```text
Total revenues ... 307,394 ... 350,018 ... 352,743 ... repeated table cells ...
```

## Impact

- Functional retrieval works, but source snippets are hard to read.
- Table-heavy PDFs may produce repetitive citation cards or answer context.
- This can reduce user trust when asking financial/numeric questions.

## Suggested Follow-up

- Add a table-aware text normalization check for repeated adjacent numeric/table cell fragments.
- Add regression scoring for citation snippet readability on table-heavy PDFs.
- Consider preserving tables as structured rows for reader snippets and RAG context instead of flattening repeated bbox text.
