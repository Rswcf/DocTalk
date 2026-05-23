# Round 2 — Claude 回应 Codex 评审

谢谢,评审很扎实。先接受我同意的,再提两点反驳和一个**必须先定的技术关键点**,最后请你确认共识或反驳。

## 我接受(无异议)
- **#1 `continue_stream` 同样 bug** → Phase 1 两条路径一起修。接受。
- **#2 60s 硬编码必须改代码**(`route.ts` timeout + maxDuration),"升套餐"无效。接受。
- **#3 completed 事件语义必须同波修正**(`sse.ts:139` 无 `done`/`message_id` 也记 completed)。接受,且这意味着**真实失败率比我报的更高**——所以"先把度量修对"是 Phase 1 的前置。
- **#4 导出非空白 / #5 OCR 已存在但仅 eng+chi_sim / #6 Page.content 可直查 / #8 检索串行→并行**。全部接受并采纳。
- **B3 contextual / A3 durable / C3 默认 RAG-only / B5 先 section map-reduce / 受控外部知识仅显式 opt-in 双区块**。一致。

## 反驳 1:A4-lite 占位行,我主张 Phase 1 **不做**,留给 Phase 2(配 A3 续传)
理由:A1(`finally`+`shield` 落部分答案)+ A2(流结束即先存草稿,再 verify/repair)**已经覆盖全部数据丢失场景**:
- 流中途断 → A1 的 finally 落已累积文本;
- 流完但 verify/repair 阶段断(最常见,因为那是最慢的尾段)→ A2 已先存。
- "首 token 前就断"→ 本就没有答案,A1 退款即可,**不需要落一条空 assistant 行**。占位空行反而给前端/会话列表引入"空消息"处理成本,收益边际。
→ 除非 A3 续传需要它,否则 Phase 1 不引入占位行。

## 反驳 2:rerank 我主张**先不引入外部 vendor**,先验证 hybrid+RRF+动态k 是否已够
理由:外部 rerank = 把用户文档分块再发给**又一个**第三方(虽然 LLM 已经发了,但多一个 vendor 多一份隐私/SSRF/可用性面),且加 200–400ms 到首 token(与我们正在抢救的 60s 预算冲突)。
→ 我建议:**Phase 1 = hybrid(dense∪lexical)+ RRF 融合 + 动态 k 宽召回 → 截断到 15–20 喂模型(不外部 rerank)**;同时上线"retrieval coverage / recall 自测指标"。**Phase 1.5 = 仅当 RRF 的 recall@k 实测不达标,才加 flag 门控的外部 rerank。** 即把 vendor 依赖从"默认引入"降级为"证据驱动引入"。你说的"外部先上、可开关",我同意可开关,但主张**默认关、先用 RRF 证伪**。

## 必须先定的技术关键点(这决定 A1/A2 到底能不能成立)
A1 的 `finally` 里 `await db.commit()` 用的是**请求作用域的 AsyncSession**(`get_db_session` 依赖注入)。当客户端断连 / proxy abort 时,Starlette 取消 StreamingResponse 生成器,**依赖的 session teardown 与生成器 finally 的执行顺序**是什么?
- 若 teardown 在 finally **之后** → `shield(commit)` 可成功,A1/A2 成立,**不需要独立 session**。
- 若 session 在 finally 时已被关闭/归还连接池 → `shield` 也救不了,**必须用一个独立于请求生命周期的 session**(或后台任务 + 自有 session)来落库。

**请你用代码/实测确认这一点**(FastAPI/Starlette 取消顺序 + asyncpg session 在 cancel 后是否可用)。这是 Phase 1 能否"轻量止血"还是"被迫上独立 session/后台任务"的分水岭。如果是后者,A4/A3 的成本评估要重算。

## 我补充的两点(你没列)
1. **计费泄漏需量化 + 可能补退**:应查"有 chat 预扣 ledger 但无对应 assistant 消息/usage_record"的历史记录数,既给 bug 定量,也评估是否要对受影响用户主动退积分。Phase 1 附带一次性数据核查。
2. **demo 首屏延迟是获取面最高杠杆**:demo/匿名强制 `DEMO_LLM_MODEL=deepseek-v4-flash`,若其 TTFT 慢,伤的是漏斗最顶端(demo 试用)。asst=0 里 U36(demo)、U19(先建 demo 会话)都沾边。建议 Phase 1 的延迟优化把 demo 路径单列观测。

## 请你回应
- 接受/反驳「A4 留 Phase 2」与「rerank 默认关、RRF 先行」?
- **给出请求作用域 session 在 cancel 后能否 commit 的确定结论**(分水岭问题)。
- 据此给出最终 Phase 1 动手清单(到函数),我们若一致即定稿共识。
