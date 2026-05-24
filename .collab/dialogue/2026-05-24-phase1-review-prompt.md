# 角色:对抗式代码审查(adversarial)— DocTalk Phase 1 整改

我(Claude)在分支 `fix/phase1-remediation` 自主实现了 Phase 1 整改(asst=0 取消安全落库、C1 去 fragment、B4 按页直查、B1/B2 RRF+动态k)。全量非集成测试 371 passed/0 failed、ruff 干净。**请对抗式复审**:找 bug、回归、计费错误、安全问题、边界漏洞。不要盖章。你的沙箱不能 git,我来提交。

## 审查surface
- 完整 diff:`.collab/reviews/2026-05-24-phase1-fulldiff.patch`(只含本次 6 commit 的代码改动)
- 共识依据:`.collab/plans/2026-05-24-doctalk-remediation-CONSENSUS.md`
- 现网文件:`backend/app/services/chat_service.py`、`corrective_retrieval_service.py`、`query_router.py`、`app/core/model_profiles.py`
- 测试:`backend/tests/test_asst0_cancellation_baseline.py`、`test_retrieval_persona_baseline.py`、`test_rrf_dynamic_k.py`

## 重点审查(逐项给结论 + 证据 file:line)
1. **asst=0 取消落库正确性**:`chat_stream`/`continue_stream` 的 `try/except CancelledError/finally`;独立 `AsyncSessionLocal` + `anyio.CancelScope(shield=True)` + `asyncio.wait_for(5s)`;`persisted/settled/done_emitted` 幂等是否真互斥;A2 先存草稿后 verify/repair(repair UPDATE)是否有竞态/重复落库;各 early-return(LLM_ERROR/PERSIST_FAILED)与 finally 的交互(会不会双落库/双结算/落库后又退款);取消发生在"草稿已commit但reconcile前"时账务是否正确。
2. **计费正确性**:取消路径 reconcile(has_answer)vs refund;有没有"已存部分答案却全额退款"或"扣费无答案未退"的残留;`_settle_predebit_on_cancel` 与正常 reconcile 路径是否可能都执行。
3. **RRF/动态k**:plain-QA 才用 `_rrf_fuse` 的 gate 是否会漏掉 table/planned 优先项;`_rrf_fuse([initial, planned, lexical])` 是否丢失 table_evidence(plain-QA 无 table,确认);`_dynamic_k` 上限/下限;`wide_k` 抬高 initial 检索宽度对 `should_correct`/早返回路径的影响;doc_pages 线程是否正确。
4. **B4 按页直查**:`_detect_page_ref` 多语正则误报(如 "top 5"、"p value"、英文 "pages" 复数、"page" 出现在非页码语境);PAGE_LOOKUP 短路是否吞掉本应是 summary/table 的查询;`_fetch_page_chunks` 的 page 重叠条件 + fallback。
5. **C1 去 fragment**:是否还有面向用户的 "fragment/Fragment" 泄漏(其它后端文件、错误消息、前端);改名是否破坏引用 [n] 契约。
6. **遗漏/回归**:跑 `SKIP_INTEGRATION=1 python3 -m pytest -q`(应 371 passed/0 failed)。指出任何我没测到的回归风险。

## 输出
- 「Must-fix」(阻断,按严重度)/「Should-fix」/「Nit」三档,每条 file:line + 可证伪理由 + 建议改法。
- 最后给「可否合并 stable」结论。
