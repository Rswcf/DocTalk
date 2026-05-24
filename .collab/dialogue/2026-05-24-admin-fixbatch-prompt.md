# 任务:修复你 review 出的 admin 看板缺陷(后端,TDD,gpt-5.5/xhigh)
你的 review 在 `.collab/reviews/2026-05-24-admin-codex-review.md`。修后端 Must-fix + Should-fix(前端 SF1 hash-init 与 Nit1 palette 我已修)。每个 Must-fix 先写会 FAIL 的测试再修到绿;不破坏既有测试。我随后对抗审+提交(你不能 git)。

## Must-fix
1. **留存"未成熟期"不要当真实数据**(`admin.py` retention,~376/394):
   - cohort_grid:当周/未到期的 W_k cell(cohort_week + k 周 > 今天)返回 `null` 或 `is_complete=false`,不要报 0%。
   - D1/D7/D30:分母只计 `first_active <= today - N天` 的用户(没满 N 天的人不能进分母),否则 Dn 被低估。
2. **reason_buckets 必须穷尽**(~660):无任何信号的 churned 用户也要落桶 —— 加显式 `uncategorized` 桶,或把分母/标签改为"已分类 churned"。保证桶占比可解释(要么 sum=100% over churned,要么明确 over classified)。

## Should-fix
- 2. `export_refusal`/`page_fail` 改为**按 session/request** 判定(把用户的请求与其后的 assistant 响应/artifact 配对),不要用"用户级、顺序无关"的存在性(任何导出请求 + 任何 artifact 曾出现就算不退;任何 page 请求 + 任意无关 miss 就算 page_fail)。
- 3. 加 messages 索引支持新查询:`(role, created_at, session_id)` 或 user-role 活动的部分索引(alembic 迁移,**add-only/向后兼容**)。
- 4. 时区一致:`date_trunc('day', created_at AT TIME ZONE 'UTC')`(或显式设会话时区),与 Python 的 UTC cutoff 对齐。
- 5. `cancel_reasons` 去掉 `user_id`(schema + serializer),不暴露非聚合 PII。

## 测试
新增/更新断言:未成熟 cohort cell 为 null/incomplete;Dn 分母成熟度;reason_buckets 穷尽(sum 或 over-classified 明确);timezone 截断;export/page 信号按 session 配对。仿 `test_admin_*` 模式。

## 硬约束
- `SKIP_INTEGRATION=1 python3 -m pytest -q` = 0 failed;`ruff check app/ tests/` 干净;迁移 add-only。
- 不动前端(我已修 SF1+Nit1)。鉴权保持 require_admin。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、自评可否合并。
