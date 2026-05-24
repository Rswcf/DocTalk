# 任务:实现 B5 整篇文档 map-reduce 覆盖(TDD,如 Phase 1)

我(Claude)在分支 `fix/phase2-remediation`。请实现 Phase 2 的 B5:大文档"整篇任务"(全文总结 / cheatsheet / 提取全部)用 **section map-reduce** 覆盖全文,替代当前的"代表性抽样"(漏章)。**规则:先写会 FAIL 的覆盖测试,再实现到全绿;不破坏既有测试。** 我随后对抗审 + 提交(你不能 git)。

## 问题(真实用户)
U26(462p 生物书)"给每章做 cheatsheet" → "第18章没有信息";U47(283p+443p)整篇 dissertation 漏内容;付费用户全文覆盖不足。根因:`document_brief_service.get_summary_context(max_chunks=18)` 和 `summary_service` 用 `_select_representative_chunks`(代表性抽样,固定 18/24),不随文档放大、会漏章节。

## 目标
- 新增 map-reduce 编排(建议 `summary_service` 或新模块):按 section/reading-order 把文档分组(用 `document_elements`/`chunks` + `document_element_service.select_representative_elements` 已有基础),**map**=逐组摘要,**reduce**=合并为覆盖全文的结构化结果。覆盖度随文档规模扩展(配合 Phase 1 `_dynamic_k` 思路),受 token/并发预算约束(分组上限、`asyncio.gather` 并行、每组截断)。
- 在 `chat_service` 的 `DOCUMENT_SUMMARY` 路径(`get_summary_context` 调用处)接入:大文档走 map-reduce,小文档可保留现路径。
- 引用契约不变(每条仍带 [n]/source_refs)。

## 测试(先红)
- 覆盖不变量:给定 stub 的"N 个 section + stub LLM",map-reduce 结果必须**引用到所有 section**(对照 ground-truth section 列表),而代表性抽样会漏。放 `backend/tests/`。
- 大文档分组数随规模增长(纯函数单测)。

## 硬约束
- 不破坏既有 `test_document_brief_*`、`test_chat_summary_routing`、`test_element_aware_workflows` 等。
- `SKIP_INTEGRATION=1 python3 -m pytest -q` 必须 0 failed;`ruff check app/ tests/` 干净。
- map-reduce 的 LLM 调用要可注入/可 stub(测试不连真实 LLM)。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、自评可否合并。
