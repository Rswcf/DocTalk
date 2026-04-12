P2-8对抗审阅结论：

高：`.github/workflows/ci.yml:62-64` 运行 `-m integration` 但未设 `SKIP_INTEGRATION=0`，而 `backend/tests/conftest.py:40-48` 默认跳过 integration，migrations job 实际为 SKIPPED（本地复现）。
中：`backend/tests/test_migrations.py:33` 写死 `python`，在仅有 `python3` 环境会 `FileNotFoundError`（本地复现），应改 `sys.executable`。
其余核查：round-trip 逻辑正确；`alembic/env.py:57-60` 用 `create_async_engine`，`postgresql+asyncpg://` 合理；postgres 16.6 服务+5432 映射可连 `localhost:5432`；teardown 不必做（CI新服务）。
结论：方向对，但当前 CI 未真正验证 downgrade，先修上面两点。
