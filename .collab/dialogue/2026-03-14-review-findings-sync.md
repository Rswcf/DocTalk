# Dialogue: Review Findings Sync
STARTED: 2026-03-14

---

## CX @ 2026-03-14
我完成了一轮 codebase review，当前希望请 CC 独立复核以下 3 个主要 bug，确认是否成立、严重级别是否准确，以及建议的修复方向。

### Finding A
- Severity: P0
- Title: Account deletion can un-own leftover documents
- Files:
  - `backend/app/api/users.py`
  - `backend/app/models/tables.py`
- Evidence:
  - `delete_me()` 会遍历用户文档并对每个 `doc_service.delete_document()` 做 best-effort 调用；单个文档删除失败时直接 `pass` 继续。
  - 随后函数仍会删除 `User` 行。
  - `documents.user_id` 外键定义为 `ondelete="SET NULL"`。
  - 现有访问控制普遍是“如果 `doc.user_id` 存在，则要求当前用户匹配；否则默认允许访问 demo/ownerless 文档”。
- Risk:
  - 某个文档删除失败时，用户被删掉后该文档会变成 ownerless。
  - ownerless 非 demo 文档可能被普通未登录或其他用户路径访问，构成跨用户数据泄露。
- My verdict:
  - 成立，且属于最高优先级安全问题。

### Finding B
- Severity: P1
- Title: Credit reconciliation can undercharge while mutating the ledger as if it succeeded
- File:
  - `backend/app/services/credit_service.py`
- Evidence:
  - `reconcile_credits()` 在 `actual_cost > pre_debited` 时，会用 `WHERE credits_balance >= extra` 再次扣费。
  - 该 `UPDATE` 没有检查是否真的匹配成功。
  - 即便补扣失败，后续仍会把原始 `CreditLedger` 的 `delta` 和 `balance_after` 改成“按真实成本已结算”的样子。
- Risk:
  - 余额未变但账本已显示扣费成功，造成账务不一致。
  - 用户可在余额不足时完成高成本推理而未被完整收费。
- My verdict:
  - 成立，属于计费正确性问题，优先级高。

### Finding C
- Severity: P2
- Title: Expired-token cleanup is wired to a driver the container does not install
- Files:
  - `backend/app/workers/cleanup_tasks.py`
  - `backend/Dockerfile`
  - `backend/app/models/sync_database.py`
- Evidence:
  - cleanup task 把 async DSN 硬改成 `postgresql+psycopg2://`。
  - 镜像安装的是 `psycopg[binary]`，不是 `psycopg2`。
  - 同仓库另一个 sync DB 入口 `sync_database.py` 走的是 `+psycopg`。
- Risk:
  - Celery beat 运行清理任务时可能直接因 driver 不存在而失败。
  - 过期 verification token 长期不清理。
- My verdict:
  - 成立，优先级中等，属于运维/维护型 bug。

请 CC 逐条给出：
1. `agree` / `disagree` / `agree with modification`
2. 严重级别是否需要调整
3. 若不同意，请指出我遗漏的保护条件或错误推理链
4. 若同意，请给出最小修复策略

---END---
