# DocTalk 模型选择策略研究报告

> **研究日期**: 2026-02-10
> **研究方法**: 市场竞品分析 + 心理学/UX 科学 + 产品策略调研
> **核心问题**: DocTalk 是否应该给用户开放 LLM 模型选择下拉框？如果不是最佳方案，什么才是？

---

## Executive Summary

**结论：当前的 9 模型下拉框应该移除，替换为 "任务模式" 选择器。**

三条独立研究线索——竞品市场、认知心理学、产品策略——给出了高度一致的结论：

1. **市场信号**：DocTalk 的 9 模型下拉框在文档 AI 品类中是异类。8 个直接竞品中 6 个（ChatPDF、NotebookLM、Humata、Docalysis、LightPDF、AskYourPDF）完全不暴露模型选择。最成功的文档 AI 产品（NotebookLM，增长率 +57%）零模型选择。即使在通用 AI 聊天领域，ChatGPT 正在积极退役模型推 Auto，Sam Altman 公开表示 "讨厌模型选择器"。

2. **心理学证据**：9 个选项远超认知舒适区（研究指向 3-5 个为最佳）。~80% 的用户不会使用高级功能（SaaS Pareto 法则）。大多数用户是 satisficers（"够好就行"型），无法有效评估 Claude Sonnet 与 GPT-5.2 的区别——强迫他们选择只会制造焦虑，而非赋权。品牌锚定效应还会创造"期望陷阱"：选了最贵模型的用户对同样质量的回答反而更不满意。

3. **产品策略**：对于 RAG 文档问答产品，检索质量（chunking + embedding + top_k）对结果的影响远大于生成模型的差异。DocTalk 自己的 benchmark 显示，当提供相同上下文时，主流模型的表现差距在常规问题上并不大——只在复杂推理和否定案例上拉开。让用户自由选择昂贵模型还带来成本风险（Claude Opus 成本是 DeepSeek 的 10-30x）。

**推荐方案**：用 3 个任务模式（快速回答 / 均衡 / 深度分析）替代 9 个模型名称，将真正的模型选择下沉为高级设置中的 power user 逃生舱。

---

## 一、市场竞品分析

### 1.1 文档 AI 品类：模型选择几乎不存在

| 产品 | 用户可选模型？ | 备注 |
|---|---|---|
| **ChatPDF** | 否 | 后端用 GPT + Claude，完全不暴露 |
| **NotebookLM** (Google) | 否 | 固定 Gemini，最成功的文档 AI 产品 |
| **Humata** | 否 | 完全抽象模型层 |
| **AskYourPDF** | 否 | 付费解锁"高级 AI"但不选具体模型 |
| **Docalysis** | 否 | 简洁文档问答界面 |
| **LightPDF** | 否 | GPT-4 驱动，品牌化为 "LightPDF AI" |
| **Sharly.ai** | **是** | 付费解锁 GPT-4o/o1，套餐门控 |
| **Sider AI** | **是** | 定位为多模型聚合器，非纯文档工具 |

**结论**：6/8 不暴露模型选择。唯一暴露的两个要么是套餐门控（Sharly），要么定位就是多模型聚合器（Sider）。**DocTalk 的 9 模型下拉框在品类中没有先例。**

### 1.2 通用 AI 聊天：趋势是简化

| 产品 | 模型选择方式 | 趋势方向 |
|---|---|---|
| **ChatGPT** | Auto 默认，手动可选但正在缩减 | 2026/2/13 退役 5 个模型，CEO 公开反对模型选择器 |
| **Claude.ai** | 下拉选择 Opus/Sonnet/Haiku | 提供 opusplan 自动混合模式 |
| **Gemini** | @-mention 模式选择 (@Fast/@Thinking/@Pro) | 退役旧模型，整合为 Gemini 3 系列 |
| **Perplexity** | 免费=自动 "Best"，Pro=手动选择 | 模型选择是**付费功能** |
| **Kimi** | 模式选择（即时/思考/Agent/Agent Swarm） | 用行为模式替代模型名称 |
| **DeepSeek** | 模式选择（Chat/Reasoner） | 最简模型 UX |
| **Poe** | 数百模型全暴露 | 定位就是多模型市场，非典型 |

**行业趋势**：
- ChatGPT → 积极减少选项，推 Auto
- Kimi / DeepSeek → 模式选择替代模型选择
- Perplexity → 模型选择是付费特权
- 只有 Poe（多模型市场定位）反向加码模型数量

### 1.3 开发者工具：保留选择但默认 Auto

Cursor、GitHub Copilot、Windsurf、Cline 都提供模型选择——但开发者是最懂模型的用户群体。即使如此，Copilot 和 Cursor 都在推 Auto 默认，Copilot 明确说目标是减少 "选模型的心智负担"。

### 1.4 关键洞察

> **新兴行业模式："智能默认 + 专家逃生舱"**
>
> 1. 默认：智能自动路由（最佳模型匹配任务）
> 2. 可见但不突出：模式选择器（快速/深度），不是模型名称
> 3. 隐藏/高级：完整模型选择器，给需要的 power user
> 4. 套餐门控：高端模型锁在付费套餐后面

---

## 二、心理学与 UX 科学

### 2.1 选择悖论（Paradox of Choice）

**果酱实验**（Iyengar & Lepper, 2000）：提供 6 种果酱时购买率 30%，提供 24 种时仅 3%——选项多 4 倍，转化率低 10 倍。

**元分析的 nuance**（Scheibehenne et al., 2010）：在 50 项实验中，选择数量的平均效应接近零——但关键变量是**用户是否具备领域专业知识**。当用户懂这个领域时，更多选择不是问题；当用户不懂时，更多选择造成瘫痪。

**对 DocTalk 的含义**：绝大多数文档问答用户（研究员、律师、分析师）不具备 LLM 模型的专业知识。9 个模型选项对他们而言落入 "选择瘫痪" 区间。

### 2.2 决策疲劳

用户打开 DocTalk 的目标是**问文档问题**，不是评估 AI 模型。在用户开始核心任务之前强加一个他们无法有效做出的技术决策，是经典的 "无关认知负荷"（extraneous cognitive load）——它不促进任务完成，只消耗心智资源。

Nielsen Norman Group：过多选择导致挫败感上升、参与度下降、**放弃率上升**。

### 2.3 专业知识不对称

用户看到 "Claude Sonnet 4.5" 和 "Gemini 2.5 Flash" 时，他们能区分什么？几乎没有有意义的判断依据。这构成了 **extraneous cognitive load**——不贡献于任务完成的心智开销。NNg："添加对大多数用户价值很低的功能，会削弱用户的内在能力。"

### 2.4 控制感幻觉 vs 真实赋权

模型选择器确实给人一种 "我在掌控" 的感觉（illusion of control）。但 UX 研究区分了两种模式：
- **感知控制**（合法 UI 模式）：用户理解选择的含义
- **选择幻觉**（接近 dark pattern）：用户无法做出知情决策

如果用户选了一个模型，得到了不理想的回答，他们可能**怪自己选错了**（false accountability），而不是认识到 LLM 输出的固有变异性。这比不提供选择更糟糕。

### 2.5 信任感：谁来选更好？

研究表明，**"我们为你选了最好的" + 透明解释** 比 "你来选" 或 "不透明的默认" 都更能建立信任。

理想模式："我们使用 Claude Sonnet 4.5，它在文档问答引用准确度上表现最优"——提供信息但不强迫决策。对于新品牌（DocTalk），"我们是专家，我们帮你选好了" 比 "你自己选吧" 建立更多信任。

### 2.6 关键数据点

| 研究发现 | 数据 | 来源 |
|---|---|---|
| 功能使用率 | ~80% 的 SaaS 功能很少/从未使用 | Pendo |
| Power user 比例 | ~20% 的用户使用高级功能 | UserPilot |
| 默认效应 | ~50% 的用户从不更改默认值 | Default Effect 研究 |
| Satisficers 比例 | 60-70% 的人是 "够好就行" 型 | Schwartz |
| 最佳选项数 | 3-5 个 | 多项研究汇总 |
| Hick's Law | 决策时间随选项数对数增长 | Hick-Hyman |

### 2.7 心理学结论

**支持移除的证据（强）**：
- 80% 的用户不会有意义地使用它
- 大多数用户无法评估这个选择
- 9 个选项远超最佳区间
- 制造决策疲劳，在核心任务开始前就耗费心智
- 品牌锚定创造期望陷阱

**支持保留的证据（弱但重要）**：
- 20% 的 power user 看重它，且这群人影响力不成比例（写评测、推荐产品）
- 选择感增加 maximizer 型用户的满意度
- MIT Sloan 2024 研究：智能选择架构（非零选择也非无限选择）优于两个极端

**最佳模式**：**策划过的默认 + 渐进式披露 + 透明理由**

---

## 三、产品策略分析

### 3.1 替代方案对比

| 方案 | 描述 | 代表产品 | 适合 DocTalk？ |
|---|---|---|---|
| **智能路由** | 自动选最优模型 | OpenRouter Auto, ChatGPT Auto | 中——技术简单但调试困难 |
| **任务模式** | 快速/均衡/深度 替代模型名 | Kimi, DeepSeek, GPT-5.2 | **高——最佳方案** |
| **质量分级** | 标准 vs Pro 质量 | Perplexity Pro Search | 中——稍模糊 |
| **零选择** | 固定一个最优模型 | NotebookLM, ChatPDF | 高但失去 power user |
| **混合方案** | 默认 Auto + 高级设置模型选 | Perplexity, Cursor | **高——长期最佳** |

### 3.2 RAG 场景的特殊性

对于文档问答，**检索质量 > 生成模型选择**。

- DocTalk 的分块策略（150-300 tokens, top_k=8）、embedding 质量、向量搜索精度对最终答案的影响远大于用哪个 LLM 生成
- 当提供相同的检索上下文时，主流 frontier 模型在常规问题上的表现差距不大
- 差距主要出现在复杂推理和否定案例上（DocTalk benchmark：否定案例准确率所有模型都只有 38-62%）
- **含义**：对 80%+ 的常规问题，模型选择对用户体验的实际影响很小。用户以为他们在选 "更好的大脑"，实际上他们得到的答案质量主要取决于检索到的 chunks

### 3.3 成本风险分析

当前设计让所有用户（包括 Free tier）都能访问 Claude Opus——最贵的模型（成本是 DeepSeek 的 10-30x）。

| 模型 | 相对成本 | 引用准确度 | 当前访问控制 |
|---|---|---|---|
| DeepSeek V3.2 | 1x (基准) | ~90% | 所有人 |
| Claude Sonnet 4.5 | ~5x | ~97% | 所有人 |
| Claude Opus 4.6 | ~15x | 100% | Plus+ 用户 |
| GPT-5.2 | ~8x | ~95% | 所有人 |

Stripe 的 AI 定价框架建议 60-70% 毛利率。让 Free 用户自由选择 GPT-5.2（8x 成本）在固定 credit 费率下可能是负利润。

**建议**：实施模型感知的 credit 定价——Opus 扣 3x credits，DeepSeek 扣 0.5x credits——自然引导用户选择成本效率高的选项。

### 3.4 NotebookLM 案例研究

Google NotebookLM 是最接近 DocTalk 的竞品：
- 零模型选择，固定 Gemini
- Google 增长最快的 AI 产品（+57%）
- 成功原因：专注于 **source-grounded analysis**（源文档锚定分析），用户永远不会想到模型
- 启示：文档 AI 的用户关心的是**答案质量和引用准确度**，不是背后的模型品牌

---

## 四、推荐方案

### 4.1 三阶段实施路线

#### Phase 1: 任务模式替代模型名称（立即，低工作量）

**将 9 模型下拉框替换为 3 个任务模式：**

| 模式 | 用户看到的标签 | 后端映射 | 套餐访问 | Credit 消耗 |
|---|---|---|---|---|
| **Quick** | "快速回答" / "Quick" | DeepSeek V3.2 | 所有用户 | 0.5x |
| **Balanced** | "均衡" / "Balanced" (默认) | Claude Sonnet 4.5 | 所有用户 | 1x |
| **Thorough** | "深度分析" / "Deep Analysis" | Claude Opus 4.6 | Plus/Pro | 3x |

**UI 变化**：
- 当前位置的 ModelSelector 下拉框 → 3 段 pill/toggle 切换器
- 每个模式附带一行简短描述（速度 vs 精度权衡）
- "Thorough" 对 Free 用户显示锁标 + 升级 CTA
- 匿名 Demo 用户不显示模式选择器（保持当前行为，强制 DeepSeek）

**为什么这是最佳起点**：
- 从 9 个选项降到 3 个，符合心理学最佳区间
- 用户按意图选择（快/好/精），不需要模型知识
- 自然的套餐升级钩子（深度分析 = Plus+）
- 后端改动极小——只是模式名 → 模型 ID 的映射
- 成本可控——用 credit 倍率反映真实 API 成本

#### Phase 2: 智能默认（中等工作量）

**在 "均衡" 模式中加入 Auto 路由：**
- 简短事实性问题 → 自动路由到 DeepSeek（快、便宜）
- 复杂分析性问题 → 自动路由到 Claude Sonnet（质量）
- 用户仍可手动切换到 "Quick" 或 "Thorough"
- 实现方式：利用 OpenRouter Auto Router + plugin 限制，零额外成本

#### Phase 3: Power User 逃生舱（长期）

**将完整模型选择器移到设置/高级区域：**
- 主 UI：只显示 3 模式切换器
- "+" 菜单 → 新增 "Model Settings" 选项
- 设置页内：可切换到"手动模型选择"模式，显示完整 9 模型列表
- 仅 Plus/Pro 用户可见
- 保留对 power user 和 AI 爱好者的吸引力

### 4.2 风险分析

| 风险 | 可能性 | 影响 | 缓解措施 |
|---|---|---|---|
| Power user 反对简化 | 中 | 中 | Phase 3 逃生舱 + 设置中保留完整选择 |
| "Quick" 模式质量不达预期 | 低 | 高 | DeepSeek 在简单问题上表现足够好；可 A/B 测试 |
| 模式标签理解歧义 | 低 | 低 | 附带简短描述 + 可迭代优化 |
| 竞品用模型选择差异化 | 低 | 低 | 仅 Anara 这样做，非主流趋势 |
| Credit 倍率定价复杂度 | 中 | 低 | 在模式选择器旁显示 credit 成本 |

### 4.3 成功指标

实施后跟踪：
1. **模式使用分布**：预期 Balanced 占 60%+，Quick 25%，Thorough 15%
2. **平均每查询成本**：应该下降（自然引导到成本效率选项）
3. **Free → Plus 转化率**：Deep Analysis 门控应提升转化
4. **每会话消息数**：简化 UX 应增加参与度
5. **引用准确度**：确保无质量回退
6. **选择器交互率**：对比当前 ModelSelector 的使用率

---

## 五、总结：一句话回答

> **给用户选模型弊大于利。80% 的用户不懂这个选择，20% 的 power user 可以通过高级设置满足。最佳方案是用 3 个任务模式（快速/均衡/深度）替代 9 个模型名称——既降低认知负荷，又保留升级钩子和成本控制能力。**

这不是 DocTalk 独有的结论——整个行业都在朝这个方向走。ChatGPT 在退役模型，Perplexity 把模型选择锁在付费后面，NotebookLM 完全不暴露模型。DocTalk 的 9 模型下拉框不是"给用户更多选择"的先进功能——它是一个行业已经在离开的 UX 模式。

---

## 参考资料

### 市场调研
- ChatPDF, AskYourPDF, Humata, NotebookLM, Sharly.ai, Sider AI 产品调研
- ChatGPT model picker 变更 (2025-2026), Sam Altman 公开声明
- Perplexity Pro/Max 文档, Kimi 模式系统, DeepSeek Chat/Reasoner
- Cursor Auto Mode, GitHub Copilot Auto, Windsurf, Cline
- IDC: 70% of top AI enterprises will use model routing by 2028

### 心理学与 UX
- Iyengar & Lepper (2000) — 果酱实验
- Scheibehenne et al. (2010) — 选择悖论元分析
- Schwartz — Satisficers vs Maximizers
- Hick-Hyman Law — 决策时间与选项数
- Nielsen Norman Group — Progressive Disclosure, Simplicity vs Choice
- MIT Sloan Management Review (2024) — Intelligent Choice Architectures
- Default Effect 研究 — 50%+ 用户不改默认值
- Pendo — 80% SaaS 功能未使用

### 产品策略
- OpenRouter Auto Router 文档
- Stripe — AI 产品定价框架 (60-70% 毛利率建议)
- NotebookLM 增长数据 (+57%)
- Anara vs NotebookLM 对比
- a16z — State of Consumer AI 2025
- DocTalk 内部 RAG benchmark 数据 (432 runs, 48 cases x 9 models)
