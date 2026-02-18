# DocTalk 模型选择综合研究报告

> **研究日期**: 2026-02-10
> **研究范围**: 市场竞品分析 + 心理学/UX 科学 + 产品策略 + 14 模型 RAG 性能 Benchmark + OpenRouter 定价/路由
> **核心问题**: DocTalk 应该如何让用户选择 LLM 模型？最优的三模式配置是什么？

---

## Executive Summary

**结论：将 9 模型下拉框替换为 3 个任务模式，背后映射经过 Benchmark 验证的最优模型。**

基于市场调研、认知心理学和 14 模型全量 Benchmark 的综合分析，推荐以下三模式配置：

| 模式 | 主模型 | 成本/查询 | 预期 TTFT | 套餐限制 | Credit 倍率 |
|---|---|---|---|---|---|
| **Quick** 快速回答 | DeepSeek V3.2 | $0.0007 | ~2s | 所有用户 | 0.5x |
| **Balanced** 均衡 (默认) | **Mistral Medium 3.1** | ~$0.002 | ~1.7s | 所有用户 | 1x |
| **Thorough** 深度分析 | **Mistral Large 2512** | ~$0.002 | ~1.6s | Plus / Pro | 3x |

**相比初始提案的变更：**
- **Balanced**: Qwen3-235B -> **Mistral Medium 3.1** -- Benchmark 验证后，Mistral Medium 3.1 在引用准确率（100% vs 96%）和语言合规率（100% vs 98%）上全面超越 Qwen3，TTFT 快 4 倍（1.7s vs 7s），LLM-as-judge 综合评分接近（3.59 vs 3.62）
- **Thorough**: GPT-5.2 -> **Mistral Large 2512** -- Mistral Large 2512 引用/语言 100%/100%（vs GPT-5.2 的 100%/94%），TTFT 快 2.5 倍（1.6s vs 4s），judge 综合评分高 16%（3.49 vs 3.02），成本低约 5 倍（~$0.002 vs $0.0105）

**相比当前方案（Claude Sonnet 4.5 全量，$0.0135/查询）**：
- Quick 模式节省 **~20x** 成本
- Balanced 模式节省 **~7x** 成本
- Thorough 模式节省 **~7x** 成本
- 假设流量分布 70% Quick / 25% Balanced / 5% Thorough，**加权平均成本降低约 14x**

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
- ChatGPT -> 积极减少选项，推 Auto
- Kimi / DeepSeek -> 模式选择替代模型选择
- Perplexity -> 模型选择是付费特权
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
- 差距主要出现在复杂推理和否定案例上（DocTalk benchmark：否定案例准确率所有模型都只有 38-88%）
- **含义**：对 80%+ 的常规问题，模型选择对用户体验的实际影响很小。用户以为他们在选 "更好的大脑"，实际上他们得到的答案质量主要取决于检索到的 chunks

### 3.3 成本风险分析

当前设计让所有用户（包括 Free tier）都能访问 Claude Opus——最贵的模型（成本是 DeepSeek 的 10-30x）。

| 模型 | 相对成本 | 引用准确度 | 当前访问控制 |
|---|---|---|---|
| DeepSeek V3.2 | 1x (基准) | 100% | 所有人 |
| Claude Sonnet 4.5 | ~5x | ~98% | 所有人 |
| Claude Opus 4.6 | ~15x | 100% | Plus+ 用户 |
| GPT-5.2 | ~8x | 100% | 所有人 |

Stripe 的 AI 定价框架建议 60-70% 毛利率。让 Free 用户自由选择 GPT-5.2（8x 成本）在固定 credit 费率下可能是负利润。

**建议**：实施模型感知的 credit 定价——通过模式绑定 credit 倍率，自然引导用户选择成本效率高的选项。

### 3.4 NotebookLM 案例研究

Google NotebookLM 是最接近 DocTalk 的竞品：
- 零模型选择，固定 Gemini
- Google 增长最快的 AI 产品（+57%）
- 成功原因：专注于 **source-grounded analysis**（源文档锚定分析），用户永远不会想到模型
- 启示：文档 AI 的用户关心的是**答案质量和引用准确度**，不是背后的模型品牌

---

## 四、完整 Benchmark 结果

### 4.1 自动化评估指标（17 模型全量测试）

48 个测试用例（10 类别 x 3 文档），每模型 48 次运行。

| 模型 | Cite% | Lang% | Neg% | KW% | Avg TTFT | MD | Err% |
|---|---|---|---|---|---|---|---|
| **Claude Opus 4.6** | 100 | 100 | 88 | 78 | 2613ms | 6.0 | 0% |
| **Mistral Medium 3.1** | 100 | 100 | 88 | 76 | 1722ms | 6.0 | 2.1% |
| **Mistral Large 2512** | 100 | 100 | 88 | 76 | 1635ms | 5.1 | 2.1% |
| Claude Sonnet 4.5 | 100 | 98 | 88 | 74 | 2014ms | 5.2 | 0% |
| **DeepSeek V3.2** | 100 | 100 | 88 | 73 | 2078ms | 4.7 | 0% |
| **GLM-5** *(new)* | 98 | 100 | **100** | 72 | 18393ms | 4.8 | 0% |
| **MiniMax M2.5** *(new)* | 98 | 100 | 88 | **74** | 12869ms | 5.2 | 0% |
| Gemini 3 Flash | 100 | 94 | 86 | 74 | 6496ms | 5.2 | 4.2% |
| GPT-5.2 | 100 | 94 | 75 | 69 | 3983ms | 4.3 | 0% |
| Grok 4.1 Fast | 100 | 94 | 75 | 70 | 9495ms | 5.8 | 2.1% |
| Mistral Medium 3 | 98 | 98 | 100 | 68 | 876ms | 4.2 | 0% |
| **Qwen3.5-397B** *(new)* | 96 | 96 | **100** | 70 | 8977ms | 4.9 | 0% |
| Seed 1.6 | 96 | 98 | 100 | 67 | 14946ms | 3.0 | 0% |
| Qwen3-235B | 96 | 98 | 88 | 70 | 7005ms | 4.1 | 0% |
| MiniMax M2.1 | 98 | 96 | 63 | 68 | 8469ms | 5.2 | 4.2% |
| Kimi K2.5 | 85 | 81 | 88 | 65 | 19538ms | 4.2 | 0% |
| Gemini 3 Pro | 96 | 92 | 75 | 69 | 15778ms | 4.3 | 2.1% |

**指标说明**：
- **Cite%**: 引用准确率——回答中是否正确使用 `[n]` 引用标记
- **Lang%**: 语言合规率——回答语言是否匹配用户提问语言
- **Neg%**: 否定案例准确率——当文档中没有相关信息时，是否正确回复 "信息不在文档中"
- **KW%**: 关键词覆盖率——回答中包含了多少预期关键词
- **Avg TTFT**: 平均首 token 延迟（毫秒）
- **MD**: Markdown 格式质量评分（1-6）
- **Err%**: 运行错误率（超时/API 错误等）

### 4.2 LLM-as-Judge 综合评分

使用 LLM 评审员对回答质量进行多维度综合打分（满分 5.0）：

| 模型 | 综合评分 |
|---|---|
| DeepSeek V3.2 | **3.89** |
| Qwen3-235B | 3.62 |
| **Mistral Medium 3.1** | **3.59** |
| **Mistral Large 2512** | **3.49** |
| Seed 1.6 | 3.36 |
| Mistral Medium 3 | 3.17 |
| GPT-5.2 | 3.02 |

### 4.3 关键发现

1. **Mistral Medium 3.1 和 Mistral Large 2512 是 Benchmark 中的惊喜**：两者都达到了 100% 引用准确率和 100% 语言合规率（此前只有 Claude Opus 和 DeepSeek V3.2 做到），且 TTFT 极快（1.6-1.7s），是所有 100% cite/lang 模型中最快的
2. **Qwen3-235B 未达预期**：虽然 judge 综合评分（3.62）略高于 Mistral Medium 3.1（3.59），但引用准确率仅 96%、语言合规 98%，且 TTFT 高达 7s——不适合作为 Balanced 默认模型
3. **GPT-5.2 被 Mistral Large 2512 全面超越**：GPT-5.2 语言合规仅 94%，judge 评分 3.02（最低），TTFT 4s，成本 $0.0105/查询——Mistral Large 2512 在所有维度上更优且成本低 5 倍
4. **DeepSeek V3.2 依然是 Quick 模式的最佳选择**：100% cite/lang，judge 最高分 3.89，成本最低档之一，且已经过 DocTalk 数月实战验证

### 4.4 2026-02-17 新模型补测结果

使用 Direct OpenRouter 方式（绕过 DocTalk 后端，保证所有模型看到完全相同的 chunks）对 3 个新模型进行了 48 用例全量测试。

#### GLM-5 (z-ai/glm-5) — 744B MoE / 44B 激活

| 维度 | 数据 | 评价 |
|---|---|---|
| 引用准确率 | 98% | 好——接近顶尖水平 |
| 语言合规率 | **100%** | 优秀——多语言表现完美 |
| 否定案例 | **100%** | 最佳——完美识别文档外问题 |
| 关键词覆盖 | 72% | 中——略低于 Mistral 系列 |
| Avg TTFT | 18393ms | 差——首 token 延迟过长 |
| P95 TTFT | 49225ms | 极差——尾部延迟近 50 秒 |
| MD 格式 | 4.8 | 中 |
| 错误率 | 0% | 好——零错误 |

**总结**：GLM-5 在否定案例准确率和语言合规方面表现突出（双 100%），0% 错误率，但 **TTFT 极慢（18.4s avg / 49s P95）**——对用户体验影响严重，不适合任何需要实时交互的场景。可考虑作为离线分析或批量评估的备选。

#### MiniMax M2.5 (minimax/minimax-m2.5) — M2.1 的继任者

| 维度 | 数据 | vs M2.1 |
|---|---|---|
| 引用准确率 | 98% | 持平 (98%) |
| 语言合规率 | **100%** | **提升** (96% → 100%) |
| 否定案例 | 88% | **大幅提升** (63% → 88%) |
| 关键词覆盖 | **74%** | **提升** (68% → 74%) |
| Avg TTFT | 12869ms | 慢于 M2.1 (8469ms) |
| P95 TTFT | 47523ms | 慢于 M2.1 |
| MD 格式 | 5.2 | 持平 (5.2) |
| 错误率 | **0%** | **提升** (4.2% → 0%) |

**总结**：MiniMax M2.5 相比 M2.1 在语言合规（100%）、否定案例（+25%）、关键词覆盖（+6%）和错误率（0%）方面全面提升。但 TTFT 从 8.5s 恶化到 12.9s（avg），P95 高达 47s。作为 Balanced/Thorough 的 fallback 可考虑，但不适合作为默认模型。

#### Qwen3.5-397B-A17B (qwen/qwen3.5-397b-a17b) — Qwen3 系列最新旗舰

| 维度 | 数据 | vs Qwen3-235B |
|---|---|---|
| 引用准确率 | 96% | 持平 (96%) |
| 语言合规率 | 96% | **下降** (98% → 96%) |
| 否定案例 | **100%** | **提升** (88% → 100%) |
| 关键词覆盖 | 70% | 持平 (70%) |
| Avg TTFT | 8977ms | 略慢 (7005ms) |
| P50 TTFT | **918ms** | 快（中位数很低但尾部极长） |
| P95 TTFT | 35263ms | 尾部延迟大 |
| MD 格式 | 4.9 | **提升** (4.1 → 4.9) |
| 错误率 | 0% | 持平 (0%) |

**总结**：Qwen3.5 延续了 Qwen3 系列的特点——否定案例完美但引用/语言合规不达标（双 96%）。TTFT 分布两极化：P50 仅 918ms（很快）但 P95 高达 35s，这说明模型在简单问题上响应极快但复杂推理时会陷入长时间思考。**引用和语言合规 96% 仍不满足 Balanced 模式 ≥98% 的部署标准**，且未超越同系列 Qwen3-235B。

#### 新模型对当前三模式配置的影响

**结论：三模式配置无需变更。**

| 模式 | 当前模型 | 新模型能否替代？ |
|---|---|---|
| Quick | DeepSeek V3.2 | 否——三个新模型的 TTFT 都太慢 |
| Balanced | Mistral Medium 3.1 | 否——MiniMax M2.5 最接近但引用 98% < 100%，且 TTFT 12.9s |
| Thorough | Mistral Large 2512 | 否——GLM-5 否定 100% 突出但 TTFT 18.4s 不可接受 |

**潜在用途**：
- **GLM-5**：如果延迟不敏感的批量/离线场景需要最高否定准确率，GLM-5（100% neg + 100% lang）值得考虑
- **MiniMax M2.5**：作为 Mistral Medium 3.1 的 fallback 链候选（0% 错误率、100% 语言合规），优于原来的 MiniMax M2.1

---

## 五、更新后的最终推荐

### 5.1 三模式配置

```
+-------------+--------------+------------------+---------------------+
|             |   Quick      |  Balanced        |    Thorough         |
|             |   快速回答     |  均衡 (默认)      |    深度分析          |
+-------------+--------------+------------------+---------------------+
| 主模型       | DeepSeek     | Mistral          | Mistral             |
|             | V3.2         | Medium 3.1       | Large 2512          |
+-------------+--------------+------------------+---------------------+
| 成本/查询    | $0.0007      | ~$0.002          | ~$0.002             |
+-------------+--------------+------------------+---------------------+
| Credit 倍率  | 0.5x         | 1x (默认)        | 3x                  |
+-------------+--------------+------------------+---------------------+
| 套餐限制     | 所有用户      | 所有用户          | Plus / Pro          |
+-------------+--------------+------------------+---------------------+
| 预期 TTFT    | ~2s          | ~1.7s            | ~1.6s               |
+-------------+--------------+------------------+---------------------+
| Cite%       | 100          | 100              | 100                 |
+-------------+--------------+------------------+---------------------+
| Lang%       | 100          | 100              | 100                 |
+-------------+--------------+------------------+---------------------+
| Judge Score | 3.89         | 3.59             | 3.49                |
+-------------+--------------+------------------+---------------------+
| 最适场景     | 简单事实查找   | 日常文档问答       | 复杂分析/推理/报告    |
|             | 快速验证      | 多语言需求         | 高准确度需求          |
+-------------+--------------+------------------+---------------------+
```

### 5.2 为什么做出这些变更

#### Balanced: Qwen3-235B -> Mistral Medium 3.1

| 维度 | Qwen3-235B | Mistral Medium 3.1 | 胜出 |
|---|---|---|---|
| 引用准确率 | 96% | **100%** | Mistral |
| 语言合规率 | 98% | **100%** | Mistral |
| 否定案例 | 88% | 88% | 平局 |
| 关键词覆盖 | 70% | **76%** | Mistral |
| TTFT | 7005ms | **1722ms** (4x 更快) | Mistral |
| MD 格式 | 4.1 | **6.0** | Mistral |
| Judge 综合分 | **3.62** | 3.59 | Qwen3 (微弱) |
| 错误率 | 0% | 2.1% | Qwen3 |

**决定性因素**：100% 引用/语言合规是文档问答产品的硬性要求。Qwen3 的 96% 引用率意味着每 25 次回答中约有 1 次引用缺失，这对用户信任的伤害远大于 judge 评分 0.03 的差距。加上 4 倍的速度优势，Mistral Medium 3.1 是更可靠的 Balanced 默认模型。

#### Thorough: GPT-5.2 -> Mistral Large 2512

| 维度 | GPT-5.2 | Mistral Large 2512 | 胜出 |
|---|---|---|---|
| 引用准确率 | 100% | 100% | 平局 |
| 语言合规率 | 94% | **100%** | Mistral |
| 否定案例 | 75% | **88%** | Mistral |
| 关键词覆盖 | 69% | **76%** | Mistral |
| TTFT | 3983ms | **1635ms** (2.5x 更快) | Mistral |
| MD 格式 | 4.3 | **5.1** | Mistral |
| Judge 综合分 | 3.02 | **3.49** (+16%) | Mistral |
| 错误率 | 0% | 2.1% | GPT-5.2 |
| 成本/查询 | $0.0105 | **~$0.002** (~5x 更便宜) | Mistral |

**决定性因素**：Mistral Large 2512 在几乎所有维度上超越 GPT-5.2——语言合规 100% vs 94%，否定准确率 88% vs 75%，judge 评分高 16%，TTFT 快 2.5 倍，成本低约 5 倍。GPT-5.2 唯一的优势是 0% 错误率（vs 2.1%），但这可以通过 fallback 机制缓解。

### 5.3 匿名 Demo 用户

- 强制使用 Quick 模式（DeepSeek V3.2），不显示模式选择器
- 与当前行为一致（`DEMO_LLM_MODEL = deepseek/deepseek-v3.2`）

---

## 六、排除与跳过的模型（附理由）

| 模型 | 排除原因 |
|---|---|
| **Claude Opus / Sonnet** | 用户要求排除所有 Anthropic 模型（三模式旨在使用非 Claude 模型） |
| **DeepSeek R1** | 推理模型幻觉率 11.3%（是 V3 的 2 倍），推理延迟大，RAG 场景下过度设计 |
| **Llama 4 Maverick** | Benchmark 造假争议，公开版实际表现低于预期，幻觉率 8.2% 偏高 |
| **Phi-4** | 仅支持英语，16K 上下文窗口太小，不适合 11 语言的 DocTalk |
| **Cohere Command A（via OpenRouter）** | 原生引用机制只能通过 Cohere 自有 API 使用，经 OpenRouter 调用失去核心优势，且价格 $10/M output 偏贵 |
| **OpenAI o3 / o4-mini** | 推理模型，RAG 场景过度设计，o3 成本 $40/M output 不合理，o4-mini 即将退役 |
| **GPT-4.1** | 正在被 OpenAI 退役，不适合新集成 |
| **Kimi K2.5** | DocTalk benchmark 最差：85% 引用、81% 语言、19.5s TTFT |
| **MiniMax M2.1** | 63% 否定案例准确率太差，引用 98% 且错误率 4.2% |
| **Gemini 3 Flash** | 91% 幻觉率（Omniscience benchmark），否定准确率 86% 但语言合规仅 94%，错误率 4.2%——对专业文档问答风险太高 |
| **Gemini 3 Pro** | 96% 引用、92% 语言、15.8s TTFT——各维度都不突出，且 TTFT 过慢 |
| **Seed 1.6** | 96% 引用、14.9s TTFT——速度太慢，MD 格式质量最差（3.0） |
| **Grok 4.1 Fast** | 94% 语言合规、9.5s TTFT——"Fast" 名不副实，且语言合规不达标 |
| **Qwen3-235B** | 96% 引用、98% 语言、7s TTFT——被 Mistral Medium 3.1 在所有关键维度超越 |
| **GPT-5.2** | 94% 语言合规、judge 最低分 3.02——被 Mistral Large 2512 全面超越 |
| **Mistral Medium 3** | 98% 引用（差 2%）、judge 3.17——被同系列 Medium 3.1 升级替代 |

---

## 七、实施路线

### Phase 1: 后端配置更新（立即）

1. 更新 `config.py`：
   - `ALLOWED_MODELS` 缩减为 3 个主模型 + fallback
   - 新增 `MODE_MODELS` 映射：`{"quick": [...], "balanced": [...], "thorough": [...]}`
   - 新增 `MODE_CREDIT_MULTIPLIER`：`{"quick": 0.5, "balanced": 1.0, "thorough": 3.0}`
   - `PREMIUM_MODES = ["thorough"]`（替代 `PREMIUM_MODELS`）
2. 更新 `model_profiles.py`：为 Mistral Medium 3.1 和 Mistral Large 2512 添加/更新 profile
3. 更新 `chat_service.py`：接受 `mode` 参数而非 `model` 参数，内部映射到具体模型
4. 更新 `credit_service.py`：按 mode 计算 credit 消耗

Fallback 配置（通过 OpenRouter `models` 数组实现自动故障转移）：

```json
{
  "quick": {
    "models": ["deepseek/deepseek-v3.2", "qwen/qwen3-30b-a3b"],
    "provider": { "sort": "latency" }
  },
  "balanced": {
    "models": ["mistralai/mistral-medium-3.1", "mistralai/mistral-medium-3"],
    "provider": { "sort": "throughput" }
  },
  "thorough": {
    "models": ["mistralai/mistral-large-2512", "openai/gpt-5.2"],
    "provider": { "sort": "throughput" }
  }
}
```

### Phase 2: 前端更新

1. `ModelSelector.tsx` -> `ModeSelector.tsx`：3 段 pill 切换器
2. 每个模式显示简短描述：
   - Quick: "Fast answers, great for simple lookups"
   - Balanced: "Best quality-to-speed ratio" (默认选中)
   - Thorough: "Deep analysis with maximum accuracy" (Plus/Pro 锁标)
3. 更新 `models.ts`：从模型列表改为模式定义
4. 匿名 Demo 用户：隐藏模式选择器

**UI 变化**：
- 当前位置的 ModelSelector 下拉框 -> 3 段 pill/toggle 切换器
- 每个模式附带一行简短描述（速度 vs 精度权衡）
- "Thorough" 对 Free 用户显示锁标 + 升级 CTA
- 匿名 Demo 用户不显示模式选择器（保持当前行为，强制 DeepSeek）

### Phase 3: 智能默认 + Power User 逃生舱（长期）

1. 在 "均衡" 模式中加入 Auto 路由：简短问题 -> Quick，复杂问题 -> Thorough
2. Settings/高级中保留完整模型选择器（仅 Plus/Pro）
3. 允许 power user 覆盖模式的默认模型映射

---

## 八、风险分析

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Mistral Medium 3.1 OpenRouter 可用性不稳定 | 低 | 中 | Mistral Medium 3 作为 fallback |
| Mistral Large 2512 价格上涨 | 低 | 低 | GPT-5.2 作为 fallback |
| 2.1% 错误率影响用户体验 | 中 | 中 | Fallback 链自动切换 + 重试逻辑 |
| 用户抱怨失去模型选择自由 | 中 | 低 | Phase 3 高级设置逃生舱 |
| 新模型需要新 prompt style | 高 | 中 | Benchmark 先行，必要时创建新 prompt style |
| Quick/Balanced 模式质量差异不够明显 | 中 | 低 | UI 强调分析深度差异而非速度差异 |
| Power user 反对简化 | 中 | 中 | Phase 3 逃生舱 + 设置中保留完整选择 |

### 成功指标

实施后跟踪：
1. **模式使用分布**：预期 Balanced 占 60%+，Quick 25%，Thorough 15%
2. **平均每查询成本**：应该下降（自然引导到成本效率选项）
3. **Free -> Plus 转化率**：Deep Analysis 门控应提升转化
4. **每会话消息数**：简化 UX 应增加参与度
5. **引用准确度**：确保无质量回退（所有模式 100% cite）
6. **选择器交互率**：对比当前 ModelSelector 的使用率

---

## 九、参考资料

### 市场调研
- ChatPDF, AskYourPDF, Humata, NotebookLM, Sharly.ai, Sider AI 产品调研
- ChatGPT model picker 变更 (2025-2026), Sam Altman 公开声明
- Perplexity Pro/Max 文档, Kimi 模式系统, DeepSeek Chat/Reasoner
- Cursor Auto Mode, GitHub Copilot Auto, Windsurf, Cline
- IDC: 70% of top AI enterprises will use model routing by 2028

### 心理学与 UX
- Iyengar & Lepper (2000) -- 果酱实验
- Scheibehenne et al. (2010) -- 选择悖论元分析
- Schwartz -- Satisficers vs Maximizers
- Hick-Hyman Law -- 决策时间与选项数
- Nielsen Norman Group -- Progressive Disclosure, Simplicity vs Choice
- MIT Sloan Management Review (2024) -- Intelligent Choice Architectures
- Default Effect 研究 -- 50%+ 用户不改默认值
- Pendo -- 80% SaaS 功能未使用

### 开源模型研究
- DeepSeek V3 技术报告（MLA 架构、辅助损失免 MoE 负载均衡）
- Qwen3-235B-A22B 官方文档（2507 更新日志、多语言训练数据）
- Vectara 幻觉排行榜（HHEM 2.1 + 2026 更新数据）
- Llama 4 Maverick LMArena 争议（Meta 提交特殊版本）
- Cohere Command R+ 技术文档（grounded generation、citation 机制）
- Mistral Medium 3 / 3.1 ArenaHard 评测
- Mistral Large 2512 评测数据

### 闭源模型研究
- GPT-5.2 MRCR 长上下文评测（256K 4-needle）
- Gemini 3 Flash Omniscience benchmark（91% 幻觉率）
- Grok 4.1 Collections API RAG benchmark（Finance 93.0, Legal 73.9）
- Artificial Analysis 模型对比数据

### 产品策略
- OpenRouter Auto Router 文档
- Stripe -- AI 产品定价框架 (60-70% 毛利率建议)
- NotebookLM 增长数据 (+57%)
- Anara vs NotebookLM 对比
- a16z -- State of Consumer AI 2025
- DocTalk 内部 RAG benchmark 数据（14 模型全量测试）

### 定价与基础设施
- OpenRouter 定价页面（2026-02-10 数据）
- OpenRouter 路由文档（Auto Router、Provider Routing、Fallback 配置）
- OpenRouter 企业 SLA 文档
