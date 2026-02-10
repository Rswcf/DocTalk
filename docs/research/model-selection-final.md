# DocTalk 三模式模型选择最终推荐

> **日期**: 2026-02-10
> **研究范围**: 开源模型 RAG 性能 + 闭源参考基准 + OpenRouter 定价/路由
> **约束**: 排除所有 Anthropic/Claude 模型，优先开源模型

---

## Executive Summary

基于三份独立研究报告的综合分析，推荐以下三模式配置：

| 模式 | 主模型 | 备选 | 成本/查询 | 预期 TTFT |
|---|---|---|---|---|
| **Quick** 快速回答 | DeepSeek V3.2 | Qwen3-30B-A3B | $0.0007 | ~2s |
| **Balanced** 均衡 (默认) | Qwen3-235B-A22B | Mistral Medium 3 | $0.0007 | ~2-3s |
| **Thorough** 深度分析 | GPT-5.2 | Gemini 3 Pro | $0.0105 | ~4s |

**相比当前方案（Claude Sonnet 4.5 全量，$0.0135/查询）**：
- Quick 模式节省 **~20x** 成本
- Balanced 模式节省 **~19x** 成本
- Thorough 模式节省 **~1.3x** 成本
- 假设流量分布 70% Quick / 25% Balanced / 5% Thorough，**加权平均成本降低约 10x**

---

## 一、数据基础

### 1.1 DocTalk 现有 Benchmark（48 用例 × 9 模型 = 432 次运行）

| 模型 | 类型 | 引用% | 语言% | 否定% | 关键词% | TTFT | 成本/查询 |
|---|---|---|---|---|---|---|---|
| ~~Claude Opus 4.6~~ | 闭源 | 100 | 100 | 88 | 78 | 2.6s | $0.0195 |
| ~~Claude Sonnet 4.5~~ | 闭源 | 100 | 98 | 88 | 74 | 2.0s | $0.0135 |
| **DeepSeek V3.2** | **开源** | **100** | **100** | **88** | **73** | **2.1s** | **$0.0007** |
| Gemini 3 Flash | 闭源 | 100 | 100 | 62 | 73 | 1.7s | $0.0025 |
| GPT-5.2 | 闭源 | 98 | 98 | 75 | 69 | 4.0s | $0.0105 |
| Grok 4.1 Fast | 闭源 | 98 | 100 | 75 | 70 | 1.5s | $0.0007 |
| Gemini 3 Pro | 闭源 | 98 | 100 | 75 | 72 | 7.1s | $0.0100 |
| MiniMax M2.1 | 闭源 | 93 | 100 | 62 | 72 | 5.2s | $0.0009 |
| Kimi K2.5 | 闭源 | 85 | 81 | 88 | 65 | 19.5s | $0.0024 |

**关键发现**：排除 Claude 后，DeepSeek V3.2（开源）在所有维度上与 Claude Sonnet 持平甚至更优，成本仅为其 1/19。

### 1.2 Vectara 幻觉率排名（开源模型）

| 模型 | 幻觉率 | 评价 |
|---|---|---|
| Phi-4 | 3.7% | 最低，但仅限英语 |
| Llama 3.3 70B | 4.1% | 优秀，但多语言弱 |
| Gemma 3 12B | 4.4% | 好，小模型 |
| Mistral Large 2 | 4.5% | 好 |
| Qwen3 系列 | ~5-6% | 好，多语言极强 |
| DeepSeek V3 | 6.1% | 可接受，已验证 |
| Cohere Command R+ | 6.9% | 可接受 |
| Llama 4 Maverick | 8.2% | 偏高 |
| DeepSeek R1 | 11.3% | 差——推理模型反而更容易幻觉 |

### 1.3 OpenRouter 成本排名（每查询，2000 输入 + 500 输出 tokens）

| 模型 | 成本/查询 | 对比 Sonnet 4.5 |
|---|---|---|
| Qwen 2.5 72B | $0.000130 | 104x 更便宜 |
| Gemma 3 27B | $0.000155 | 87x 更便宜 |
| Qwen3-30B-A3B | ~$0.000230 | 59x 更便宜 |
| Llama 3.3 70B | $0.000360 | 38x 更便宜 |
| Llama 4 Maverick | $0.000600 | 23x 更便宜 |
| Grok 4.1 Fast | $0.000650 | 21x 更便宜 |
| DeepSeek V3.2 | $0.000690 | 20x 更便宜 |
| Qwen3-235B | $0.000700 | 19x 更便宜 |
| DeepSeek V3 | $0.001200 | 11x 更便宜 |
| Mistral Large 3 | $0.001750 | 8x 更便宜 |
| Gemini 3 Flash | $0.002500 | 5x 更便宜 |
| GPT-5.2 | $0.010500 | 1.3x 更便宜 |
| Gemini 3 Pro | $0.010000 | 1.4x 更便宜 |
| Cohere Command A | $0.010000 | 1.4x 更便宜 |
| Claude Sonnet 4.5 | $0.013500 | (基线) |

---

## 二、排除与跳过的模型（附理由）

| 模型 | 排除原因 |
|---|---|
| **Claude Opus / Sonnet** | 用户要求排除所有 Anthropic 模型 |
| **DeepSeek R1** | 推理模型幻觉率 11.3%（是 V3 的 2 倍），推理延迟大，RAG 场景下过度设计 |
| **Llama 4 Maverick** | Benchmark 造假争议，公开版实际表现低于预期，幻觉率 8.2% 偏高 |
| **Phi-4** | 仅支持英语，16K 上下文窗口太小，不适合 11 语言的 DocTalk |
| **Cohere Command A（via OpenRouter）** | 原生引用机制只能通过 Cohere 自有 API 使用，经 OpenRouter 调用失去核心优势，且价格 $10/M output 偏贵 |
| **OpenAI o3 / o4-mini** | 推理模型，RAG 场景过度设计，o3 成本 $40/M output 不合理，o4-mini 即将退役 |
| **GPT-4.1** | 正在被 OpenAI 退役，不适合新集成 |
| **Kimi K2.5** | DocTalk benchmark 最差：85% 引用、81% 语言、19.5s TTFT |
| **MiniMax M2.1** | 62% 否定案例准确率太差，引用 93% 不达标 |
| **Gemini 3 Flash** | 91% 幻觉率（Omniscience benchmark），62% 否定准确率，"几乎没有拒绝机制"——对专业文档问答风险太高 |

---

## 三、候选模型深度分析

### 3.1 Quick 模式候选

#### DeepSeek V3.2 — 推荐

| 维度 | 数据 |
|---|---|
| 架构 | 671B 总参数，37B 激活（MoE），256 路由专家 |
| DocTalk 实测 | 引用 100%、语言 100%、否定 88%、关键词 73%、TTFT 2.1s |
| 幻觉率 | 6.1%（Vectara） |
| 多语言 | 中英双语极强，其他语言可用 |
| 成本 | $0.25/M 输入, $0.38/M 输出 → $0.0007/查询 |
| 上下文 | 163K tokens |
| 特殊优势 | 训练数据含 `[citation:X]` 格式，引用感知已融入模型。已在 DocTalk 运行数月，`positive_framing` prompt style 已调优 |

**为什么选它**：已经在 DocTalk 中经过实战验证，100% 引用准确率，成本极低。作为 Quick 模式，它在速度、成本和质量三者间达到了最优平衡。无需额外调优。

#### 备选：Qwen3-30B-A3B

| 维度 | 数据 |
|---|---|
| 架构 | 30.5B 总参数，3.3B 激活（MoE）——极致效率 |
| 幻觉率 | ~5%（估算，基于 Qwen3 系列数据） |
| 多语言 | 29+ 语言 |
| 成本 | $0.06/M 输入, $0.22/M 输出 → ~$0.0002/查询（比 DeepSeek 更便宜 3x） |
| 上下文 | 131K tokens |
| 风险 | 未经 DocTalk 实测，较新模型 |

**备选理由**：如果成本压力极大，Qwen3-30B 是 DeepSeek V3.2 的 1/3 价格，理论指标不差。但需要先 benchmark 验证引用合规性。

### 3.2 Balanced 模式候选

#### Qwen3-235B-A22B — 推荐

| 维度 | 数据 |
|---|---|
| 架构 | 235B 总参数，22B 激活（MoE），128 专家 |
| 幻觉率 | ~5-6%（基于 Qwen3 系列数据，与 DeepSeek V3 持平） |
| 多语言 | **29+ 语言**——覆盖 DocTalk 全部 11 个 locale（中、英、西、日、德、法、韩、葡、意、阿、印） |
| 成本 | $0.18/M 输入, $0.54/M 输出 → $0.0007/查询 |
| 上下文 | 262K tokens（YaRN 扩展） |
| 指令遵从 | 2507 更新"显著改善"指令遵从，专为 RAG 和 tool-calling 优化 |
| 双模式 | 支持 thinking（推理）和 non-thinking（直答）模式。RAG 场景使用 non-thinking 模式 |
| 特殊优势 | MoE 架构使得 235B 模型的成本接近 22B 模型，兼具大模型的知识深度和小模型的推理速度 |

**为什么选它**：
1. **多语言最强**：29+ 语言原生训练，是所有候选中多语言能力最全面的（除 Gemma 的 140+ 语言但模型太小）
2. **成本与 DeepSeek V3.2 持平**：$0.0007/查询，但模型规模大得多（235B vs 671B 但激活参数 22B vs 37B）
3. **专为 RAG 优化**：2507 更新明确优化了 RAG 和工具调用的指令遵从
4. **知识容量大**：235B 总参数意味着更丰富的世界知识，在复杂推理问题上应优于 DeepSeek V3
5. **与 Quick 模式有明显质量差异**：给用户从 Quick 升级到 Balanced 的感知价值

#### 备选：Mistral Medium 3

| 维度 | 数据 |
|---|---|
| 指令遵从 | **0.971 ArenaHard**（超越 Llama 4 Maverick 0.918、GPT-4o 0.954）——所有候选中最高 |
| 幻觉率 | ~4.5%（基于 Mistral Large 2 数据） |
| 多语言 | 13+ 语言（欧洲语言强，CJK 可用） |
| 成本 | ~$0.40/M 输入, $2.00/M 输出 → ~$0.002/查询 |
| 专为 RAG 设计 | 官方文档明确提到 RAG、聊天系统和自动化是目标用例 |
| 风险 | OpenRouter 定价待确认，CJK 语言表现不如 Qwen |

**备选理由**：指令遵从分数是所有模型中最高的——这对引用格式 `[1][2][3]` 的合规性至关重要。如果 benchmark 显示 Qwen3 的引用格式遵从有问题，Mistral Medium 3 是最佳替补。

### 3.3 Thorough 模式候选

#### GPT-5.2 — 推荐

| 维度 | 数据 |
|---|---|
| DocTalk 实测 | 引用 98%、语言 98%、否定 75%、关键词 69%、TTFT 4.0s |
| 长上下文 | 4-needle MRCR 在 256K 内近 100% 准确——最佳长上下文检索 |
| 多语言 | MMLU：中文 0.901、日语 0.897、韩语 0.895——CJK 极强 |
| CJK 优化 | 30-40% token 压缩（CJK 语言成本更低） |
| 成本 | $1.75/M 输入, $14.00/M 输出 → $0.0105/查询 |
| 上下文 | 400K tokens |
| 特殊优势 | Response compaction API（超 400K 对话压缩），最成熟的商用 API |

**为什么选它**：
1. **排除 Claude 后的最强闭源模型**：在 DocTalk benchmark 中仅次于 Claude Opus/Sonnet
2. **CJK 性能顶尖**：MMLU 中/日/韩均 >0.89，对 DocTalk 的亚洲用户群至关重要
3. **长上下文可靠性最高**：256K 内近 100% needle-in-haystack，对复杂多轮对话有优势
4. **稳定性和可靠性**：OpenAI 的 API 稳定性和全球可用性是所有提供商中最好的
5. **付费套餐的升级感知**：从开源模型升级到 GPT-5.2，用户有明确的"我在用更好的东西"的感知

**引用率 98% vs DeepSeek 100% 的差距**：GPT-5.2 偶尔不加引用标记（2% miss），可能通过 prompt 优化（更显式的 `explicit_citation` 风格）改善。

#### 备选：Gemini 3 Pro

| 维度 | 数据 |
|---|---|
| DocTalk 实测 | 引用 98%、语言 100%、否定 75%、关键词 72%、TTFT 7.1s |
| 成本 | $2.00/M 输入, $12.00/M 输出 → $0.0100/查询 |
| 上下文 | 1M tokens |
| 缺点 | TTFT 7.1s 偏慢 |

**备选理由**：成本略低于 GPT-5.2，语言合规 100%，关键词覆盖 72% 更高。但 7.1s TTFT 对用户体验有明显影响。作为 GPT-5.2 不可用时的 fallback。

---

## 四、最终推荐方案

### 4.1 三模式配置

```
┌─────────────────────────────────────────────────────────────────┐
│                    DocTalk 三模式系统                              │
├────────────┬──────────────┬──────────────┬─────────────────────┤
│            │   Quick      │  Balanced    │    Thorough         │
│            │   快速回答     │  均衡 (默认)  │    深度分析          │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ 主模型      │ DeepSeek     │ Qwen3       │ GPT-5.2             │
│            │ V3.2         │ 235B-A22B    │                     │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ Fallback   │ Qwen3-30B    │ Mistral      │ Gemini 3 Pro        │
│            │ -A3B         │ Medium 3     │                     │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ 成本/查询   │ $0.0007      │ $0.0007      │ $0.0105             │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ Credit 倍率 │ 0.5x         │ 1x (默认)    │ 5x                  │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ 套餐限制    │ 所有用户      │ 所有用户      │ Plus / Pro          │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ 预期 TTFT   │ ~2s          │ ~2-3s        │ ~4s                 │
├────────────┼──────────────┼──────────────┼─────────────────────┤
│ 最适场景    │ 简单事实查找   │ 日常文档问答   │ 复杂分析/推理/报告    │
│            │ 快速验证      │ 多语言需求     │ 高准确度需求          │
└────────────┴──────────────┴──────────────┴─────────────────────┘
```

### 4.2 为什么这个组合是最优的

**Quick: DeepSeek V3.2**
- 唯一经过 DocTalk 实战验证且达到 100% 引用/100% 语言的开源模型
- 已有调优好的 `positive_framing` prompt style
- 作为当前 Demo 模型运行数月，稳定性已验证
- $0.0007/查询 = 极致成本效率

**Balanced: Qwen3-235B-A22B**
- 与 Quick 模式成本相近但模型规模大幅提升（235B vs 671B 参数池）
- **多语言覆盖 29+ 种语言**——这是选择 Qwen3 而非其他模型的决定性因素
- MoE 架构使大模型在成本上与小模型竞争
- 官方 2507 更新专门优化了 RAG 指令遵从
- 与 Quick 有清晰的质量区分：更深的推理、更丰富的世界知识、更好的复杂问题处理

**Thorough: GPT-5.2**
- 排除 Claude 后综合能力最强的模型
- CJK 性能顶尖（中 0.901/日 0.897/韩 0.895）
- 长上下文可靠性最高（256K 内近 100%）
- OpenAI API 稳定性和全球可用性最佳
- 明确的"付费升级感知"——从开源模型到 OpenAI 旗舰

### 4.3 Fallback 配置

通过 OpenRouter 的 `models` 数组实现自动故障转移：

```json
{
  "quick": {
    "models": ["deepseek/deepseek-v3.2", "qwen/qwen3-30b-a3b", "meta-llama/llama-3.3-70b-instruct"],
    "provider": { "sort": "latency" }
  },
  "balanced": {
    "models": ["qwen/qwen3-235b-a22b", "mistralai/mistral-medium-3", "deepseek/deepseek-chat"],
    "provider": { "sort": "throughput" }
  },
  "thorough": {
    "models": ["openai/gpt-5.2", "google/gemini-3-pro-preview", "mistralai/mistral-large-2512"],
    "provider": { "sort": "throughput" }
  }
}
```

### 4.4 匿名 Demo 用户

- 强制使用 Quick 模式（DeepSeek V3.2），不显示模式选择器
- 与当前行为一致（`DEMO_LLM_MODEL = deepseek/deepseek-v3.2`）

---

## 五、Benchmark 验证计划

### 5.1 必须 Benchmark 的模型（部署前）

当前 DocTalk 的 benchmark 系统已就绪（48 用例 × 10 类别 × 3 文档），可以直接运行。

**优先级 1（必须）**：
| 模型 | OpenRouter ID | 原因 |
|---|---|---|
| Qwen3-235B-A22B | `qwen/qwen3-235b-a22b` | Balanced 主模型，未经实测 |
| Mistral Medium 3 | `mistralai/mistral-medium-3` | Balanced 备选，指令遵从最高 |

**优先级 2（建议）**：
| 模型 | OpenRouter ID | 原因 |
|---|---|---|
| Qwen3-30B-A3B | `qwen/qwen3-30b-a3b` | Quick 备选，超低成本 |
| Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct` | Quick fallback，最低幻觉率 |
| Gemma 3 27B | `google/gemma-3-27b-it` | 最广语言覆盖，潜在 Quick 替代 |

### 5.2 Benchmark 执行命令

```bash
cd backend

# 优先级 1：Balanced 候选
python scripts/run_benchmark.py \
  --jwt <JWT> \
  --models qwen/qwen3-235b-a22b,mistralai/mistral-medium-3

# 优先级 2：Quick 候选
python scripts/run_benchmark.py \
  --jwt <JWT> \
  --models qwen/qwen3-30b-a3b,meta-llama/llama-3.3-70b-instruct,google/gemma-3-27b-it

# 评估
python scripts/evaluate_benchmark.py <results_file>.json
```

### 5.3 通过标准

| 指标 | Quick 最低要求 | Balanced 最低要求 | Thorough 最低要求 |
|---|---|---|---|
| 引用准确率 | ≥95% | ≥98% | ≥98% |
| 语言合规率 | ≥95% | ≥98% | ≥98% |
| 否定准确率 | ≥75% | ≥80% | ≥80% |
| 关键词覆盖 | ≥65% | ≥70% | ≥70% |
| 平均 TTFT | ≤3s | ≤5s | ≤8s |
| 错误率 | ≤5% | ≤2% | ≤2% |

---

## 六、实施路线

### Phase 0: Benchmark 验证（1-2 天）
1. 在 `run_benchmark.py` 的 `ALL_MODELS` 中添加新模型 ID
2. 为新模型创建 `model_profiles.py` 条目（temperature、max_tokens、prompt_style）
3. 运行 benchmark，评估结果
4. 如果 Qwen3-235B 不达标，切换到 Mistral Medium 3

### Phase 1: 后端配置更新
1. 更新 `config.py`：
   - `ALLOWED_MODELS` 缩减为 3 个主模型 + 3 个 fallback
   - 新增 `MODE_MODELS` 映射：`{"quick": [...], "balanced": [...], "thorough": [...]}`
   - 新增 `MODE_CREDIT_MULTIPLIER`：`{"quick": 0.5, "balanced": 1.0, "thorough": 5.0}`
   - `PREMIUM_MODES = ["thorough"]`（替代 `PREMIUM_MODELS`）
2. 更新 `model_profiles.py`：为 Qwen3-235B 和 Mistral Medium 3 添加 profile
3. 更新 `chat_service.py`：接受 `mode` 参数而非 `model` 参数，内部映射到具体模型
4. 更新 `credit_service.py`：按 mode 计算 credit 消耗

### Phase 2: 前端更新
1. `ModelSelector.tsx` → `ModeSelector.tsx`：3 段 pill 切换器
2. 每个模式显示简短描述：
   - Quick: "Fast answers, great for simple lookups"
   - Balanced: "Best quality-to-speed ratio" (默认选中)
   - Thorough: "Deep analysis with maximum accuracy" (Plus/Pro 锁标)
3. 更新 `models.ts`：从模型列表改为模式定义
4. 匿名 Demo 用户：隐藏模式选择器

### Phase 3: 高级设置（可选，长期）
1. Settings/高级 中保留完整模型选择器（仅 Plus/Pro）
2. 允许 power user 覆盖模式的默认模型映射

---

## 七、风险分析

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Qwen3-235B 引用合规不达标 | 中 | 高 | Benchmark 验证 + Mistral Medium 3 备选 |
| Qwen3 OpenRouter 可用性不稳定 | 低 | 中 | 3 层 fallback 链 |
| GPT-5.2 价格上涨 | 低 | 低 | Gemini 3 Pro 作为备选 |
| 用户抱怨失去模型选择自由 | 中 | 低 | Phase 3 高级设置逃生舱 |
| 新模型需要新 prompt style | 高 | 中 | Benchmark 先行，必要时创建新 prompt style |
| Quick/Balanced 成本相近导致用户困惑 | 中 | 低 | UI 强调质量差异而非成本差异 |

---

## 八、Cohere Command A 的特别说明

Cohere 的原生引用机制（API 层面返回结构化引用对象，无需 FSM 解析）从技术上看是文档问答的理想方案。但因以下原因暂不推荐：

1. **OpenRouter 无法使用原生引用**：通过标准 chat completions API 调用时，Cohere 的结构化引用输出不可用
2. **需要直接集成 Cohere API**：架构变更较大，需维护双 LLM 通道（OpenRouter + Cohere 直连）
3. **成本偏高**：$2.50/$10.00 per M tokens，是 Qwen3-235B 的 14x
4. **幻觉率不占优**：6.9% vs DeepSeek 6.1%、Qwen3 ~5-6%

**长期建议**：如果 DocTalk 未来需要 "企业级精确引用" 产品线，Cohere Command A 的直接 API 集成值得评估。当前阶段投入产出比不合理。

---

## 附录：参考来源

### 开源模型研究
- DeepSeek V3 技术报告（MLA 架构、辅助损失免 MoE 负载均衡）
- Qwen3-235B-A22B 官方文档（2507 更新日志、多语言训练数据）
- Vectara 幻觉排行榜（HHEM 2.1 + 2026 更新数据）
- Llama 4 Maverick LMArena 争议（Meta 提交特殊版本）
- Cohere Command R+ 技术文档（grounded generation、citation 机制）
- Mistral Medium 3 ArenaHard 评测（0.971 指令遵从分）

### 闭源模型研究
- GPT-5.2 MRCR 长上下文评测（256K 4-needle）
- Gemini 3 Flash Omniscience benchmark（91% 幻觉率）
- Grok 4.1 Collections API RAG benchmark（Finance 93.0, Legal 73.9）
- Artificial Analysis 模型对比数据

### 定价与基础设施
- OpenRouter 定价页面（2026-02-10 数据）
- OpenRouter 路由文档（Auto Router、Provider Routing、Fallback 配置）
- OpenRouter 企业 SLA 文档
