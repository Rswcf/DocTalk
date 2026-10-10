VERDICT: SHIP-WITH-FIXES

1. fr, `comparePdfai.languageSupportDocTalk`: the value does not end in sentence-final punctuation because it has a trailing U+0020 after the final period. Evidence: `frontend/src/i18n/locales/fr.json:1993` ends `"question. "`, and `frontend/src/app/compare/pdf-ai/PdfaiContent.tsx:113` renders this key as a standalone paragraph. Exact replacement: `L'interface de DocTalk est disponible en 11 langues : anglais, chinois, espagnol, japonais, allemand, français, coréen, portugais, italien, arabe et hindi. L'IA répond dans la langue de votre question.`

