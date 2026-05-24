# DocTalk 留存/转化 工程整改 — Claude↔Codex 共识方案（定稿)

**日期:** 2026-05-24
**流程:** Claude 草案 v1 → Codex 对抗评审 r1 → Claude 回应 r2 → Codex 裁决 r2 → **共识**
**辩论存档:** `.collab/plans/2026-05-24-doctalk-remediation-plan-v1.md`、`.collab/reviews/2026-05-24-remediation-codex-review-r1.md`、`.collab/dialogue/2026-05-24-remediation-r2-claude-response.md`、`.collab/reviews/2026-05-24-remediation-codex-review-r2.md`
**数据依据:** `.collab/reviews/2026-05-23-user-funnel-retrospective.md`（109 用户漏斗 + 47 用户逐条对话 + 唯一付费用户铁证）

---

## 0. 经辩论确认的事实(双方一致,均有代码/实测佐证)

- **asst=0 = 取消态数据丢失 + 计费泄漏**。assistant 仅在流水线末尾落库(`chat_service.py:1352`),其前有 LLM 流 + claim 校验 + **第二次 LLM repair**(`:1303-1317`);`CancelledError` 属 `BaseException`(`asyncio/exceptions.py:9`),绕过所有 `except Exception`(`:1280/:1767`);无 `finally`/`shield`。Vercel `route.ts` 60s 超时(`:116/:122/:148`)硬砍。**`continue_stream` 同病**。
- **量化(生产库实测):** ~36 次"扣费无答案",涉 ~15 个用账户;44 条 user 消息(~13%)无 assistant 回复;15 个会话 / 4 用户全 asst=0。持续发生(全局 sent>completed)。
- **【分水岭裁决】请求作用域 session 在取消态不可靠落库**:`get_db_session` 为 request-scope yield 依赖(`deps.py:18`),生成器 `finally` 先于依赖 teardown 执行(`routing.py`),**但** asyncpg 连接处于 cancelling 态会拒绝新操作(`protocol.pyx:728`,pool 须先等取消完成 `pool.py:224`)。→ **Phase 1 必须用独立 session 落库**,不能复用请求 `db` + `asyncio.shield`。用 `anyio.CancelScope(shield=True)` 包裹。
- **检索上限实测:** 普通问答 ~12、集合 ~14、全文总结固定 18/24,**均不随文档规模放大**(`corrective_retrieval_service.py:92/220/276`、`chat_service.py:973-989`)。无 rerank/RRF、无按页直查。
- **已有但未用好的零件:** OCR fallback 已存在但仅 `eng+chi_sim`(`config.py:88` → 乌尔都/阿语/扫描件失败);导出已存在(`export.py:62`、`chat_tool_executor.py:286`)→ 是动作路由/可发现性问题;`Page.content` 可直接用于按页查(`documents.py:674`)。

## 1. 共识优先级
1. **P0 可靠性止血**(asst=0 + 计费 + 度量):同时覆盖 `chat_stream` 与 `continue_stream`。
2. **P0 检索命中**:页码直查 + RRF + 动态 k(**默认不引外部 rerank**)。
3. **P0/P1 话术与反馈**:去 "fragment" 术语 + 诚实覆盖度提示。
4. **P1 整篇任务与解析**:section map-reduce + OCR 语言策略/失败可见。
5. **P2 大改**:contextual retrieval 重索引、durable streams 解耦、占位行续传(A4)、受控外部知识(C3 显式 opt-in 双区块)、外部 rerank(flag 默认 off)。

## 2. Phase 1 最终动手清单(到函数/文件 — 双方签字)

**可靠性(P0)**
1. **取消安全落库 + 账务兜底**(`chat_service.py` `chat_stream`≈802、`continue_stream`≈1420):
   - 主流程包 `try/except asyncio.CancelledError` 单独处理 + `finally`;
   - `finally` 用 `anyio.CancelScope(shield=True)` + **独立 session**(新 helper,基于 `models/database.py:AsyncSessionLocal`,**不复用请求 db**)执行:① 若 `assistant_text_parts` 非空且未落库 → 落部分答案;② 若 predebit 未结算 → reconcile(有部分答案)或 refund(无答案);
   - 用闭包 `persisted/settled` 标志保证正常路径与 finally **互斥**(单协程无并发,免占位行)。
2. **A2 先存后校验**(`chat_service.py:1303 vs :1352`):assistant 草稿先 commit,再跑 verify/repair;repair 改为对已存行 **UPDATE** + 追发 `answer_repaired`。
3. **前端 completed 语义**(`sse.ts:139`、`useChatStream.ts:203`):仅当收到带 `message_id` 的 `done` 才记 `chat_message_completed`;否则记 `stream_incomplete`。(否则前后对比指标失真)
4. **60s 硬超时**(`route.ts:116/122/148`):放宽/移除 chat 超时与 `maxDuration`(预算允许提到 300s;Hobby 限制则配合 P2 后台化)。

**检索命中(P0)**
5. **按页/位置直查**(`query_router.py` 已识别 + 新增执行分支于 `chat_service.py:968-1016`,用 `Page.content`/页范围 chunk/`document_tables`):命中"第N页/第N题/表N"走直查,不走纯语义。
6. **RRF + 动态 k**(`corrective_retrieval_service.py:92/118/207`):dense∪lexical 用 RRF 融合宽召回,k 随 `doc.page_count/chunks_total/intent` 放大,截断到 ~15–20 喂模型(保 1400 char/chunk 截断,守上下文预算);**子查询 `asyncio.gather` 并行**降 TTFT。外部 rerank 仅留 flag,**默认 off**,待 RRF recall 实测不达标再开。
7. **诚实覆盖度**(`chat_service.py:485` 系统提示之外):回答前向用户明示"已检索全文 M 段中 N 段"并提供"深度扫描"动作,取代冷拒。

**话术(P0 小)**
8. **去 "fragment"**(`chat_service.py:396-413`、`model_profiles.py:30-60`、11 语言):→ "the document/the sources";措辞软化为"优先基于文档,信息不足会说明"。保留引用契约。

**数据核查(P0)**
9. **漏账量化 + 可能补退**:统计"有 predebit、无 assistant/usage"的历史记录(已初步:~36 笔),决定是否对受影响用户补退积分。

## 3. Phase 2 / 3
- **P1:** B5 section map-reduce(复用 `document_element_service.select_representative_elements` + `summary_service`)做整篇总结/cheatsheet/extract-all;C4 OCR 语言策略 + 解析失败可见/重试;C2 聊天内"按指令导出当前答案"动作路由。
- **P2:** A3 durable streams(后台消费 + Redis buffer + Last-Event-ID 续传)彻底消灭 asst=0 并绕过代理时限;A4 占位行;B3 Anthropic Contextual Retrieval(重索引,prompt caching 控成本);外部 rerank 转正(若证据支持);C3 受控外部知识(显式 opt-in + 文档内/外双区块)。

## 4. 验收标准
1. 人为断连(首 token 后 / repair 前 / repair 中)均能持久化 assistant(部分或完整),不再出现"user 有、assistant 无"。
2. 取消路径预扣积分必 reconcile/refund,无悬挂 predebit;`persisted/settled` 互斥不双写。
3. 前端仅收到 `done`+`message_id` 才记 completed。
4. >70s 慢回答不再被 60s 代理硬砍。
5. 大文档候选数显著高于 8–12;RRF recall 指标达标后再评估 rerank flag。
6. 按页查询("第N页/第N题")能命中并给出正确引用。

## 5. 风险与缓解(Codex 提,双方采纳)
1. 取消落库与正常落库重复 → **闭包 persisted 标志 + ledger 幂等**(单协程互斥;跨请求去重留 A4)。
2. refund/reconcile 双记账 → 结算前查 `settled` 标志 + ledger 幂等约束。
3. 独立 session 写失败仍漏记 → 失败告警 + 监控 `stream_incomplete` 比率。
4. 动态 k 放大致 TTFT 上升 → 配合 token budget + 并行检索 + 超时策略。

## 6. 仍开放(需产品决策,非本工程共识范围)
WS-D 留存钩子:取消"上传闸口按文件大小收费"、首答成功后的次步引导/收藏文库、邮件再触达。定价(file_size/domain_mode 门控挡错了东西)。
