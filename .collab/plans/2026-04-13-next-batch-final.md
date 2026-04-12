# 2026-04-13 下一批工作 — 定稿（Claude↔Codex 3 轮辩论后）

**辩论记录**：
- 初稿：`.collab/plans/2026-04-13-next-batch-proposal.md`（Claude A→C→B）
- r1：`.collab/dialogue/2026-04-13-next-batch-codex-r1.md`（Codex 推翻，重排为 S>O>A'）
- r2：`.collab/dialogue/2026-04-13-next-batch-claude-r2.md`（Claude 拆分工）
- r2 审：`.collab/dialogue/2026-04-13-next-batch-codex-r2.md`（NEEDS-R3：O 样本 + S 闭环）
- r3：`.collab/dialogue/2026-04-13-next-batch-claude-r3.md`（Claude 拆 O-1/2 + S-A/B）
- 终审：`.collab/dialogue/2026-04-13-next-batch-codex-r3.md`（**APPROVED**）

---

## 三批次执行顺序：S-A → O-1 → A'

| 批次 | Claude 今日交付 | 用户交付（异步） | 真正 Done |
|------|---------------|----------------|----------|
| **S-Phase-A** | env 核查 + 验收剧本 + 阻断清单 | — | Phase-A 完成 |
| **S-Phase-B** | — | 4 次购买（3 pack + 1 订阅） | webhook + ledger 到账确认 |
| **O-1** | 合成样本 metrics + edge case + 代码 walk-through + 文案修正 | — | O-1 完成 |
| **O-2** | — | 3-5 份真实脱敏扫描样本 | Claude 异步 benchmark + go/no-go |
| **A'** | 1a recon / 1b GA 去噪 / 2 csp-report endpoint / 3 Report-Only header / 收尾 MEMORY 抽查 | — | A' 完成 |

**今日 Claude 工时**：5.5-7h
**今日用户工时**：30 min（S-B）
**异步 follow-up**：S-B、O-2、CSP 观察期 1-2 周

---

## 批次 1 / S-Phase-A：Stripe 真值验收（env 核查 + 剧本）

### Claude 做
1. `railway variables --service backend` 读 7 个 `STRIPE_PRICE_*` env，验证非占位值
2. `backend/app/api/billing.py` webhook handler 代码路径证据：三种 event (`checkout.session.completed` / `invoice.payment_succeeded` / `customer.subscription.deleted`) 的 handler 行号 + 关键逻辑
3. 写 `.collab/tasks/2026-04-13-stripe-verification.md` — 用户 30 min 验收剧本（含 test card、期望 credits、webhook 确认命令）
4. 环境阻断清单（如有占位/缺失）

### Done 标准
- env 核查结果表（7 项 pass/fail）
- webhook 代码路径文档
- 验收剧本可直接粘贴执行
- 阻断清单提交到 `.collab/tasks/`

**时长**：1-1.5h

---

## 批次 2 / O-1：OCR 工程基线（**不做产品 go/no-go**）

### Claude 做
1. **合成样本**（3 个）：用 demo `attention-paper.pdf` / `alphabet-earnings.pdf` / `court-filing.pdf`，render 为 image 塞回 PDF（200dpi / 100dpi / 15° 倾斜）
2. **Edge case**（4 个）：走 `extract_pages_ocr` mock — 超大页 DPI cap（已有 test 覆盖）/ 语言切换失败 / 空页 / tesseract binary 缺失
3. **代码 walk-through**：`parse_worker.py:192-237` OCR 分支 + `parse_service.py:107-189` tesseract 调用
4. **文案修正**：
   - 旧 roadmap `.collab/plans/2026-03-16-user-pain-points-feature-roadmap.md:32` 把 "❌ 无OCR支持" 改为 "⚠️ 有 Tesseract，扫描 PDF 质量未量化"
   - `frontend/src/i18n/locales/*.json` lawyers FAQ #4 对 OCR 的表述核对（至少 en 和 zh）
5. 产出 `.collab/reviews/2026-04-13-ocr-baseline.md`

### Done 标准
- 合成样本 metrics 表（识别字符数 / 字符密度 / 处理延迟）
- 4 edge case 行为确认
- 代码路径文档
- 2 处文案修正 commit
- **明确声明**："不做产品 go/no-go，需真实样本（O-2）"

**时长**：2-2.5h

---

## 批次 3 / A'：CSP 分步（recon → 去噪 → 上报）

### Claude 做
1. **1a recon**：读 `AnalyticsWrapper.tsx`，判 GA init 是纯静态（可外置 `public/ga-init.js`）还是依赖 runtime state（必须 hash/nonce）
2. **1b 执行**：按 1a 决策外置或计算 sha256
3. **2 新端点**：`frontend/src/app/api/csp-report/route.ts` — 同域、接 `application/csp-report` 和 `application/reports+json`、payload ≤ 10KB、简易频率限制（每 IP 30/min）、落 Sentry（level=warning, tag=csp-violation）
4. **3 Report-Only header**：`frontend/next.config.mjs` 加 `Content-Security-Policy-Report-Only`（strict 版本，无 unsafe-inline、script-src 用 nonce placeholder），附 `report-uri /api/csp-report`。**仅 production enable**
5. **收尾 MEMORY 抽查**（30 min）：核 `~/.claude/projects/-Users-mayijie-Projects-Code-010-DocTalk/memory/fixes-2026-04-12.md` 的 5 处文件路径/行号断言（`chat_service.py:75-99, 574-583, 906-916` 等）是否还对

### Done 标准
- AnalyticsWrapper 不再违反 strict CSP（验证方式：本地 dev 查 console 无 violation）
- 本地 dev 能看到 Report-Only 违规上报到 `/api/csp-report` 并落 Sentry event
- MEMORY 断言校验结果（pass/fail per 断言）

**时长**：2-2.5h

---

## 异步 follow-up 清单

| Follow-up | 触发 | 责任 | 备注 |
|-----------|------|------|------|
| S-Phase-B | 用户按剧本购买完成 | Claude 查 logs + DB | 4 次购买全闭环 |
| O-2 | 用户提供 3-5 份脱敏扫描样本 | Claude 异步 benchmark | Mistral Document AI / Tesseract-tuned 横评 + go/no-go |
| CSP 观察期 | A' 上线后 1-2 周 | Claude | 根据 Report-Only 数据决策 strict CSP 切换策略 |

---

**执行起点**：本文件定稿，Claude 开始 S-Phase-A。
