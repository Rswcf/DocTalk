# DocTalk 留存/转化 工程整改方案 v1（Claude 草案,待 Codex 对抗评审）

**日期:** 2026-05-24
**依据:** 生产数据复盘 `.collab/reviews/2026-05-23-user-funnel-retrospective.md`(含 47 用户逐条对话 + 唯一付费用户铁证)+ asst=0 超时 bug 根因 + RAG/streaming 2025 best-practice 检索。
**目标:** 把"两个一半"(一半被功能劝退 / 一半成功但无回访)中**工程可解的部分**修掉,按杠杆率排序,给出可落地的具体设计 + 排序,供 Claude↔Codex 辩论求共识。

---

## 0. 问题清单(来自真实数据,按出现频次)

| # | 问题 | 证据 | 类别 |
|---|---|---|---|
| P1 | **大文档"整篇覆盖"失败**:只召回 ~8–12 chunk(`corrective_retrieval_service.py:92` `_plan_limit=max(top_k or 8,12)`,每步 top_k=2),不随文档大小放大 | U26 462p"第18章没信息"、U18"只有10章吗"、U47、付费用户、U01/U37/U21/U19 | 检索 |
| P2 | **页码/精确出处失败**,打脸"引用确切原文+页码"卖点;喂给 LLM 的 chunk 不带可用页码,且无按页/位置检索 | U01/U03/U17/U21/付费用户("第350页") | 检索 |
| P3 | **导出/生成被拒**(Excel/CSV/PDF/下载) | U28/U30/U44/U47 | 能力 |
| P4 | **过度死板"只能基于文档"人设**,拒绝"帮我写/扩写",且 prompt 泄露内部术语 "fragment"(11 语言) | U47/U09/U08/付费用户;`chat_service.py:396` | 人设/prompt |
| P5 | **扫描件/非拉丁文解析乱码**,OCR 不足 | U13(乌尔都)、U38(扫描图纸);另有 10 个 `VECTORIZE_FAILED` + 2 个卡 ocr | 解析 |
| P6 | **asst=0 流式数据丢失**:断连/60s 超时丢整条回答 + 不退积分 | U07/U10/U19/U36;全局 sent>completed 持续 | 工程可靠性 |
| P7 | **首 token 延迟高**,用户等不到就放弃/重试 | U36 两条隔18s;demo 模型 + 大 prompt | 工程性能 |
| P8 | 一半用户成功但**无回访钩子**(一次性作业) | 47人仅15回访,21一次就走 | 产品(本方案外) |

---

## WS-A 流式可靠性(修 P6/P7 — 最高优先,纯 bug,数据在丢)

**根因:** assistant 行只在流水线最末(`chat_service.py:1361`)落库,前面要跑完 LLM 流 + claim 校验 + 可能的第二次"修复"LLM 调用;`CancelledError`(BaseException)绕过所有 `except Exception`,无 `try/finally`/`shield` → 断连即丢整条 + 不退款。Vercel `route.ts maxDuration=60` + `AbortSignal.timeout(60000)` 60s 硬砍。

- **A1 取消安全落库(P0,数小时):** 用 `try/except (Exception, asyncio.CancelledError)` + `finally`包裹流式段;`finally`里若 assistant 尚未落库,用 `asyncio.shield` 保护一次"flush 已累积 `assistant_text_parts` + 退/对账积分"的提交。确保:断连也存部分答案、且**积分必退/对账**。
- **A2 先存后校验(P0,数小时):** 把"落库流式答案"挪到 claim 校验/`_try_repair_rag_answer` **之前**;repair 改成对已存行的 UPDATE + 追发 `answer_repaired`。断连发生在 repair 阶段也不丢已生成答案。
- **A3 生成与连接解耦(P1,1–2 周,Phase 2):** LLM 流在后台任务里被**完整消费**写入 Redis buffer,SSE 端从 buffer 转发;客户端断连后台继续跑到落库;前端用 `Last-Event-ID` 断点续传。绕过 60s 硬顶 + 彻底消灭 asst=0。(参考 durable-streams / Vercel consumeStream)
- **A4 占位行幂等(P1):** 发 LLM 前先插 `assistant(status=streaming)` 占位行,完成时 UPDATE。永远有记录,支持续传与去重。
- **A5 延迟与预算(P1):** ①检索阶段立即下发 `tool_status`(检索中/生成中)真实反馈;②评估把 Vercel 升级以放宽 `maxDuration`(Hobby 60s→Pro 300s)或对 >60s 的长答案走 A3 后台+轮询;③给校验/修复设超时上限,避免它们把总时长推过 60s。

## WS-B 大文档检索质量(修 P1/P2 — 头号 churn 主题)

现状:已有 `corrective_retrieval_service`(多步)、`retrieval_service.lexical_search`(BM25 类)、`table_search`、`document_brief_service`、`claim_verifier_service`、`document_tables`、`Pages` 表 —— **零件齐但 top_k 太小、无 rerank、无 contextual chunk、无随文档大小/意图放大、无按页检索、无整篇 map-reduce**。

- **B1 宽召回 + rerank(P0,核心):** 用 hybrid(dense ∪ lexical,RRF 融合)宽召回 50–100 候选 → 加 **reranker**(Cohere rerank / bge-reranker-v2 / Voyage rerank-2.5)精排到 15–20 → 喂 LLM。替换 `top_k=2/步、final 8–12`。
- **B2 随文档/意图放大 k:** k 随 `page_count`/`chunks_total` 与 query 意图(summary/extract-all 用更大覆盖)动态调整。
- **B3 Contextual Retrieval(P1,需重索引):** 索引期给每个 chunk 前置一段"该 chunk 在全文中的上下文摘要"再嵌入(Anthropic 法,−49%/−67% 检索错误)。用 prompt caching 控成本。改 `parse_service`/`embedding_service` 索引链 + 一次性回填。
- **B4 位置/页/表 直查(P0,中):** `query_router` 已有模式;命中"第N页/第N题/表N/图N"→ 直接按 `Pages.page_number`/`section_title`/`document_tables` 取,不走纯语义。修 P2。
- **B5 整篇任务 map-reduce(P1):** summary/cheatsheet/extract-all 走分段 map-reduce 或 RAPTOR 式层级摘要(基于 `document_brief`/outline 覆盖全文),替代 `get_summary_context(max_chunks=18)`。修 P1 的"缺章漏页"。
- **B6 诚实覆盖反馈(P0,小):** 检索不足时明确告知"我检索了全文 M 段中的 N 段;要我扫描全文吗?"并提供"深度扫描"动作,取代冷冰冰"片段里没有"。

## WS-C 能力与人设(修 P3/P4/P5)

- **C1 去 "fragment" 术语(P0,小):** 全 prompt 把 "fragment(s)" → "the document/the sources";11 语言核对。措辞从"只能基于文档"软化为"优先基于文档,信息不足会说明"。
- **C2 导出能力(P1):** 复用 `chat_tool_executor` + `extraction_service` + `document_tables`,新增导出工具:答案/表格 → CSV/XLSX/Markdown/PDF 下载。门控:Export = Plus+(已有前端门控)。
- **C3 受控外部知识(P1):** 用户**显式要求**"在文档之外帮我写"时,允许用通用知识并清晰标注"以下含文档外的通用知识",而非硬拒。保留默认 RAG-grounded。
- **C4 解析健壮性(P1):** 文本产出过低(扫描件/非拉丁)→ 触发 OCR 回退;解析失败对用户可见 + 一键重试(修 P5 + 把 10 个 VECTORIZE_FAILED 的沉默流失救回)。

## WS-D 留存钩子(P8,产品轨,本方案只列不展开)
先免费出价值再收费(别在上传闸口按文件大小收费)、首答成功后的次步引导/收藏到文库、邮件再触达。

---

## 排序(杠杆率 × 成本)
1. **WS-A1/A2 + B6 + C1**(数天,P0,止血:不再丢答案/不再丢钱/不再冷拒/去术语)
2. **B1 + B4**(1–2 周,P0,检索质量根治大文档 + 页码)
3. **B5 + C2 + C4**(整篇任务 + 导出 + 解析健壮)
4. **B3 + A3**(contextual 重索引 + durable streams,较大工程)
5. **WS-D**(产品)

## 待 Codex 辩论的关键分歧点
1. A3(durable streams)值不值得现在做,还是 A1/A2 + 提高 Vercel 预算就够?
2. rerank 选型:外部 API(Cohere/Voyage,省事但加延迟+成本+SSRF/隐私)vs 自托管(bge,省钱但要 GPU/CPU 资源)。
3. Contextual Retrieval 重索引的成本/收益,是否优先于先上 hybrid+rerank。
4. 整篇任务:RAPTOR 层级摘要 vs 简单 section map-reduce —— 复杂度/收益。
5. C3 放开外部知识是否伤害"可信引用"品牌定位(与 frontend.md 的 RAG-grounded 设计冲突?)。
6. 是否需要先补埋点(product_events 2026-05-01 才有)再改,以便量化前后对比。
