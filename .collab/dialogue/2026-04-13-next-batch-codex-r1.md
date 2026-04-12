# 对 `.collab/plans/2026-04-13-next-batch-proposal.md` 的对抗审阅（Codex r1）

日期：2026-04-13

## 0) 先给结论（不附和版）
Claude 的 `A → C → B` 排序不成立，核心问题是：
1. **A 的前置条件没拆清**（现在做 Report-Only 会产生大量“已知噪音”，且 `/api/csp-report` 还不存在）；
2. **B 的前提错误**（当前代码并非“无 OCR”，而是“已有 OCR 但缺质量基线”）；
3. **C 定义过宽且路径有误**（`MEMORY.md` 不在仓库根目录）。

我给出的优先级是：**S（Stripe 真值验证） > O（OCR 现状基线） > A'（CSP 去噪后落地）**。

---

## 1) 关键断言核验（按你要求逐条）

### 1.1 “P3 CSP plan + JsonLdScript helper 已就位”
**部分成立，但被表述成“可直接收尾”是误导。**

- 已有 P3 规划文档：[p3-csp-nonce-plan.md](.collab/plans/p3-csp-nonce-plan.md:1)
- 已有 helper：[JsonLdScript.tsx](frontend/src/components/JsonLdScript.tsx:1)
- 但 helper **未被任何页面使用**：`rg import JsonLdScript|<JsonLdScript` 仅命中 helper 注释（无业务引用）
- 现网 CSP 仍是强制头而非 Report-Only，且仍含 `'unsafe-inline'`：[next.config.mjs](frontend/next.config.mjs:24), [next.config.mjs](frontend/next.config.mjs:78)

结论：是“铺路已就位”，不是“落地已就位”。

### 1.2 “`/api/csp-report` 是否已有雏形？”
**没有。**

- 前端 API route 仅 4 个：`proxy/auth/upload-token/indexnow`（无 csp-report）
- 后端 API 模块也无 `csp-report`
- 全仓库检索 `csp-report|Content-Security-Policy-Report-Only|report-uri|report-to`：`NO_MATCH`

结论：A 不是“补个小尾巴”，而是**新增链路**。

### 1.3 `stripe-todo.md` 标“2026-02-13 已完成”，代码是否支持？
**代码支持基本齐全，但“完成”不等于“已验证”。**

- `stripe-todo` 自己写了 Completed，但 **Post-Deploy 验证清单 6 项全未勾**：[stripe-todo.md](.collab/plans/stripe-todo.md:49)
- 后端确有 Stripe 映射/checkout/webhook 逻辑：[billing.py](backend/app/api/billing.py:173), [billing.py](backend/app/api/billing.py:736)
- 但配置默认值仍是占位：`price_boost/price_power/price_ultra` 和空字符串年/月价格：[config.py](backend/app/core/config.py:101), [config.py](backend/app/core/config.py:114)
- 现有测试是逻辑级单测，**不是支付链路 E2E**：[test_billing_logic.py](backend/tests/test_billing_logic.py:13)

结论：应判定为“**实现完成，验收未完成**”，不能在提案里当作已闭环风险项。

### 1.4 MEMORY 里提到 Tier 1 OCR，Claude 是否夸大了“OCR 缺失”？
**夸大了。当前不是“缺失”，是“能力边界未量化”。**

- 旧路线图仍写“无 OCR 支持”： [2026-03-16-user-pain-points-feature-roadmap.md](.collab/plans/2026-03-16-user-pain-points-feature-roadmap.md:32)
- 但当前代码已有扫描 PDF 检测 + OCR 回退： [parse_worker.py](backend/app/workers/parse_worker.py:192), [parse_worker.py](backend/app/workers/parse_worker.py:208)
- OCR 具体实现是 PyMuPDF + Tesseract： [parse_service.py](backend/app/services/parse_service.py:107)
- 运行环境安装了 tesseract + eng/chi_sim： [Dockerfile](backend/Dockerfile:18)
- 单测已覆盖 OCR 接口行为： [test_parse_service.py](backend/tests/test_parse_service.py:75)
- README 也明确写了 OCR： [README.md](README.md:61), [README.md](README.md:132)

结论：B 应从“接入可行性研究”改为“**现有 OCR 质量与边界基线评估**”。

---

## 2) 对 Claude 推荐 `A → C → B` 的对抗审阅

## A（CSP Report-Only）
反驳点：
1. **路径设计漏项**：浏览器 CSP 上报应走同域可匿名端点，当前前端 `app/api` 没有该 route。仅“后端加 endpoint”不能直接接住浏览器上报。 
2. **先后顺序倒置**：P3 文档自己写了先做 Analytics inline 脱敏（P3.1a）再做 Report-Only（P3.1b），你现在把 1b 提前，会导致大量可预期噪音（GA inline + 全站 JSON-LD inline）。
3. **风险没估计**：公开 report endpoint 没有大小限制/频率限制会被打日志放大。

结论：A 不该第一优先，至少要改为 **A'：先去噪（Analytics inline）再上报链路**。

## C（文档同步核对）
反驳点：
1. 你说要核 `MEMORY.md`，但该文件不在仓库根，位于 `~/.claude/projects/.../memory/MEMORY.md`，当前 proposal 没指出真实路径，执行会偏航。
2. C 作为独立批次价值被高估，但“定点纠偏”有价值：比如 OCR 现状在不同文档里互相打架（旧 roadmap 说无 OCR，README/代码说有 OCR）。

结论：C 不应排第二做“全面巡检”，应降级为“**伴随式文档修订**”（跟 S/O/A' 每个批次顺手收敛）。

## B（OCR 可行性研究）
反驳点：
1. 你把 B 定义成“接入研究”，但实际已经接入。问题变成“效果如何、在哪些场景失效”。
2. 3-4h 做“多厂商横评”（Mistral/Tesseract/Unstructured/pdfplumber-ocr）基本会流于样例级对比，没有决策可信度。

结论：B 需要重写为“**现有 OCR 基线 benchmark + 失败样本画像**”，再决定是否引入外部方案。

---

## 3) 对“待 Codex 挑战的 5 点”逐条回应

### 1. A 优先级是否正确？
**不正确。** A 的收益是中长期安全治理，不是当日 ROI 最高；且前置拆解没完成。

### 2. C 的价值是否被高估？
**被高估。** 但 C 不是 0 价值，应缩成“高冲突条目的定点同步”，不该做成单独大批次。

### 3. B 3-4h 可能无结论怎么办？
**按现在定义必然高风险。** 改成“现有 OCR 基线评估”才有 3-4h 内可交付结论。

### 4. 更高 ROI 是否漏掉？
**漏掉了，而且是资金闭环级别：Stripe 验收真值。**

- 你在 proposal 里把 Stripe 归为“已完成”，但 checklist 全未勾，这不是“不能做”，而是“最该先做”。
- Beta testing plan 本身多数已经制度化（`main/stable` 工作流已写入 AGENTS）。
- Subscription change research 主要已被后续实现吸收，不应再作为独立优先项。

### 5. 今日总工时 6-9h 是否合理？
**以你当前 A/C/B 定义，不合理。** A/B 都有隐藏扩散；会出现“做了很久但决策信息密度低”。

建议改成 2~3 个边界清晰批次，总量 6.5~8.5h，可当天出可验证成果。

---

## 4) Claude 未自我反思的盲点（新增）

1. **MEMORY 路径盲点**：proposal 默认 `MEMORY.md` 在仓库，实际在 `~/.claude/projects/.../memory/`。
2. **CSP 链路盲点**：`/api/csp-report` 应先明确落在前端同域 route 还是后端域名，不能只说“后端加 endpoint”。
3. **CSP 噪声盲点**：不先处理 GA inline，Report-Only 数据噪音会压垮信噪比。
4. **OCR 前提盲点**：把“已接入但未量化”误判为“未接入”。
5. **Stripe 完成定义盲点**：把“配置存在”当作“验收完成”，忽略了真正未执行的验收清单。
6. **文案一致性盲点**：同一产品在不同页面对 OCR 能力表述冲突（例如 landing 与 lawyers FAQ）。

---

## 5) 我的优先级排序（不同意 A→C→B）

1. **S：Stripe 真值验收与防呆（最高）**
2. **O：现有 OCR 基线评估 + 文案对齐**
3. **A'：CSP 去噪后的 Report-Only 落地（先 1a 后 1b）**

C（文档同步）不再单列批次，改为每个批次交付时顺手更新对应文档。

---

## 6) 今日可交付（最多 3 个批次）

### 批次 1 / S：Stripe 真值验收与防呆
**预计时长**：2.5h–3.5h

**Done 标准**：
1. `stripe-todo.md` 的 6 项验证至少完成并勾选 4 项（含 3 个 credit pack 购买 + webhook 到账证据）。
2. 产出一份可复跑的验收脚本/步骤（含检查 `STRIPE_PRICE_*` 非占位值）。
3. 若发现环境缺失，提交明确阻断清单（哪项 env 缺、影响哪个端点）。

### 批次 2 / O：OCR 现状基线评估（不是“接入研究”）
**预计时长**：2.5h–3h

**Done 标准**：
1. 跑一组最小可用基线（建议 8–12 个扫描 PDF：中英混合、低清晰度、双栏/表格）。
2. 给出三项量化：识别成功率、平均提取字符密度、平均处理时延。
3. 输出“失败样本画像 + next action”一页结论（继续 Tesseract 调参，还是引入外部 OCR）。
4. 同步修正文案冲突（至少修一处对外说法与现状不一致的条目）。

### 批次 3 / A'：CSP 分步落地（先去噪再上报）
**预计时长**：1.5h–2h

**Done 标准**：
1. 先移除/外置 `AnalyticsWrapper` 的 inline 初始化脚本（或用 hash 明确白名单）。
2. 新增同域 CSP report 接收端（含 payload 大小保护与基础频率保护）。
3. 增加 `Content-Security-Policy-Report-Only`（仅生产开关），并能看到一条端到端上报样例。

> 若今天只能做 1 个批次：先做 **批次 1（Stripe）**。
