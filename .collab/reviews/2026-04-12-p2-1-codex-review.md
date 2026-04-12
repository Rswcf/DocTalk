P2-1 review
1) diff一致：新增 beat 循环、`/tmp/celerybeat-schedule`、`ENABLE_CELERY_BEAT`、trap 加 `BEAT_PID`。
2) `sh -n` 通过，但有阻断：
- `start_celery &`/`start_beat &` 在子 shell，PID 不回写父进程，trap kill 不到 worker/beat。
- `set -e` + `wait $PID`：子进程非0退出会直接结束循环，自动重启失效。
3) Railway `/tmp` 可写但非持久（redeploy清空），用于 schedule 可接受。
4) 双 beat 风险存在：Railway 支持多 replicas，会重复调度；建议在 `CLAUDE.md` 与架构 docs 明确“beat 必须单实例”。
5) cleanup_tasks：事务/释放连接正常；不足：无重试，expires 无索引，数据大时可能慢。
结论：方向正确，但当前不建议合并，先修复第2点。
