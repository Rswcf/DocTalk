# 任务:实现 Phase 1 — asst=0 取消安全落库(仅此项,最小改动)

你来实现,我(Claude)会对抗审 + 提交(你的沙箱不能 git)。**严格限定范围**:只做 asst=0 的"取消安全落库 + 账务兜底 + 先存后校验",覆盖 `chat_stream` 与 `continue_stream`。**不要**碰检索/RRF/页码/去-fragment(那些是后续阶段)。

## 必读
- 共识方案:`.collab/plans/2026-05-24-doctalk-remediation-CONSENSUS.md`(§0 分水裁决、§2 Phase1 第1/2项、§5 风险)
- 验收测试(必须从 RED 变 GREEN,**不许改测试来迁就实现**):`backend/tests/test_asst0_cancellation_baseline.py`
- 现有必须保持 GREEN(防回归):`backend/tests/test_chat_setup_refunds.py`、`backend/tests/test_credit_reconcile.py`
- 目标代码:`backend/app/services/chat_service.py`(`chat_stream`≈802、LLM 流 1199-1291、verify/repair 1295-1350、assistant 落库 1352-1373、reconcile 1387-1407;`continue_stream`≈1420+;`_refund_predebit`≈529);独立 session 来源 `backend/app/models/database.py:AsyncSessionLocal`。

## 硬性要求
1. **捕获取消**:在流式主流程外层处理 `asyncio.CancelledError`(注意它是 `BaseException`,现有 `except Exception` 抓不到)。用 `try/finally`,在取消/异常时兜底。
2. **独立 session 落库**(分水裁决):取消路径**不得复用请求的 `db`**(asyncpg 连接在 cancelling 态会拒绝新操作)。新建独立 `AsyncSessionLocal()`,并用 `anyio.CancelScope(shield=True)` 包裹"落部分答案 + 账务结算"使其不被取消打断。不要用 `asyncio.shield(请求db.commit)`。
3. **落库 seam 命名固定**:新增模块级 `async def _persist_partial_on_cancel(...)`(验收测试按此名 monkeypatch;名字必须一致)。它内部用独立 session 落 assistant 部分文本。
4. **账务兜底**:取消时若有 predebit 未结算 → 用现有 `_refund_predebit`(无答案)或 `reconcile_credits`(有部分答案,按实计)结算。测试只要求二者之一被调用。
5. **幂等**:用闭包标志 `persisted`/`settled` 让正常路径与取消路径**互斥**,绝不重复落 assistant 或重复结算。
6. **A2 先存后校验**:把 assistant 草稿落库**移到** `claim_verifier`/`_try_repair_rag_answer` **之前**;repair 命中后改为对已存行 **UPDATE** + 继续发 `answer_repaired`。这样校验/修复阶段断连也不丢已生成答案。
7. **continue_stream 同等处理**(Codex r1 已确认同病)。

## 验收命令(你必须本地跑到全绿)
```
cd backend
SKIP_INTEGRATION=1 python3 -m pytest tests/test_asst0_cancellation_baseline.py tests/test_chat_setup_refunds.py tests/test_credit_reconcile.py -v
python3 -m ruff check app/ tests/
```
期望:`test_asst0_cancellation_baseline.py` 3 项全 PASS;现有 chat/credit 测试不回归。

## 约束
- 最小 diff,聚焦本项;不重构无关代码;不改前端;不改检索/prompt。
- 如发现共识方案有技术错误,先在输出里指出再实现(对抗式),不要默默偏离。
- 输出:改了哪些文件/函数 + 关键设计 + 测试输出原文。
