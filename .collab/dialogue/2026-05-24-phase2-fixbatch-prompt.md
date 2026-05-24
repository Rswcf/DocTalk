# 任务:修复你 review 出的 Phase 2 缺陷(TDD:先写失败测试,再修到绿)

你的 review 在 `.collab/reviews/2026-05-24-phase2-codex-review.md`。实现修复。**每个 Must-fix 先加会 FAIL 的回归测试,再改到全绿;不破坏既有测试。** 我随后复审 + 提交(你不能 git)。

## Must-fix(全部)
1. **B5 被 persisted brief 短路 → 主路径整篇覆盖失效。** 解析期每个文档都会生成 DocumentBrief.coverage,导致 `get_summary_context` 直接返回 persisted 的 ~18 chunk,section 选择器从不执行。修复:大文档 summary 路径不要被 persisted 短路 —— 当 `_should_use_map_reduce`(或等价大文档判定)成立时,跑 section-spanning 选择器,且**预算随文档规模动态放大(>18)**(参考 Phase 1 `_dynamic_k`:按 page_count/chunks_total/section_total)。小文档/collection 窄预算仍可用 persisted。加测试:有 persisted coverage 的大文档,summary 走 B5 且覆盖更多 section。
2. **C4 locale 未透传到 worker。** 把上传侧/文档可得的 locale 传入 parse task,再 `resolve_ocr_languages(locale)`;若确实拿不到 locale,说明原因并至少留好透传参数。加测试:worker 用文档 locale 调用 resolver(可 monkeypatch 断言)。
3. **OCR_LANGUAGES 性能开关失效(无条件 union)。** 让它真正可调:把"全 11 语种"作为 **config.OCR_LANGUAGES 的默认值**,`resolve_ocr_languages` 直接用 config(locale 优先前置),**不要无条件 union**。设 `OCR_LANGUAGES='eng'` 必须只返回窄集合。更新现有 OCR 测试以匹配新语义(默认仍覆盖 11 locale)。

## Should-fix(尽量一起)
- `_should_use_map_reduce` 用 `section_total`(或 max(section_total,chunks_total))判定,别只看 chunk 数。
- 避免大文档重复全量加载 chunk(复用 element-aware 已查结果)。
- `_truncate_group_chunks` 对多 section 组也要硬封顶到 max_group_chunks。

## 硬约束
- 引用契约不变:summary 路径仍返回 chunk retrieval-item(chunk_id/page/bboxes/document_id)。
- `SKIP_INTEGRATION=1 python3 -m pytest -q` = 0 failed;`ruff check app/ tests/` 干净。
- 不破坏 collection 窄预算 / 小文档 representative / persisted(小文档)/ element-aware 路径。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、自评可否合并。
