# RAG Citation Accuracy — Industry Best Practices Research

## Key Findings

### 1. Chunk Granularity
- Page-level chunking: highest accuracy (0.648) in clinical study, natural citation boundaries
- Semantic chunking: 70% accuracy boost but produces variable-size cross-page chunks
- Industry trend: **element-level parsing with page metadata preserved per element**
- Unstructured.io, Docling, Reducto all store per-element page+bbox

### 2. Sub-Chunk Citation
- **LlamaIndex CitationQueryEngine**: Post-retrieval sub-chunking into sentence-level nodes
- **Tensorlake Citation Anchors**: Inject `<c>page.order</c>` anchors in chunk text, spatial metadata stored separately
- **Anthropic Citations API**: Returns char-level/page-level locations natively (Claude models only)
- **Sub-Sentence Citations (arXiv 2509.20859)**: Academic research showing sub-sentence reduces user verification effort

### 3. Per-Page Bbox Tracking
- Docling stores multiple bboxes per component as array, each with page number
- Unstructured.io preserves per-element coordinates through chunking
- ~10-15% storage overhead for bbox metadata (acceptable)
- **DocTalk already has this** — `bboxes` JSONB has per-bbox `page` field

### 4. Post-Retrieval Re-Ranking
- Two-stage retrieval (embedding + cross-encoder) is standard
- Sentence Window Retrieval: embed sentences individually, expand context at retrieval
- PaperQA2: LLM-based contextual summarization after initial retrieval
- Within-chunk sentence re-ranking: match query against per-sentence embeddings

### 5. LLM Citation Formats
- Standard `[N]` is dominant (Perplexity, LlamaIndex, LangChain)
- `[N, p.X]` page-specific: no widely deployed system uses this — fragile
- Structured JSON output: `{passage_num, quote, reason}` (LangChain)
- **Recommendation**: Keep `[N]`, resolve page server-side

### 6. Frontend Text Matching
- pdf.js text layer matching: positioned `<span>` elements for text search
- react-pdf-highlighter: programmatic highlighting built on pdf.js
- **DocTalk already has 3 strategies**: PDF bbox, TextViewer text-snippet, converted PDF fallback

## Ranked Recommendations

| Rank | Approach | Effort | Impact | Status in Our Plan |
|------|----------|--------|--------|-------------------|
| 1 | Fix bbox page filtering + smart page selection | Low | High | ✅ Phase 1b |
| 2 | Pass all bboxes to frontend, multi-page highlights | Low | High | ✅ Phase 2b |
| 3 | Add `page_end` through pipeline | Low | Medium | ✅ Phase 1a, 2a-d |
| 4 | Server-side text matching for page resolution | Medium | High | Future Phase 2 |
| 5 | Citation anchor injection (Tensorlake-style) | High | Very High | Future Phase 3 |
| 6 | Post-retrieval sub-chunking | High | High | Not planned |

## Sources

- Firecrawl chunking strategies 2025
- PMC clinical decision support chunking evaluation
- Tensorlake citation-aware RAG
- arXiv 2509.20859 sub-sentence citations
- LlamaIndex CitationQueryEngine docs
- Docling + Neo4j evidence pins
- Unstructured.io document elements
- Anthropic Citations API
- LangChain QA citations
- Weaviate chunking strategies
