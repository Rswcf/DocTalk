# 角色:对抗式代码审查 — DocTalk admin 分析看板(6 tab,留存+流失)
我(Claude)+你(上一轮网络中断,我补完了 tab 容器)实现了新 admin 看板。后端 416 passed、ruff、tsc 干净。请**对抗式复审**,不要盖章。你不能 git。
## surface
- diff:`.collab/reviews/2026-05-24-admin-dashboard-diff.patch`;spec:`.collab/plans/2026-05-24-admin-dashboard-redesign-spec.md`
- 现网:`backend/app/api/admin.py`(admin_retention/admin_churn)、`schemas/admin.py`、`frontend/src/app/admin/AdminPageClient.tsx`、`frontend/src/components/admin/*`
- 测试:`backend/tests/test_admin_retention.py`、`test_admin_churn.py`
## 重点(逐项 file:line)
1. **SQL 正确性**:cohort_grid 的"周偏移活跃"计算、D1/D7/D30 分母/分子定义、churn_signals 各信号判定(asst_zero/rag_miss/parse_failure/large_doc/export_refusal/paywall_hit)、reason_buckets 分桶逻辑是否真对;owner 排除是否覆盖所有用户级查询;时区(date_trunc/UTC)是否一致。
2. **性能**:这些查询在生产规模(数千 chunk/messages、~100 用户但会增长)是否高效?有无 N+1、全表扫描、笛卡尔积、缺索引?cohort 网格是否一次查询而非循环 12×12 次查询?
3. **鉴权/隐私**:两个新端点是否都 require_admin?是否泄露非聚合 PII(churn feedback/last_action 是否带过多个人数据)?
4. **前端**:lazy per-tab fetch 是否真的按 tab 拉(没在 mount 拉全部)?period 切换的重取是否正确失效缓存?tab 容器(我补的)有无 bug?palette 是否纯 zinc/blue 无 editorial 泄漏?
5. **数据真伪**:留存/流失数字会不会因 join/去重/空值错误而误导 PM 决策?
6. 跑 `SKIP_INTEGRATION=1 python3 -m pytest -q backend/tests/test_admin_retention.py backend/tests/test_admin_churn.py`。
## 输出:Must-fix/Should-fix/Nit(file:line+可证伪+建议),最后给「可否合并 main」。
