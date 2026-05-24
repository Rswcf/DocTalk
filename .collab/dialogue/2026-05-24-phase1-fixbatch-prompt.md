# 任务:修复你 review 出的 Phase 1 缺陷(TDD:先写失败测试,再修到绿)

你刚审出的问题在 `.collab/reviews/2026-05-24-phase1-codex-review.md`。现在实现修复。**规则:每个 Must-fix 先加一个会 FAIL 的回归测试(放 tests/test_asst0_cancellation_baseline.py 或新文件),再改代码到全绿。不许改测试迁就实现。** 我(Claude)随后复审 + 提交(你不能 git)。

## 必修(Must-fix,全部)
1. **取消覆盖预流阶段**:把"predebit 之后→函数返回"整体纳入取消安全兜底(setup/retrieval 阶段的 CancelledError 也要 finally 结算)。覆盖 `chat_stream` 与 `continue_stream`。
2. **partial+全额退款漏洞**:LLM 异常 / PERSIST_FAILED 路径若已有部分答案(assistant_text_parts 非空)→ 不要全额 refund;按 has_answer 统一在 finally reconcile(收实际成本)。无部分答案时维持 refund。
3. **ACCOUNTING_ERROR 悬挂**:结算异常后不要直接 done_emitted=True 跳过兜底;必须做一次 fallback 结算(reconcile 重试/退款)再 done,或确保 finally 仍结算。

## 同时修(Should-fix 2/4 + Nit 1)
- **PAGE_LOOKUP 不要无条件短路**(query_router):命中 table/comparison 标记时,不能把 "show table on page 8" 吞成纯 PAGE_LOOKUP;让 page_ref 作为强信号但保留 table/comparison 并行意图(或仅当无 table/compare 标记才短路)。加测试。
- **RRF 退化为 dense-only**:plain-QA 路径在融合前至少跑一轮低成本 lexical(小 top_k),再 `_rrf_fuse`。
- **残留 "fragment" 文案**:清理仍面向模型/用户的:`rag_evaluator_service.py`、`summary_service.py`、`document_diff_service.py`、`extraction_service.py`(→ "excerpt")。前端 es.json 等 locale 可暂记 TODO 不动。

## 不在本轮(记 TODO,别做)
- Should-fix 1 幂等占位行(A4,Phase 2)、Should-fix 3 page 合并 document_tables(Phase 2)。

## 硬约束
- 不得破坏既有 test_chat_setup_refunds.py 的"用请求 db 退款"断言(setup 阶段正常错误仍走请求 db 退款;只有"取消态"用独立 session)。区分:CancelledError → 独立 session;普通 Exception → 现有请求 db 路径。
- `_settle_predebit_on_cancel`/`_persist_*_on_cancel` 仍包 `anyio.CancelScope(shield=True)` + `asyncio.wait_for(_CANCEL_IO_TIMEOUT_S)`。
- 验收:`SKIP_INTEGRATION=1 python3 -m pytest -q` 必须 0 failed(除既有无关项已修复为 0);`ruff check app/ tests/` 干净。
- 输出:改了哪些文件/函数、新增哪些测试、测试输出原文、自评是否可合并。
