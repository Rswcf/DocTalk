# Phase 1 (asst=0 取消安全落库) — Claude 对抗审 + 复核结果

**日期:** 2026-05-24
**实现:** Codex(`gpt-5.3-codex`),按 `.collab/dialogue/2026-05-24-phase1-codex-impl-prompt.md`
**审阅/复核/修订:** Claude

## 实现概览(Codex,仅改 `backend/app/services/chat_service.py`)
- A1 取消安全:`chat_stream`/`continue_stream` 外层 `except asyncio.CancelledError: raise` + `finally`;`finally` 用 `anyio.CancelScope(shield=True)` + **独立 `AsyncSessionLocal`** 落部分答案并结算积分。
- A2 先存后校验:assistant 草稿在 verify/repair **之前** commit;repair 改 UPDATE 已存行。
- 新模块级 helper:`_persist_partial_on_cancel`、`_persist_continuation_on_cancel`、`_settle_predebit_on_cancel`(均独立 session)。
- 幂等:闭包 `persisted`/`settled`/`done_emitted` 标志,正常路径与取消路径互斥。

## Claude 审出的缺陷(真实,已修)
**[中危] 屏蔽态取消路径 DB I/O 无超时。** 独立 `AsyncSessionLocal` 在 `anyio.CancelScope(shield=True)` 内不可取消,无超时 → 走 asyncpg 默认 60s 连接超时。`test_continue_stream_midstream_cancel_settles_credits` 实测 **60.02s** 复现。生产含义:客户端断连遇 DB 抖动会钉住一个**不可杀的 ~60s 任务**,断连风暴 + DB 抖动会堆积。
- **修复(Claude):** 4 个屏蔽调用全部包 `asyncio.wait_for(..., timeout=_CANCEL_IO_TIMEOUT_S=5.0)`(shield 仍挡外部取消,wait_for 内部计时仍可在 5s 触发)。超时落入既有 `except Exception` 记日志。

**[测试卫生] 验收门误触真实 DB。** 我的 asst=0 单测让独立 session 真连本地 pg(lazy session 在 `get()` 处强制连接)→ 慢/不稳。
- **修复(Claude):** 测试 monkeypatch `chat_service.AsyncSessionLocal` 为 `_FakePersistSession`(记录 add/commit,零 I/O)。断言改为"取消后独立 session 写入了 assistant 消息"+"refund/reconcile 被调用"。保持 RED(修前)→ GREEN(修后)。

## 复核(Claude 独立重跑,非采信 Codex 报告)
- `tests/test_asst0_cancellation_baseline.py` → **3 passed / 0.87s**(修前 60.88s)。
- `test_chat_setup_refunds.py` + `test_credit_reconcile.py` → 全绿(无回归)。
- 全量非集成:**357 passed, 7 skipped**。失败仅:6 个 persona/page(下一阶段刻意 RED)+ 1 个 `test_versioning`(**先存的、无关**:`frontend/package.json 0.17.1` ≠ `version.json 0.18.0`)。
- `ruff check` 干净。

## 结论
Phase 1 第 1/2 项(asst=0)**实现完成并验证**,含 1 个被审出的真实超时缺陷已修。改动仅 `chat_service.py` + 新测试/脚本;**未提交**(待用户指示)。
建议:把这个 timeout 修订点回传 Codex 确认一轮(可选);其余 Phase 1(按页直查 B4 / 去-fragment C1 / RRF+动态k)仍是 RED,待后续阶段实现。
