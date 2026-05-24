# 任务:重构 admin 看板为 SaaS 产品分析控制台(6 tab,留存+流失诊断为核心)。TDD。gpt-5.5/xhigh。

完整 spec(权威契约,务必遵守):`.collab/plans/2026-05-24-admin-dashboard-redesign-spec.md`。先写后端两个新端点的失败测试,再实现到绿;前端分 tab + 美化。我随后对抗审 + 提交(你不能 git)。

## 后端(先做,TDD)
- 新增 `GET /api/admin/retention` 和 `GET /api/admin/churn`(挂在现有 admin router,`require_admin` 鉴权,只读)。数据契约见 spec(cohort_grid / curves D1/D7/D30 / dau_wau_mau+stickiness / by_segment / weekly_flow;churn 的 one_and_done / churn_signals / last_action / feedback / cancel_reasons / reason_buckets)。
- 排除 owner/admin 账户;activity=user-role message(join sessions.user_id);查询要高效(有界时间窗、避免 N+1、用现有索引)。
- 复用现有 `admin.py` 的风格 + Pydantic response model(参考 `AdminOverviewResponse` 等)。
- 测试:`tests/test_admin_retention.py`、`tests/test_admin_churn.py`,仿 `test_admin_*` 既有模式(fake/seed 数据),断言 cohort 网格形状、D1/D7/D30 数学、churn 信号占比、reason 分桶、owner 排除。

## 前端(后端绿后)
- `AdminPageClient.tsx` 改为**tab 切换**(sticky 导航、URL hash 可链接如 `#retention`、键盘可达);每个 tab 首次打开才拉该 tab 数据(别一次拉 9 个端点)。
- 6 tab 见 spec(Overview/Activation/Retention/Why-not-retained/Revenue/Product)。复用现有 FunnelPanel/RagQualityPanel/BillingHealthPanel 归入对应 tab。
- 新组件拆到 `frontend/src/components/admin/`:`RetentionHeatmap`(cohort 网格,% 着色 zinc→blue)、`RetentionCurves`、`ChurnSignalsBars`、`ReasonBucketsDonut`、`FeedbackList`、强化版 `KPICard`(delta 箭头+sparkline)。
- 美化:app **zinc + 蓝 `#1D4ED8`** 调色板(禁用 editorial/terracotta)、light/dark、`tabular-nums`、每 tab 有 loading/empty/error 态。所有文案走 `tOr(key,'English')`(11 locale)。Recharts(已有依赖)。

## 硬约束 / 验收
- `SKIP_INTEGRATION=1 python3 -m pytest -q` = 0 failed;`ruff check app/ tests/` 干净;前端 `npx tsc --noEmit` 干净。(`next build` 我在隔离 worktree 验,因本地 dev server 在跑。)
- 不引入新重依赖;不破坏既有 admin 端点/测试;admin 鉴权强制。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、自评可否合并。
