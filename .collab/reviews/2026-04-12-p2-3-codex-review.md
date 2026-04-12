P2-3 审阅结论：
1) diff 符合：已抽 `_alert_redis_fallback(namespace, exc)`，`_get_client`/`_reset_client` 都改为 helper。
2) 30s gate 基本合理：稳态故障约每 namespace 30s 1 次；但断连瞬间并发请求下 `_reset_client` 可能短时重复上报。
3) `backend/requirements.txt`：`sentry-sdk[fastapi,celery]==2.22.0`，`push_scope()` 可用。
4) 4 namespace≈8 次/分钟=11520/天；Sentry Free 5k errors/月，持续故障会打满。
5) `error` 合理：回退会造成跨实例不一致、计数不持久，属于正确性降级。
6) 结论：通过，建议再加更粗粒度限流或去重。
