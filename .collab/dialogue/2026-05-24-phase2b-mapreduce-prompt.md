# 任务:把 B5 做成"真 LLM map-reduce"拿全文覆盖(TDD,如前几轮)

eval 已证明 Phase 2 的 B5(section-spanning 选 chunk)把整篇覆盖从 ~12% 提到 ~57%,但受 64-chunk 上限,113 节文档封顶 57%。现在做**真 map-reduce**:逐节(组)LLM 摘要(map)→ 合并(reduce)→ 在**固定 token 预算**下覆盖**全部** section。先写失败测试再实现到绿。我随后对抗审+提交(你不能 git)。

## 现状(可复用脚手架)
- `document_brief_service.py`:`SectionMapReducePlanner`(已有 `MapStep`/`ReduceStep` Protocol、`MapStepResult{summary,selected_chunk_ids,covered_sections}`、`_section_segments`、`_group_segments`、`_dynamic_section_group_count` max_groups=18、`select_chunks_for_summary`)。当前 default map 是透传(summary 没用上,只用 selected_chunk_ids,受 64 cap)。
- `chat_service.py` DOCUMENT_SUMMARY 路径调用 `get_summary_context` 取 chunk,再走普通 LLM 答。
- LLM 客户端:`chat_service._get_llm_client(model)`;模型:`settings.MODE_MODELS`(map 用便宜 flash,reduce 可 flash/pro)。eval 脚本:`backend/scripts/retrieval_eval.py`。

## 目标
1. **真 map step(LLM)**:对每个 SectionMapGroup,调 LLM(便宜模型)产出该组**结构化摘要 + 关键 chunk 的 source refs**(填 `MapStepResult.summary` 与 `selected_chunk_ids`/`covered_sections`)。可注入/可 stub。
2. **真 reduce step**:把各组摘要合并成**覆盖全部 section** 的最终结构化结果;在固定预算下不丢节。
3. **接入 DOCUMENT_SUMMARY 整篇答**:大文档的"全文总结/cheatsheet/列出全部"用 map-reduce 的覆盖结果,使最终答**覆盖所有(去噪后)section**,而不是受 64 chunk 限。
4. **引用契约必须保持**:最终答仍带 `[n]` 可点击引用,映射回 source chunk(chunk_id/page/bbox)。用 map 的 selected_chunk_ids 做引用锚。
5. **section_title 去噪**:`_section_segments`(或分组前)过滤伪节标题(纯标点/单字符/纯数字如 "+"/"2"/"2026."),避免噪声节。
6. **预算/延迟/成本约束**:组数 ≤18;map 并发(信号量,已有 max_concurrency)用便宜模型;map 失败/超时 → 回退到现有 chunk-selection 路径(绝不让 summary 直接报错);给前端发"正在分节摘要…"状态。

## 测试(先红,hermetic 不连真实 LLM)
- stub map/reduce:断言**最终覆盖去噪后的全部 section**(对照 ground-truth section 列表),且超过当前 64-chunk 上限能覆盖 113 节这类文档。
- 引用保留:断言结果含可映射回 chunk 的 refs。
- 去噪:断言伪节标题被过滤。
- 回退:map 抛错时回退到 select_chunks_for_summary,不报错。

## 硬约束
- `SKIP_INTEGRATION=1 python3 -m pytest -q` = 0 failed;`ruff check app/ tests/` 干净;不破坏既有 summary/brief/collection/small-doc 路径与既有测试。
- 不连真实 LLM 跑测试(map/reduce 注入桩)。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、对 cost/latency 的说明、自评可否合并。
