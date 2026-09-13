# 发布候选独立定向复核

日期：2026-09-13。范围：`codex/systematic-qa-fixes` 的冻结聊天清理与年付履约候选，以及最后新增的订阅入口、年付金额和 11 语言文案差异。复核人独立只读检查产品代码；本次仅写此报告。

在上述范围内，未发现当前可复现的 P1/P2。此前提出的正常数据库路径清理问题已修正；这不代表生产部署已经验收。

| 范围 | 复核结论与依据 |
| --- | --- |
| 聊天取消与超时（R3-2/R3-3） | `chat_cleanup.py` 的单次受保护任务隔离原生 `Task.cancel()`，每阶段独立预算，超时后两阶段 cancel-and-drain。生成器关闭和 ContextVar 重置留在原任务，heartbeat、请求事务回滚、lease 释放和 ASGI background 各自有收尾路径。实际 Session 的 close/invalidate 在受跟踪任务内执行，已消除 SQLAlchemy `__aexit__` 隐藏 close 子任务反例。 |
| 清理时限与 PostgreSQL 锁 | 已删除会被 heartbeat 提前消耗的共享时钟。当前注释准确列出已知路径的 44 秒预算（含取消收束），`entrypoint.sh` 的 Uvicorn grace 为 60 秒。真实 PG 测试在外层 session 退出前使用 NOWAIT 获取行锁；延迟 close 测试检查全部新增任务，断言不再仅检查任务名称。 |
| 年付履约与月付兼容 | 已审查日历月周年日期、分期唯一性、用户锁与额度/账本/发放标记同事务、invoice 权属、退款核验及重试。失败 invoice 的全部分期延后重试，避免批次饥饿；首期也经过退款/终止检查；已支付旧周期不因当前 unpaid 被误停。已发现的信用票据遗漏、迟到套餐事件覆盖及 metadata-only 事件错误推进水位问题均已修正。旧账本不自动补建年付分期，保留人工核对边界。 |
| 最后前端差异 | admin-managed 用户选择不同套餐调用 subscribe；Stripe-managed 用户保留套餐变更路径；年付 capability 关闭仍禁止下单。卡片和 PricingTable 文案一致。全年金额直接格式化 Stripe 的 `amount_minor`，没有把已四舍五入的月均价乘以 12。11 个 locale JSON 及 `{plan}` / `{amount}` 占位符检查通过。 |

验证来源：

- 独立执行了聊天清理纯测试及延迟 Session close 隔离反例；检查了真实 PostgreSQL 故障注入测试的锁与任务断言。最后前端检查从实际 TSX 提取 `handlePlanAction` 执行 8 个隔离分支断言，并验证全年金额格式化。没有将这些测试称为浏览器验收。
- 主任务报告的证据包括：48 项聊天定向测试、真实 PG 集成回归，以及 Stripe Sandbox Test Clock 的全年履约、升级、取消和退款流程。最后补齐的迟到升级月度差额、`funding_invoice` 和升级发票退款核验属于主任务补充证据；本报告不冒称独立执行了 Stripe 生命周期测试或全量回归。
- 相关回归文件：`backend/tests/test_chat_cleanup.py`、`backend/tests/test_response_versions_integration.py`、`backend/tests/test_asst0_cancellation_baseline.py`、`backend/tests/test_annual_credit_delivery.py`、`backend/tests/test_annual_credit_integration.py`。

保留一个非阻断 P3：`BillingPageClient.tsx` 顶部营销意图 CTA 对 admin-managed 的同套餐仍显示 “Subscribe to {plan}”，而 `handlePlanAction` 同套餐直接返回。例如当前 Plus 打开 `/billing?source=pricing&plan=plus`。无动作分支是历史行为，本次新文案使承诺更明确；建议同套餐显示 Current plan 并禁用，保留 Pro 缺额度时查看额度包的特殊入口。不同套餐的本次修复不受影响。

覆盖边界：本次独立复核没有浏览器操作、外部付款、生产写入或部署。已验证正常异步数据库取消路径；不能据此保证恶意吞掉取消的任意协程、进程崩溃或外部服务永久不可用时仍能完成收尾。Sandbox 生命周期与生产投递/部署验收应分别记录。
