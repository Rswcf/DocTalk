# P1/P2 修复终报（Claude ↔ Codex 对立审阅）

**日期**：2026-04-12
**执行者**：Claude (Opus 4.6) 实施 + Codex (gpt-5.3-codex) 对抗审阅
**输入**：`2026-04-12-consensus-codebase-review.md`
**产出**：13 个 file 改动 + 1 新增文件，共 **+377 / −113 行**（不计 docs/collab）

---

## 执行模式

- 每项修复由 Claude 落地 → Codex 在独立 session 对抗性审阅（严禁点头附和）→ 如有 block/nit 则 Claude 修正 → 再审直到通过
- 平均每项 1–2 轮 review；其中 **P1-2 用了 4 轮**（Claude 第一稿是误报 → 被 Codex 推翻 → 合力找到正确方案）
- Codex 配额在 P2-6 后耗尽，P2-7～P2-10 及文档更新由 Claude 独立完成并**自审**（严格遵循 Codex 建立的质量线）。所有自审项留**"待 Codex 恢复后复审"**标记

---

## 完成清单

### 🟠 P1（资金 + 安全）— 4/4

| # | 问题 | 关键证据 | Codex 轮数 |
|---|------|----------|-----------|
| **P1-1** | PERSIST_FAILED 不退款 → 资金损失 | `backend/app/services/chat_service.py:75-99, 574-583, 906-916` | 2（第 2 轮发现 `_refund_predebit` 非幂等，改为 DELETE-gate）|
| **P1-2** | Proxy `x-real-ip` 回退伪造面 | `frontend/src/app/api/proxy/[...path]/route.ts:69-80` | 4（先过度移除导致 Node runtime `req.ip=undefined`，最终回到 `req.ip → x-forwarded-for 最左 → x-real-ip` 三级链，全部 Vercel 注入、客户端不可伪造）|
| **P1-3** | `/api/shared/{token}` 无限流 + SSR 绕过 proxy | `backend/app/api/sharing.py:115-125`, `backend/app/core/rate_limit.py:201-229`, `frontend/src/app/shared/[token]/page.tsx:9-27` | 2（第 1 轮发现 SSR 未带 HMAC，修到 SSR 也携带 `X-Real-Client-IP + X-Proxy-IP-Secret`）|
| **P1-4** | 登出未清 localStorage，跨账号残留 | `frontend/src/lib/clearAccountStorage.ts` (new), `UserMenu.tsx:74-78`, `Profile/AccountActionsSection.tsx:49`, `HomePageClient.tsx:243-248` | 2（第 1 轮发现遗漏 AccountActionsSection + session 过期路径，抽公共函数统一覆盖）|

### 🟡 P2（可靠性 + 清理）— 10/10

| # | 问题 | 关键证据 |
|---|------|----------|
| **P2-1** | Celery beat 从未启动 | `backend/entrypoint.sh` 完全重写：shebang 改 `bash`，去掉假装 auto-restart 的 while 循环（Codex 证 PID 不传子 shell、`set -e + wait` 破坏重启），新增 `wait -n` + Railway 容器级重启 + `ENABLE_CELERY_BEAT` env |
| **P2-2** | Qdrant 索引失败仅 `logger.info` | `backend/app/main.py:57-74` 抽 `_alert()` + `_is_already_exists()`（用 `exc.status_code==409` 替代不稳字符串判断）|
| **P2-3** | Redis 回退内存时无告警 | `backend/app/core/rate_limit.py:18-52` 抽 `_alert_redis_fallback()` + **每 namespace 每 10 分钟** Sentry 节流（避免打满 5k/月 Free 配额）|
| **P2-4** | deep health 不探 Qdrant/MinIO | `backend/app/main.py:205-260` 并发 probe（`asyncio.gather` + 5s timeout），总延迟从串行 20s 降到 ~5s；`storage_service.health_check()` 新增公开 API |
| **P2-5** | CSP `unsafe-inline/eval` | `frontend/next.config.mjs:14-31` 加 `media-src 'none'` + `upgrade-insecure-requests`。完整 nonce 化改造记为 P3（需 staging Report-Only 观察期）|
| **P2-6** | Docker 镜像 `:latest` | `backend/Dockerfile:2`, `docker-compose.yml:5-37` pin 到 minor+patch（python 3.12.7-slim / postgres 16.6 / qdrant v1.12.4 / redis 7.4.1-alpine / minio RELEASE.2024-12-18）|
| **P2-7** | `--forwarded-allow-ips` | 分析后证实默认 `127.0.0.1` 是**安全**的（backend `get_client_ip` 不信任 XFF，只信 HMAC 签名）。无代码改动，写入 ARCHITECTURE.md 信任链文档 |
| **P2-8** | Alembic 无 downgrade 测试 | `backend/tests/test_migrations.py` (new) 做 upgrade → downgrade → upgrade 往返；`.github/workflows/ci.yml:33-63` 新增 `migrations` job + postgres service |
| **P2-9** | 隐性技术债 | 移除 `embedding_service.py:70` 的 `# type: ignore[misc]`（用 `assert` 替代）+ 简化冗余 `except (ValueError, Exception)`。保留的 `noqa: I001/E731` 及 `type: ignore[attr-defined]` 属合理局部抑制 |
| **P2-10** | 其他匿名端点无限流（Codex 新发现）| `backend/app/core/rate_limit.py:205-209` 新增 `anon_read_limiter` (120/min)；`api/search.py` + `api/chunks.py` 对匿名请求加限（已认证 bypass）|

### 🔵 P3 — 分析 + 铺路（4 轮辩论通过）

- **P3-CSP**：Claude 起初把它当成单纯实施项，Codex 推进到发现关键阻塞 — Next.js 14 `headers()` 会强制整页 dynamic，破坏 SEO 静态 prerender + Vercel CDN 缓存。这不是"修复"能解决，是**架构决策**（static-SEO vs strict-CSP 的 trade-off）
- **本 PR 交付**：
  - `.collab/plans/p3-csp-nonce-plan.md` — 三方案（A 全量 nonce / B build-time hash / C Report-Only 观察）对比 + 推荐路径
  - `frontend/src/components/JsonLdScript.tsx` — **pure** helper（接收 `data` + 可选 `nonce` prop，不自己调 `headers()`，不触发页面 dynamic）。为未来迁移铺路，现有 **~108 处 / 41 文件** JSON-LD 不动
- **本 PR 刻意未做**：
  - JSON-LD 批量迁移（需 A/B/C 决策后）
  - Report-Only 头部（需后端 `/api/csp-report` 端点配合，独立 PR）
  - 移除 `script-src 'unsafe-inline'`（依赖前两项）
- **Codex 辩论亮点**：v1 发现我的 helper 错误调用 `headers()` 会强制 dynamic（设计缺陷）；v2-v4 修正规模口径（213 → 108）、类型覆盖（Array 顶层）、plan 文档自洽性

---

## 辩论要点与教训

1. **P1-1 幂等性**：Codex 指出初版 `_refund_predebit` 双重退款风险，改用 `DELETE ... rowcount > 0` 作为单一真相来源，`assert result.rowcount and result.rowcount > 0` 严格幂等
2. **P1-2 最大误判**：Claude 初稿基于"x-real-ip 可伪造"假设移除回退，Codex 核 Next 14.2.35 源码证明 `req.ip` 在 Node adapter 下常 undefined → 最终方案从"单点优先"改为"三级 Vercel 可信头链"
3. **P2-1 shell supervisor**：Codex 证原 while 循环本身未生效（`start_celery &` 子 shell 吞 PID），重写走 cloud-native（容器级重启）
4. **P2-4 并发化**：Codex 要求 `asyncio.gather` 避免 4 个探活串行 20s
5. **P2-10 是 Codex 发现**：Claude 初稿未扫全匿名端点

---

## 待 Codex 恢复后复审项 — **全部已复审完毕**

Codex 配额恢复后补做的对抗审阅（2026-04-12 当日内）：

- **P2-6**：v1 发现两处问题 — ① `qdrant/qdrant:v1.12.4` tag 未验证存在 ② qdrant-client 1.16.1 与 server 1.12.x 超出官方 3-minor 兼容窗口。**v2 修正**：升 server 到 `qdrant/qdrant:v1.14.1`（Codex 联网确认 Docker Hub 有此 tag），加注释说明 prod 用 Railway managed Qdrant。**通过**
- **P2-7**：纯文档化，无代码改动，已写入 `docs/ARCHITECTURE.md §10` 信任链章节
- **P2-8**：v1 发现两处问题 — ① `conftest.py` 默认 `SKIP_INTEGRATION=1`，CI 的 `-m integration` 会被跳过 ② 测试脚本写死 `python` 在仅有 `python3` 的环境会 FileNotFoundError。**v2 修正**：CI 增加 `SKIP_INTEGRATION: "0"` env；测试用 `sys.executable`。**通过**
- **P2-9**：v1 建议用 `if+raise` 替代 `assert last_exc is not None`（避免 `python -O` 下 assert 失效）。**v2 修正**：按建议改。**通过**
- **P2-10**：v1 发现无 block，建议后续补 user_id 维度限流（独立 PR）。**通过**

---

## 文档更新

- `.collab/reviews/2026-04-12-{p1-1..p2-6}-codex-review{,-v2,-v3,-v4}.md` 每项 Codex 审阅记录
- `docs/ARCHITECTURE.md` 新增 "Runtime & Operational Integrity" 小节
- `MEMORY.md` 新增 2026-04-12 修复条目

---

*此报告一份。13 项 P1+P2 修复，6 项 Codex 反驳推翻/修正后定稿，3 轮以上辩论 1 项（P1-2）。代码 + 文档 + CI 三位一体。*
