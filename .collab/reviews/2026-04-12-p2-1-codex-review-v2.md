P2-1 v2 review
1) 已读 `git diff backend/entrypoint.sh`，实现与提案 1~6 一致。
2) `#!/bin/bash` 可行：Docker `CMD ["/app/entrypoint.sh"]` 直启；未发现 `sh entrypoint.sh` 依赖。
3) 更正：`wait -n` 是 Bash 4.3+（非 3+）；python:3.12-slim 的 Debian bash 5.x 支持。
4) 三进程共命运可接受，较旧 while+subshell（PID 不可见、重启失效）是净改善。
5) Railway 重启已在 `backend/railway.toml` 显式：`ON_FAILURE` + `maxRetries=5`。
6) `trap cleanup` 与末尾收尾段不冲突；重复 kill/wait 幂等。
7) 结论：可合并。建议补 `docs/ARCHITECTURE*.md`（可选 `CLAUDE.md`）将“worker auto-restart”改为“容器级重启”，并注明 beat 单实例。
