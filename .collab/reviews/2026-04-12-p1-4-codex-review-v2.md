结论：无阻塞问题，可合并。  

已核对 4 文件：新增 `frontend/src/lib/clearAccountStorage.ts`，并在 `UserMenu`、`AccountActionsSection`、`HomePageClient` 接入，改动与需求一致。`clearAccountStorage` 先收集后删除，仅清理 `doctalk_*`；白名单保留 `doctalk_locale`/`doctalk_tour_completed`/`doctalk_analytics_consent`。`HomePageClient` 的 `unauthenticated` 分支覆盖 session 过期、登出、匿名访问；匿名首次访问无相关键，影响可忽略，策略与原“未登录清 `doctalk_docs`”一致（仅扩大清理范围）。`npx tsc --noEmit` 复跑通过。
