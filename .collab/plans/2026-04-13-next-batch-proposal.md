# 下一批工作提议（Claude 初稿）

**日期**：2026-04-13
**上下文**：2026-04-12 P1/P2 修复批次（13 项）已上线 stable，Railway 与 Vercel 均已部署，entrypoint 重写验证通过（worker + beat + uvicorn 三进程启动，Celery beat 首次真正运行）。未提交积压已整理入库。问"下一批做什么"。

---

## 当前待办全景（扫描完 `.collab/plans/` 后）

### 已完成 / 无法代做
- **Stripe Boost/Power/Ultra Price objects**：2026-02-13 已全部配好（见 `stripe-todo.md`），剩 test-mode 购买验证需人工操作
- **GSC/Bing/Baidu/Naver/GA4 注册**：用户账号，非我能做
- **SEO Phase 2 内容（15 博客+5 use case）**：批量写作需用户先拍板 keyword 清单和语气基调
- **Email DNS 配置（SPF/DKIM/DMARC）**：需要动 Cloudflare DNS，用户操作

### 候选可执行批次

| ID | 批次 | 规模 | 我独立做 | 需要用户 |
|----|------|------|---------|---------|
| **A** | **P3 CSP Report-Only 落地** — `/api/csp-report` endpoint + Report-Only header + Sentry 聚合 | 1-2h | ✅ | 观察期结束后决策 nonce 迁移策略 |
| **B** | **OCR 接入可行性研究** — Mistral Document AI / Tesseract / Unstructured.io / pdfplumber-ocr benchmark（Tier 1 痛点 #4） | 3-4h | ✅（出研究报告） | 决策走哪条路径 |
| **C** | **文档同步核对** — `MEMORY.md` / `ARCHITECTURE §10` / `AGENTS.md` / `CLAUDE.md` 与代码现状交叉验证 | 1-2h | ✅ | ❌ |
| **D** | **OCR 接入实施**（选 B 的推荐方案） | 1-2 周 | 部分 | 方案确认 + 付费服务开通 |
| **E** | **多文档 Q&A 设计稿**（Tier 1 痛点 #2）— 无代码，产品 + 架构设计 | 2-3h | ✅ | 产品决策 |
| **F** | **300+页长文档 benchmark**（Tier 1 痛点 #3）— 上传已有 demo 长文档跑真实查询，量化 context / recall 下降 | 2-3h | ✅（需 OpenRouter 预算 ~$5） | 预算确认 |

---

## Claude 推荐

**今日先做 A（CSP Report-Only）→ C（文档同步核对）→ B（OCR 可行性研究）**

### 理由
1. **A 是 2026-04-12 修复批次的自然 follow-up**：P3 CSP plan + JsonLdScript helper 已就位，缺的只是 `/api/csp-report` 后端 + Report-Only header。收尾未完的工作比开新战线优先
2. **C 防止文档漂移**：本次 P1/P2 批次新增了 §10 Runtime & Operational Integrity，AGENTS.md 是新增的 agent onboarding doc — 这些与代码同步，但 MEMORY.md `fixes-2026-04-12.md` 里的文件路径断言（`backend/app/services/chat_service.py:75-99, 574-583, 906-916`）我没验证过现状是否仍精确。memory 宪法明确要求"A memory that names a specific function, file, or flag is a claim that it existed when the memory was written. Verify before recommending."
3. **B 出决策输入而非实施**：Tier 1 痛点 #4（扫描 PDF/OCR）是所有竞品的共同短板，如果 DocTalk 能解决会是强差异化。但上 OCR 是大工程（2+ 周），先出 benchmark 报告再决策，避免盲目投入
4. **D/E/F 暂缓**：都是大规模 feature，需要用户拍板方向后才能启动，今日做了意义不大

### 刻意不做
- **SEO Phase 2 内容批量写作**：依赖用户的 keyword 决策 + 语气指导，闭门造车会白费
- **Tier 1 #1 引用改进**：已有 citation UX 升级（commit 83d5590），再动需要新证据
- **Tier 1 #2/#3 直接实施**：跳过研究直接写代码会是瞎猜

---

## 待 Codex 挑战的点

1. **A 优先级是否正确**？CSP Report-Only 本身不带来用户价值，只为以后拆 unsafe-inline 铺路。是否应该优先 B（OCR 研究）— 那是"让 DocTalk 干竞品干不了的事"的起点
2. **C 的价值是否被高估**？文档同步是 hygiene task，如果代码还没怎么动（距 P1/P2 修复才 1 天），漂移风险低
3. **B 如果 3-4h 出不来有意义的结论会怎样**？OCR 厂商/方案很多，可能 benchmark 是走马观花
4. **有没有更高 ROI 的批次被漏掉**？
   - Beta testing plan（`.collab/plans/beta-testing-plan.md`）是否该启动？
   - Subscription change research 是否有可实施产出？
   - 技术债：还有没有 P2/P3 级别未修的已知问题？
5. **今日总工作量 6-9h 是否合理**？是否该收窄到 1 个批次，避免稀释 Codex 审阅精力

---

**交付物目标**：Codex 审阅后，输出 "今日/本周的 1-3 个定稿批次 + 明确 Done 标准"。
