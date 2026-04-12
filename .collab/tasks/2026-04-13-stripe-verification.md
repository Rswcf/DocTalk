# Stripe 验收剧本（用户 30 min）

**目标**：验证 Stripe 购买 → webhook → credits 到账/plan 升级 端到端闭环
**前置**：Railway 生产已部署（commit `47ef6b1`+），Stripe test mode 仍启用

---

## 🚨 阻断项（未修复前不可上线 production 真实收费）

**Railway `STRIPE_SECRET_KEY` 仍是 `sk_test_...`（test mode）。** 当前配置下：
- ✅ 可用 Stripe test card `4242 4242 4242 4242` 走全流程验证
- ❌ 真实用户用真信用卡购买会失败（`sk_test_` 不接受真实 PM）
- 上线前必须：
  1. Stripe Dashboard 切 Live mode，重建 7 个 Price objects（Boost/Power/Ultra/Plus月年/Pro月年）
  2. 生成新的 Live webhook endpoint secret
  3. Railway 更新 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、7 个 `STRIPE_PRICE_*` 为 live 值
  4. 重启 backend

本次验收 test mode 下做即可 — 目的是证明代码路径正确，非正式开售。

---

## 验收项 1-3：Credit Pack（Boost/Power/Ultra）

### 步骤（每个 pack 重复一次）
1. 打开 `https://www.doctalk.site/billing` — 登录
2. 记下当前 credits 余额（右上角或 /profile）
3. 点击对应 pack 的"购买"按钮
4. Stripe Checkout 页面用 test card：
   - Number: `4242 4242 4242 4242`
   - Expiry: 任何未来日期（如 `12/30`）
   - CVC: 任何 3 位（如 `123`）
   - Zip: 任何 5 位（如 `12345`）
5. 提交支付 → 跳转回 /billing 或 /profile
6. 刷新页面 → **预期 credits 余额增加**：

| Pack | 预期 credits 增量 | 价格 |
|------|-----------------|------|
| Boost | +500 | $3.99 |
| Power | +2,000 | $9.99 |
| Ultra | +5,000 | $19.99 |

7. **记录 Stripe dashboard session ID**（以 `cs_test_...` 开头）— 在 Stripe Dashboard → Developers → Events 找

### Claude 验证（你报告 session ID 后）
```bash
# 查 Railway logs 确认 webhook
railway logs --service backend 2>&1 | grep -E "Credits granted|checkout\.session\.completed" | tail -20

# 查 DB ledger 确认入账（可选，需 DATABASE_URL）
# SELECT * FROM credit_ledger WHERE ref_type='stripe_payment' ORDER BY created_at DESC LIMIT 5;
```

---

## 验收项 4：Plus Monthly 订阅

### 步骤
1. 如果当前 plan 是 `plus` 或 `pro`，先在 `/profile` 取消订阅
2. `/billing` 点击 "Plus Monthly ($9.99)" 订阅
3. 同样用 test card 4242 完成支付
4. 跳回 /billing → 刷新 → **预期**：
   - /profile 显示 plan = `plus`
   - credits 增加 3,000（月度 allowance，由 `invoice.payment_succeeded` 触发，通常 1-3 秒延迟）
5. 记录 `sub_...` subscription ID

### Claude 验证
```bash
railway logs --service backend 2>&1 | grep -E "invoice\.payment_succeeded|checkout\.session\.completed.*mode=subscription|Plan updated" | tail -20
```

---

## 验收项 5（可选，加分）：订阅取消

1. `/profile` 点击 "Cancel subscription"
2. Stripe Dashboard 观察 subscription status 变化
3. **预期**：当前 billing period 到期时 plan 自动降级，但**本期内 credits 不清零**（behavior 以 ARCHITECTURE 为准）

---

## 回报模板

复制以下粘贴给 Claude：

```
[Stripe 验收回报]
- Boost: session=cs_test_XXX, credits before→after: 1000→1500 ✅/❌
- Power: session=cs_test_XXX, credits before→after: 1500→3500 ✅/❌
- Ultra: session=cs_test_XXX, credits before→after: 3500→8500 ✅/❌
- Plus Monthly: sub_XXX, plan=plus ✅/❌, credits +3000 ✅/❌
- 异常（如有）：
```

Claude 收到后会查 Railway logs + DB 交叉验证，24h 内确认 Phase-B 闭环或提交阻断清单。

---

## 已知可能的坑（Claude 提前识别）

1. **Checkout 跳转 URL 错误** — `FRONTEND_URL=https://www.doctalk.site` 已在 Railway（核过），应返回正确域名
2. **Webhook 签名失败** — `STRIPE_WEBHOOK_SECRET=whsec_75F0ExA...` 已配置（核过），若 Dashboard 重新生成过会导致 401
3. **client_reference_id 缺失** — 前端 checkout 必须带 `client_reference_id=<user_id>`（见 billing.py:490-497），若前端升级过可能漏传
4. **metadata.credits 缺失** — 前端必须在 checkout session 的 metadata 带 `credits=<amount>`（见 billing.py:502-512）
5. **invoice idempotent** — 同一 invoice.id 不会重复 grant credits（见 billing.py:527-533 查 CreditLedger by ref_id）

---

## Env 核查结果（Claude 已做）

| Var | Railway 值 | 对照 `stripe-todo.md` | 状态 |
|-----|-----------|----------------------|------|
| STRIPE_PRICE_BOOST | `price_1T0LLC7L0c9GeI9Io70xogPw` | 匹配 | ✅ |
| STRIPE_PRICE_POWER | `price_1T0LNK7L0c9GeI9IjHmvVLLC` | 匹配 | ✅ |
| STRIPE_PRICE_ULTRA | `price_1T0LOG7L0c9GeI9IeZs8xv5F` | 匹配 | ✅ |
| STRIPE_PRICE_PLUS_MONTHLY | `price_1Sz34S7L0c9GeI9IJkC9CnAR` | 匹配 | ✅ |
| STRIPE_PRICE_PLUS_ANNUAL | `price_1T0M8W7L0c9GeI9IRBLVTOau` | 匹配 | ✅ |
| STRIPE_PRICE_PRO_MONTHLY | `price_1Sz2rX7L0c9GeI9IOryemL34` | 匹配 | ✅ |
| STRIPE_PRICE_PRO_ANNUAL | `price_1T0M9W7L0c9GeI9IRMTIyZTM` | 匹配 | ✅ |
| STRIPE_SECRET_KEY | `sk_test_...` | test mode | ⚠️ 阻断上线 |
| STRIPE_WEBHOOK_SECRET | `whsec_75F0ExA...` | 已设 | ✅ |

**结论**：7 个 price ID + webhook 已就绪，`STRIPE_SECRET_KEY` 仍为 test。test mode 验收无阻断。

---

## Webhook 代码路径核实（Claude 已做）

`backend/app/api/billing.py:822-862` `stripe_webhook()` dispatch 6 种 event：

| Event type | Handler | 行 |
|-----------|---------|----|
| `checkout.session.completed` | `_handle_checkout_session_completed` | 559 |
| `checkout.session.expired` | `_handle_checkout_session_expired` | 704 |
| `invoice.payment_succeeded` | `_handle_invoice_payment_succeeded` | 571 |
| `customer.subscription.deleted` | `_handle_subscription_deleted` | 646 |
| `customer.subscription.updated` | `_handle_subscription_updated` | 734 |
| `invoice.payment_failed` | `_handle_invoice_payment_failed` | 808 |

- **Credit pack path**：`checkout.session.completed` → `_handle_checkout_session_completed:559` → mode=`payment` → `_handle_checkout_session_payment_completed:484` → `credit_credits()` 用 `payment_intent` 做幂等（`billing.py:527-533`）
- **Subscription path**：`checkout.session.completed` → mode=`subscription` → `_handle_checkout_session_subscription_completed:403` → 仅更新 plan；credits 由首个 `invoice.payment_succeeded:571` 触发（幂等 by invoice.id）
- Stripe signature 强制验证（`billing.py:831-840`），`STRIPE_WEBHOOK_SECRET` 未配置返回 503（`billing.py:827`）

**结论**：代码路径齐全，无明显缺陷。

---

## S-Phase-B Done 判定（Claude 负责验证）

收到用户回报后，Claude 需确认：
- [ ] 3 个 pack 的 `CreditLedger` 记录：`ref_type='stripe_payment'`, `ref_id=<pi_...>`, `delta > 0`
- [ ] 1 个订阅 `User.plan='plus'` 且 `CreditLedger` 有 invoice-based allowance
- [ ] Railway logs 无 `Failed to grant credits` / `Webhook signature verification failed`

全 pass → S 批次真正 Done。
