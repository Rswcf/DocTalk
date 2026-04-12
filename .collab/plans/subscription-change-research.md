# Subscription Change Research Report

*Date: 2026-02-13 | Status: Research complete, pending implementation*

---

## Executive Summary

DocTalk 的订阅变更流程存在一个 **CRITICAL** 级别的 bug：当已订阅用户（如 Pro）点击"Upgrade Plus"时，系统通过 Stripe Checkout 创建了一个**全新的订阅**，而不是修改现有订阅。这会导致用户同时持有两个活跃订阅，被双重扣款。

此外还发现 5 个中高严重度的 gap，涉及 webhook 事件覆盖不足、credit 处理缺失、前端 UX 误导等问题。

---

## 一、当前代码路径分析（问题在哪）

### Pro 用户点击 "Upgrade Plus" 的完整路径：

```
Frontend: billing/page.tsx:229 → handleSubscribe('plus')
  → api.ts:159 → POST /api/proxy/api/billing/subscribe { plan:'plus', billing:'monthly' }
Backend: billing.py:107-135 → subscribe()
  → stripe.checkout.Session.create(mode="subscription", ...) ← 创建全新订阅！
  → 返回 checkout_url → 用户跳转 Stripe Checkout 页面
  → 付款成功 → webhook: checkout.session.completed
Backend: billing.py:152-204 → _handle_checkout_session_subscription_completed()
  → user.plan = "plus"                          ← plan 被覆盖
  → user.stripe_subscription_id = new_sub_id    ← 旧订阅 ID 丢失！
  → 旧 Pro 订阅仍在 Stripe 中活跃，继续扣款
```

### 问题根因

`billing.py:107-135` 的 `subscribe()` 端点：
- **没有检查** `user.stripe_subscription_id` 是否已存在
- **没有取消**旧订阅
- Stripe Checkout **只能创建新订阅**，不能修改现有订阅（这是 Stripe 的设计限制）

---

## 二、所有 Corner Cases 全景

### A. 订阅变更场景

| # | 场景 | 当前行为 | 正确行为 | 严重度 |
|---|------|---------|---------|--------|
| A1 | Pro Monthly → Plus Monthly（降级） | 创建第二个订阅，双重扣款 | 当前周期结束后切换到 Plus | **CRITICAL** |
| A2 | Plus Monthly → Pro Monthly（升级） | 创建第二个订阅，双重扣款 | 立即升级，按比例补差价 | **CRITICAL** |
| A3 | Pro Monthly → Plus Annual（降级+周期变更） | 创建第二个订阅 | 当前周期结束后切换，重置 billing anchor | **CRITICAL** |
| A4 | Pro Annual → Plus Monthly（降级+周期变更） | 创建第二个订阅 | 当前年度结束后切换（或立即切换+大额 credit） | **CRITICAL** |
| A5 | Plus Monthly → Plus Annual（同档升周期） | 创建第二个订阅 | 立即切换，抵扣未用月费 | **CRITICAL** |
| A6 | Any plan → Free（取消） | Customer Portal 处理，webhook 正常 | ✅ 正常工作 | OK |
| A7 | Free → Any paid（首次订阅） | Stripe Checkout 创建新订阅 | ✅ 正常工作 | OK |

### B. Credit 相关 Corner Cases

| # | 场景 | 当前行为 | 风险 |
|---|------|---------|------|
| B1 | Pro→Plus 降级，本月已获得 9000 Pro credits | credits 不回收，plan 变 plus | 用户用 Pro 价格的 credits 享受更多月份 |
| B2 | 双重订阅导致两个 invoice.payment_succeeded | 两次 credit_credits()，各 grant 一次 | 每月获得 9000+3000=12000 credits |
| B3 | 用户在降级前已消费超过新 plan 额度 | 无处理 | 例：已用 5000 credits，降到 Plus(3000/mo)，余额为负？ |
| B4 | 年付降级产生大额 proration credit | 无处理 | Stripe 自动在 customer balance 中累积 credit，可能覆盖数月费用 |

### C. Webhook 覆盖缺失

| # | 事件 | 是否处理 | 影响 |
|---|------|---------|------|
| C1 | `checkout.session.completed` | ✅ 已处理 | — |
| C2 | `invoice.payment_succeeded` | ✅ 已处理 | — |
| C3 | `customer.subscription.deleted` | ✅ 已处理 | — |
| C4 | `customer.subscription.updated` | ❌ **未处理** | Portal 发起的 plan 变更对 app 不可见，最多延迟 1 个月 |
| C5 | `invoice.payment_failed` | ❌ **未处理** | 续费失败不触发降级或通知 |
| C6 | `customer.subscription.paused` | ❌ 未处理 | 低优先级 |

### D. 前端 UX 问题

| # | 问题 | 详情 |
|---|------|------|
| D1 | 降级按钮文案误导 | Pro 用户看到 "Upgrade Plus"，实际是降级 |
| D2 | 无 plan 层级意识 | 前端不理解 Pro > Plus > Free 的层级关系 |
| D3 | 60s profile 缓存 | Portal 操作返回后可能显示旧 plan 数据 |

---

## 三、Stripe Best Practices（行业标准做法）

### 核心原则：升级立即生效，降级周期末生效

这是 Slack、Notion、GitHub、Zoom 等主流 SaaS 的通用做法：

| 操作 | 生效时间 | Stripe API | Proration |
|------|---------|------------|-----------|
| **升级**（Plus→Pro） | 立即 | `subscriptions.update()` + `proration_behavior=always_invoice` | 立即收取差价 |
| **降级**（Pro→Plus） | 当前周期结束 | `subscription_schedules.create()` 或 `cancel_at_period_end` + 新订阅 | 无需 proration |
| **取消** | 当前周期结束 | `subscriptions.update(cancel_at_period_end=True)` | 无 |

### 关键 API 选择

| 场景 | 正确方式 | 错误方式 |
|------|---------|---------|
| 首次订阅 | `stripe.checkout.Session.create(mode="subscription")` | — |
| 变更 plan（升级/降级） | `stripe.Subscription.modify()` 或 `SubscriptionSchedule` | ~~Stripe Checkout~~（会创建新订阅） |
| 取消/管理付款方式 | Customer Portal | — |

### Proration 计算示例

Pro ($19.99/mo) → Plus ($9.99/mo)，在周期中点（50%）降级：
```
Credit for unused Pro: 0.5 × $19.99 = $10.00
Charge for remaining Plus: 0.5 × $9.99 = $5.00
Net credit: $5.00 → 应用到下次 invoice（不退回信用卡）
```

---

## 四、推荐实现方案

### 方案概述

```
                    用户点击 plan 变更
                           │
                    ┌──────┴──────┐
                    │ 已有订阅？   │
                    └──────┬──────┘
                      No   │   Yes
                      │    │    │
              Checkout │    │    │ API modify
              (新订阅)  │    │    │ (修改现有)
                      │    │    │
                      ▼    │    ▼
                           │
                    ┌──────┴──────┐
                    │ 升级还是降级？│
                    └──────┬──────┘
                   升级│        │降级
                      │        │
                      ▼        ▼
              立即生效       周期末生效
          always_invoice   schedule_at_period_end
```

### 后端改动要点

**1. 新增 `/api/billing/change-plan` 端点**（替代对已订阅用户的 `/subscribe`）
```
POST /api/billing/change-plan { plan: "plus", billing: "monthly" }

逻辑：
1. 检查 user.stripe_subscription_id 是否存在
2. 获取当前订阅详情 (stripe.Subscription.retrieve)
3. 判断升级/降级（对比 price 层级）
4. 升级 → stripe.Subscription.modify(proration_behavior="always_invoice")
5. 降级 → stripe.Subscription.modify(cancel_at_period_end + schedule)
   或 stripe.SubscriptionSchedule 安排在周期末切换
6. 返回结果（不需要 Checkout URL）
```

**2. `/subscribe` 端点加守卫**
```python
if user.stripe_subscription_id:
    raise HTTPException(400, "Already subscribed. Use /change-plan instead.")
```

**3. 新增 webhook handler: `customer.subscription.updated`**
```python
async def _handle_subscription_updated(subscription, db):
    # 检测 price_id 变化 → 更新 user.plan
    # 检测 cancel_at_period_end 变化 → 标记待降级状态
```

**4. 新增 webhook handler: `invoice.payment_failed`**
```python
async def _handle_payment_failed(invoice, db):
    # 标记用户付款失败状态
    # N 次失败后降级到 free
```

### 前端改动要点

**1. Plan 层级感知**
```
PRO > PLUS > FREE
```
- Pro 用户看 Plus card → 显示 "Downgrade to Plus"（而非 "Upgrade"）
- Plus 用户看 Pro card → 显示 "Upgrade to Pro"

**2. 降级确认弹窗**
- 说明当前周期结束日期
- 说明降级后的 credit 变化
- "Your Pro plan will continue until {date}. After that, you'll be on the Plus plan."

**3. 已订阅用户不走 Checkout**
- 调用 `/api/billing/change-plan` 而非 `/api/billing/subscribe`
- 不需要跳转 Stripe 页面（API 直接处理）

### Credit 处理策略

| 场景 | 推荐做法 |
|------|---------|
| 降级（周期末生效） | 当前周期 credits 不变，下个周期按新 plan grant |
| 升级（立即生效） | 立即补发差额 credits（Pro credits - Plus credits = 6000） |
| 取消 | 当前周期 credits 保留到期 |

---

## 五、风险汇总（按优先级）

| 优先级 | 问题 | 修复难度 | 业务影响 |
|--------|------|---------|---------|
| **P0** | 双重订阅 bug（/subscribe 不检查现有订阅） | M | 用户被双重扣款 → 退款纠纷 → Stripe 风险 |
| **P0** | 前端降级走 Checkout 路径 | S | 直接触发上述 bug |
| **P1** | 缺少 `subscription.updated` webhook | M | Portal 变更不同步 |
| **P1** | 缺少 `payment_failed` webhook | S | 付款失败无降级 |
| **P2** | Credit proration（升级补发/降级不回收） | M | 公平性问题 |
| **P2** | 前端 UX（按钮文案、确认弹窗） | S | 用户误操作 |
| **P3** | 年付↔月付切换的大额 credit 处理 | L | 财务影响 |
| **P3** | Profile 60s 缓存延迟 | XS | 轻微 UX 问题 |

---

## 六、暂缓决策项（需要产品决定）

1. **降级时已发放的 credits 是否回收？** 推荐：不回收，当前周期保留，下周期按新 plan 发放
2. **年付用户是否允许中途降级？** 推荐：只允许周期末降级（避免大额 credit 复杂度）
3. **升级时是否立即补发 credit 差额？** 推荐：是（Pro 9000 - Plus 3000 = 补发 6000）
4. **是否允许 annual ↔ monthly 切换？** 推荐：beta 期间暂不支持，只允许同周期内升降级
