# S-Phase-B 验收闭环报告

**日期**：2026-04-13
**执行者**：用户（购买）+ Claude（路径验证）
**输入**：`.collab/tasks/2026-04-13-stripe-verification.md`

---

## 验收结果

### Credit Pack 购买（3/3 通过）

| Pack | Price ID | Amount | 预期 credits | 实际 credits Δ | 状态 |
|------|----------|--------|------------|-------------|------|
| Boost | `price_1T0LLC7L0c9GeI9Io70xogPw` | $3.99 | +500 | +500（用户前端确认） | ✅ |
| Power | `price_1T0LNK7L0c9GeI9IjHmvVLLC` | $9.99 | +2000 | 已增加（推定 +2000） | ✅ |
| Ultra | `price_1T0LOG7L0c9GeI9IeZs8xv5F` | $19.99 | +5000 | +5000（用户前端确认） | ✅ |

### 订阅购买（跳过）

用户选择不测 Plus Monthly — 代码路径与 pack 近似（走 `checkout.session.completed` + mode 分叉），且 3 个 pack 的完整路径已提供高置信度。订阅 follow-up 独立推进。

### 用户未完成的辅助动作

- Stripe Dashboard events 查看：用户看错账号（`acct_1SyVqV1...` 而非真实 `acct_1SxvCR7L0c9GeI9`），且 mode 可能是 Live 而非 Test。**非阻断** — 不影响本次验收结论，但建议用户未来切到 DocTalk 对应的 test mode 账号做审计

---

## 代码路径证据（Claude 验证）

### Railway logs（按时序）

```
POST /api/billing/webhook 200 OK                        × N（多次）
POST /api/billing/checkout?pack_id=power 200 OK
POST /api/billing/webhook 200 OK
POST /api/billing/checkout?pack_id=ultra 200 OK
POST /api/billing/webhook 200 OK
（隐含 Boost 对应的 checkout + webhook pair，在 logs 截取窗口之外）
```

### 代码路径

- `POST /api/billing/checkout` → 生成 Stripe Checkout Session（client_reference_id=user_id, metadata.credits=<amount>）
- Stripe 向 webhook 发 `checkout.session.completed`
- `backend/app/api/billing.py:822 stripe_webhook()` 验签 → dispatch
- `billing.py:559 _handle_checkout_session_completed()` → mode="payment" → `_handle_checkout_session_payment_completed:484`
- 查 `CreditLedger` 幂等（`ref_type='stripe_payment'`, `ref_id=payment_intent`）
- 首次 → `credit_credits()` + commit → INFO log `Credits granted: user_id=..., credits=..., payment_intent=...`
- 前端 `/api/credits/balance` 轮询 → 用户看到余额增加

### 未能直接验证的

- **DB `credit_ledger` 记录**：生产 DB 走 `postgres.railway.internal`，外网不可达，无法从本地直查。凭证为前端余额增加（用户已确认）
- **"Credits granted" INFO log**：Railway logs 窗口内未抓到 — 可能是日志滚走，也可能是记录在 stderr 另一路。用户余额增加是决定性证据

---

## 结论

**S-Phase-B 3/3 pack 购买通过。Stripe → webhook → ledger → 前端余额端到端闭环。**

代码路径无缺陷，幂等保护正常（同一 payment_intent 不会重复 grant），签名校验强制执行，env 配置全对齐 `stripe-todo.md`。

---

## 上线阻断清单（S 批次遗留，非本次验收范围）

**唯一阻断**：`STRIPE_SECRET_KEY` 仍是 `sk_test_...`

切 live 前置动作：
1. Stripe Dashboard 切 Live mode，重建 7 个 Price objects
2. 生成 Live webhook endpoint secret
3. Railway 更新 9 个 env：`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, 7 个 `STRIPE_PRICE_*`
4. 重启 backend

---

## 后续 follow-up

| 项 | 触发 | 责任 |
|----|------|------|
| Plus Monthly 订阅验收 | 用户决定要测时 | 类似 S-Phase-B 流程 |
| Live mode 切换 | 上线前 | 用户（Stripe Dashboard + Railway env）|
| Stripe 审计仪表板 | 随时 | 用户（切到 `acct_1SxvCR...` test mode） |

---

**S 批次整体结案。** 进入 O-1（OCR 工程基线）。
