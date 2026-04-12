核查结论：
- `ci.yml` 的 `migrations` job 已加 `SKIP_INTEGRATION: "0"`。
- `test_migrations.py` 已 `import sys`，并使用 `sys.executable -m alembic`。
- `conftest.py:38-48`：`should_skip = skip_env in {"1","true","yes","on"}`；`"0"` 不命中，`should_skip=False`，integration 不跳过。
- `embedding_service.py` 已改为 `if last_exc is not None: raise last_exc`，并加 `RuntimeError` 兜底，避免 `-O` 下 assert 失效。

结论：P2-8 通过；P2-9 通过。
