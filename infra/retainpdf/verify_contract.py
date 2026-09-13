"""Offline checks against the actual installed, pinned translation pipeline."""
from retainpdf_pipeline.translate.core.payload.formula_protection import (
    protect_glossary_terms, restore_protected_tokens,
)
from retainpdf_pipeline.translate.core.terms.glossary import normalize_glossary_entries

entries = normalize_glossary_entries([
    {"source": "without prejudice", "target": "不妨碍再次起诉（without prejudice）", "level": "canonical", "match_mode": "case_insensitive", "context": "dismiss"},
    {"source": "with prejudice", "target": "不得再次起诉（with prejudice）", "level": "canonical", "match_mode": "case_insensitive", "context": "dismiss"},
])
source = "The dismissal is without prejudice but may effectively be a dismissal with prejudice."
protected, mapping = protect_glossary_terms(source, glossary_entries=entries)
restored = restore_protected_tokens(protected, mapping)
assert len(mapping) == 2
assert "不妨碍再次起诉（without prejudice）" in restored
assert "不得再次起诉（with prejudice）" in restored
assert "may effectively" in restored
unrelated = "This settlement letter is without prejudice."
protected, mapping = protect_glossary_terms(unrelated, glossary_entries=entries)
assert protected == unrelated and not mapping
print("Pinned installed pipeline: bounded contextual glossary contract passed")
