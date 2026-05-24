# 角色:对抗式代码审查 — DocTalk Phase 2(C4 OCR + B5 整篇覆盖)

我(Claude)在 `fix/phase2-remediation` 实现了 Phase 2:C4(OCR 多语言)+ B5(大文档 section 覆盖)。全量非集成 397 passed/0 failed,ruff 干净。请**对抗式复审**:找 bug、回归、性能、计费/引用契约破坏、边界漏洞。不要盖章。你不能 git,我提交。

## surface
- 完整 diff:`.collab/reviews/2026-05-24-phase2-diff.patch`
- 现网:`backend/app/services/document_brief_service.py`(B5)、`backend/app/services/parse_service.py` + `app/workers/parse_worker.py` + `backend/Dockerfile`(C4)
- 测试:`backend/tests/test_document_brief_service.py`、`test_ocr_languages_baseline.py`

## 重点(逐项给结论 + file:line)
1. **B5 覆盖是否真生效**:`get_summary_context` 对大文档走 `select_chunks_for_summary`,但 chat_service 调用处仍传 `max_chunks=18`(硬编码)。在 462 页 / 30+ section 文档下,18 个 chunk 能覆盖所有 section 吗?是否需要让 summary 的 max_chunks 随文档规模放大(类似 B2 _dynamic_k)?`_should_use_map_reduce` 的门槛/边界(max_chunks<18 跳过、element_chunks_count 判定)有无漏判/误判。
2. **引用契约 / 返回结构**:map-reduce 路径返回的仍是 chunk retrieval-item(含 chunk_id/page/bboxes/document_id)吗?有无字段缺失导致 [n] 引用或 bbox 高亮失效。
3. **性能**:大文档 `select(Chunk).where(document_id).order_by(chunk_index)` 全量加载所有 chunk 进内存 + 分组,500 页文档(数千 chunk)的内存/延迟风险;map/reduce 是否引入额外 LLM 调用拖慢 summary 首 token。
4. **回归**:collection per-doc 窄预算、persisted-brief、element-aware、小文档 representative 路径是否都保留;`SectionMapReducePlanner` 的 map/reduce(若含 LLM 调用)是否在检索路径被意外触发。
5. **C4**:`resolve_ocr_languages` 多语言串联(11 langs)对正常英文文档的 OCR 速度/准确率影响;Dockerfile tesseract 包名是否都正确存在(apt);locale 优先级逻辑。
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q`(应 397/0 failed)。

## 输出:Must-fix / Should-fix / Nit(各带 file:line + 可证伪理由 + 建议),最后给「可否合并 main」。
