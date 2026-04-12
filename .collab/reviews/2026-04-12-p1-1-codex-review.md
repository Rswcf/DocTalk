结论：**需修改**

**通过**
- `git diff` 仅两处新增退款：`chat_service.py:574-582`、`916-924`，改动范围正确。
- 写法与 LLM_ERROR 对齐：`546-557`、`893-903`（同 guard + try + logger）。
- PERSIST_FAILED 先 `rollback`，helper 再 `rollback`（`75-85`）无 session 状态冲突。

**需修改**
- `_refund_predebit` 非幂等：先加余额再删 ledger，且不校验 delete 命中（`87-94`）；同一 `predebit_ledger_id` 重放会双重退款。
- `chat_stream` 持久化仅捕获 `IntegrityError`（`572`）；若是其他持久化异常，仍可能漏退款。

**建议**
- refund `commit` 失败目前仅日志吞掉（`577-581`,`919-923`），建议加告警/补偿任务。
- 退款分支无需 `record_usage`（与 LLM_ERROR 一致）。
- grep 结果：predebit 后的 setup/retrieval、LLM、persist error 都已退款（`434-443`,`546-557`,`574-582`,`816-825`,`893-903`,`916-924`）；session/权限/余额不足在 predebit 前，无需退款。