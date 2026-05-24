# DocTalk 整改 — 测试方案(对照共识方案 + 真实失败用例)

**日期:** 2026-05-24
**配套:** `.collab/plans/2026-05-24-doctalk-remediation-CONSENSUS.md`(被测的修复)、`.collab/reviews/2026-05-23-user-funnel-retrospective.md`(失败用例来源)
**核心原则:** 每个用例都来自一个**真实失败的用户**,要求在**修复前 FAIL、修复后 PASS**。测试套件 = 修复成功的证据。

---

## 1. 测试分层

| 层 | 内容 | 需要文档? | 何时跑 |
|---|---|---|---|
| L1 单元 | 取消落库逻辑、积分 reconcile/refund 幂等(persisted/settled 标志)、RRF 融合、动态 k 计算、按页路由正则、去-fragment prompt 构建、completed 事件门控 | 否 | 每次提交 |
| L2 集成 | `chat_stream`/`continue_stream` 端到端(真/桩 LLM)对种子+真实文档;检索质量 | 是 | 每次提交 |
| L3 E2E 可靠性 | 断连模拟、60s 超时、计费正确性(前端→代理→后端) | 是(大文档) | 修复后 + 发布前 |
| L4 质量评测 | 带标注 Q&A 集上的 检索 recall@k + 答案正确率 + 引用页码准确率 | 是(标注集) | 改检索前后对比 |
| L5 手工探索 | 复现真实用户用例(原语言) | 是 | 修复后验收 |

**asst=0 怎么测(关键):** 主用 L1 确定性手法——把 `chat_stream()` 当异步生成器迭代到中途调用 `.aclose()`(等价于客户端断连注入 CancelledError),断言:① 部分 assistant 已落库;② predebit 已 reconcile/refund;③ 无悬挂 predebit;④ 不重复落库(persisted 标志)。再加 L3 真实断连/慢响应做现实校验。无需真人操作。

---

## 2. 用例目录(每条标注:来源用户 / 文档 / 修复前 / 修复后 / 验证哪个修复 / 验收项)

### Group R — 可靠性 / asst=0(P6,Phase 1 ①②③④⑨)
| TC | 来源 | 步骤 | 修复前(FAIL) | 修复后(PASS) |
|---|---|---|---|---|
| R1 | U07/U36 | 首 token 后断连 | 无 assistant 行、扣费不退 | 部分答案落库 + 积分对账/退,无悬挂 predebit |
| R2 | 付费用户 | 流完成、verify/repair 阶段断连 | 整条答案丢失 | 完整答案已先落库(草稿先存) |
| R3 | U19/U10 | 大文档触发 >60s 回答 | 60s 被代理硬砍 | 回答完整返回 |
| R4 | — | R1/R2 在 `continue_stream` 重跑 | 同 chat_stream 丢失 | 同样兜底 |
| R5 | 度量 | 流异常结束(无 done) | 仍记 `chat_message_completed` | 记 `stream_incomplete`,不污染漏斗 |
| R6 | ~15 计费用户 | 取消一次 chat 后查余额 | 扣费无答案 | 余额正确(无答案不计费/部分答案按实计) |

### Group P — 按页/位置直查(P2,Phase 1 ⑤)
| TC | 来源 | 查询 | 修复前 | 修复后 |
|---|---|---|---|---|
| P1 | 付费用户 | "第 N 页有什么" | "片段不含第 N 页" | 返回第 N 页内容 + 引用页=N |
| P2 | 付费用户 | "找第 80 题" | "片段里没有第 80 题" | 定位到第 80 题(对照 ground-truth 页) |
| P3 | U30/U37 | "给我表 N / 图 N" | 找不到 | 返回该表/图 |
| P4 | U01/U17/U21 | "逐字引用并标页码" | "片段不含页码" | 引用页码与 ground-truth 一致 |

### Group C — 整篇覆盖(P1,Phase 1 ⑥⑦ 宽召回+诚实度;Phase 2 map-reduce 根治)
| TC | 来源 | 查询 | 修复前 | 修复后 |
|---|---|---|---|---|
| C1 | U26 | "总结全文/每一章" | 缺章(如"第18章没信息") | 覆盖 ground-truth 全部主要章节 |
| C2 | U26/U47 | "给每章做 cheatsheet" | 漏章 | 章节覆盖率达标 |
| C3 | 付费用户/U18 | "列出文档里所有题目/章节" | 不全("只有10章吗") | 对照 ground-truth 列表完整 |
| C4 | 全体大文档 | 触发部分覆盖 | 冷拒"片段里没有" | 显示"已检索 M 段中 N 段 + 深度扫描"动作 |

### Group Q — 检索质量 RRF+动态k(P1,Phase 1 ⑥)
| TC | 来源 | 查询 | 修复前 | 修复后 |
|---|---|---|---|---|
| Q1 | U26/U37/付费 | 答案在文档中部的事实题 | 召回不到→"没有" | 命中并正确作答 |
| Q2 | U14 | 罕见术语/地名精确查找 | "未提及" | 混合检索命中 |
| Q3 | 仪表 | 检索候选数随文档规模 | 固定 ~8–12 | 随 page_count 放大(调试日志可见) |

### Group X — 导出(P3,Phase 2 C2)
| TC | 来源 | 查询 | 修复前 | 修复后 |
|---|---|---|---|---|
| X1 | U30/U44 | "把表格导出 CSV/Excel" | "我无法生成文件" | 产出可下载文件,内容对 |
| X2 | U28/U47 | "做成可下载 PDF/Word" | 拒绝 | 产出文件 |

### Group L — 人设/术语(P4,Phase 1 ⑧;Phase 3 C3)
| TC | 来源 | 检查 | 修复前 | 修复后 |
|---|---|---|---|---|
| L1 | 付费用户 | 11 语言答复中是否出现 "fragment/fragmento/片段/أجزاء/fragmenty…" | 出现内部术语 | 全部消除(自动断言) |
| L2 | U42/U09 | 文档缺信息时的口吻 | 冷拒 | 有帮助 + 给选项 |
| L3(P3) | U47/付费 | 显式"在文档之外帮我写" | 硬拒 | 双区块(文档内/外)输出 |

### Group S — 解析/OCR(P5,Phase 2 C4)
| TC | 来源 | 步骤 | 修复前 | 修复后 |
|---|---|---|---|---|
| S1 | U38 | 上传扫描件(无文本层) | "片段是乱码" | OCR 后可作答 |
| S2 | U13/U18/U40 | 上传乌尔都/阿语 PDF | 乱码/"加密文本" | 正确解析,按语言作答 + 引用 |
| S3 | 10×VECTORIZE_FAILED | 触发解析失败 | 静默,用户不知 | 明确错误 + 一键重试 |

### Group G — 回归(保护甜区,别改坏)
| TC | 来源 | 步骤 | 期望 |
|---|---|---|---|
| G1 | U41/U16/U25 | 中等论文(15–40p)单点提问 | 正确答案 + 正确引用页(保持) |
| G2 | U41/U45 | 3 篇论文集合提问 | 正常作答 |
| G3 | 全体 | demo 黄金路径:上传→聊→点引用跳转 | 通过 |
| G4 | U24/U06 | 小文档总结 | 通过 |
| G5 | U36 | demo 首 token 延迟 | < 阈值(P7) |

---

## 3. 验收闸门(对齐共识方案 §4)
- 所有 Group R 通过 = 验收项 1–4(可靠性 + 度量)
- Group P + Q + C4 通过 = 验收项 5–6(检索 + 按页)
- L4 评测:修复后 recall@k 与答案正确率显著高于修复前基线(用同一标注集)
- Group G 全绿 = 无回归
- 漏账脚本复跑:gap 不再增长(新数据为 0)

## 4b. 回放法(Replay)— 采纳为验收/回归主干

**思路(用户提议,采纳):** 直接用真实用户**当时上传的文件 + 当时的问题**复现场景,修复后重放能跑通即证明修复成功。

**可行性已核实:** 无文档保留/TTL 策略(MinIO `remove_object` 仅在用户主动删除时触发,`storage_service.py:161`/`doc_service.py:115`);92 份非 demo 用户文档 storage_key 全在 → 原文件几乎必然仍在存储(用前对每个 object 做一次 HEAD 确认)。原问题全在 `messages` 表,可直接抽取。

**回放脚本设计(`backend/scripts/replay_cases.py`):**
1. 输入一组 target session_id(来自 47 用户分析);
2. 还原该 session/collection 引用的**全部**文档(多文件场景如 U04/U37/U41/集合一并还原);
3. 按 `created_at` 顺序**逐条重放该用户的真实 user 消息**;
4. 对每条 assistant 输出跑**不变量断言**(见修正 A),记录"修复前失败信号 present? 修复后成功信号 present?";
5. 产出 before/after 对照表。

**判定 = 不变量,不是逐字相等(LLM 非确定性):**
| 案 | 修复前不变量(应 present) | 修复后不变量(应 present) |
|---|---|---|
| 付费用户 | 回答含"第350页不存在/片段没有" | 检索含第350页 chunk + 引用页=350 + 无"找不到" |
| U26 | 覆盖缺"第18章" | 章节覆盖率 ≥ 阈值(对 ground-truth 章节表) |
| U14 | "未提及该术语" | 命中该术语 + 引用 |
| U13/U38 | "乱码/加密文本" | 解析出可读文本 + 可作答 |
| L1(全体) | 输出含 "fragment/片段/fragmenty…" | 11 语言均无内部术语 |

**组别适用性(关键):**
- ✅ 回放有效:P(按页)、C(覆盖)、Q(检索)、L(人设)、S(解析)、X(导出)。
- ❌ 回放**无效**:R(asst=0 可靠性)—— 失败是运行时断连/超时,非文件属性;必须用**故障注入**(`.aclose()` 中途取消 + 强制 >60s)证明,详见 §1。

**回放仍需的少量 ground-truth(语义 oracle 的案):** 多数案 oracle 是结构性的(无"找不到" + 有引用页),无需输入;仅大文档语义案(付费 492p、U26 462p 等 ~5–10 条)需"正确答案/页码"。

**隐私分级(用前过滤):** 公开类(年报/arXiv)可作夹具;个人非PII 仅本地;**PII(出生证明等)排除或脱敏 + 同类替代**。脚本按文件名标疑似 PII。

**泛化补充:** 回放是必要非充分;保留 §1 L4 评测层查泛化。

## 5. 修订后的"我需要你提供"(因回放大幅缩小)
原"采集一堆同类文档"→ 现在主要是:
1. **存储访问**:MinIO 公网 endpoint + 凭证(同 Postgres 那样),或允许我在 Railway 内跑回放脚本(MinIO 内网可达)。→ 让脚本能取回原文件。
2. **隐私授权**:是否允许用真实用户文档做**本地**测试夹具?默认排除疑似 PII(我会列清单给你确认)。
3. **少量 ground-truth**:~5–10 个大文档语义案的正确答案/页码(其余结构性 oracle 不需要)。
4. (可选)Phase 2 的扫描件/非拉丁/格式案,若原文件取不到再补同类。

## 4. 执行节奏
1. **先建基线**:在**当前未修复**版本上跑全套 → 记录哪些 FAIL(应大面积 FAIL,尤其 R/P/C)。这是"修复前快照"。
2. 实施 Phase 1 → 重跑 → R/P/Q/C4/L1 应转 PASS。
3. 实施 Phase 2 → C1-C3/X/S 转 PASS。
4. Phase 3 → L3(C3)、L4 评测进一步提升。
5. 每阶段 Group G 必须全绿(回归门)。

---

## 6. 修复前基线快照(已执行 2026-05-24,当前未修复 build)

**Group R(asst=0,故障注入,无需文档):** `backend/tests/test_asst0_cancellation_baseline.py`
`SKIP_INTEGRATION=1 pytest tests/test_asst0_cancellation_baseline.py` → **3 FAILED(符合预期=基线)**
- `test_chat_stream_midstream_cancel_settles_credits` → FAIL:断连后 refund+reconcile 调用数=0(计费泄漏证实)
- `test_chat_stream_midstream_cancel_persists_partial_answer` → FAIL:无 `_persist_partial_on_cancel` seam(数据丢失证实)
- `test_continue_stream_midstream_cancel_settles_credits` → FAIL:continue_stream 同病
> 用 `agen.athrow(asyncio.CancelledError())` 在 token yield 处注入,等价于 Starlette 断连。修复后应转 3 PASSED。

**回放输入可恢复性:** `backend/scripts/replay_cases.py manifest`(只读生产 DB)→
- 真实问题可恢复 **10/10**;文档可还原(storage_key 在)**10/10**;历史答案含 fail_signal **9/10**(U37/VW 那条是"部分成功"案,正则未命中,需细化——不影响主结论)。
- 证明:回放法的**输入(问题)与文件**全部可取回,等拿到 MinIO 访问即可在 `run` 模式自动还原文档→重放→判定不变量。

**结论:** 诊断被独立的可执行测试证实;基线已锁定。修复后重跑这两套即得"前/后"对照。
