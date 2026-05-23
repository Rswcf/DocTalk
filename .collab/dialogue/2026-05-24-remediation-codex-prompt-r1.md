# 角色:对抗式技术评审(adversarial reviewer)

你是 DocTalk 的资深后端/RAG 评审。我(Claude)基于生产数据复盘写了一份工程整改方案,需要你**对抗式评审**——不是盖章,是挑错、质疑优先级、提出更优替代,并最终给出你自己的共识建议。请独立读代码验证我的结论,**不要轻信我的描述**。

## 背景(必读文件)
- 方案草案:`.collab/plans/2026-05-24-doctalk-remediation-plan-v1.md`
- 数据复盘(含 47 用户逐条对话 + 唯一付费用户铁证):`.collab/reviews/2026-05-23-user-funnel-retrospective.md`
- 关键代码:
  - `backend/app/services/chat_service.py`(`chat_stream` 约 802–1418;assistant 落库在 1352;LLM 流 1199–1291;校验/修复 1295–1350)
  - `backend/app/api/chat.py`(SSE 端点,StreamingResponse 386/519)
  - `backend/app/services/corrective_retrieval_service.py`(`_plan_limit` 92;top_k=2/步)
  - `backend/app/services/document_brief_service.py`、`retrieval_service`、`extraction_service`、`query_router`/`query_planner_service`
  - `frontend/src/app/api/proxy/[...path]/route.ts`(maxDuration=60,chat 超时 60000ms)
  - `backend/app/core/config.py`(MODE_MODELS、DEMO_LLM_MODEL=deepseek-v4-flash、文件大小门槛 156-158)

## 核心事实(请独立用代码核实)
1. **asst=0 数据丢失**:4 个用户首条消息有 user 行无 assistant 行,文档均已 ready(7p/127p/216p/demo)。我判断根因=assistant 只在流水线末尾落库,`CancelledError`(BaseException)绕过 `except Exception`,无 `try/finally`/`shield`,断连/60s 超时丢整条 + 不退积分。**请核实:断连真的会丢答案且不退款吗?repair 第二次 LLM 调用是否在落库之前?**
2. **大文档检索**:final ~8–12 chunk,不随文档大小放大,无 rerank/contextual/按页直查。**请核实 top_k 实际数值与召回上限。**

## 请逐项给出立场(同意/反对/修正 + 理由 + 证据)
针对方案的 WS-A(A1–A5)、WS-B(B1–B6)、WS-C(C1–C4)、排序、以及"待辩论的 6 个分歧点",逐条表态。重点回答:
1. **A3(durable streams 后台解耦)现在该做吗**,还是 A1/A2 + 抬高 Vercel 预算就够?给出你的判断和最小可行止血方案。
2. **rerank 选型**:外部 API vs 自托管,结合本项目隐私(用户文档)、SSRF 规则、延迟预算给结论。
3. **Contextual Retrieval 重索引** 是否应优先于 hybrid+rerank?成本/收益。
4. **整篇任务**:RAPTOR vs section map-reduce,选哪个,为什么。
5. **C3 放开外部知识** 是否伤害"可信引用"品牌(`frontend.md` 锁定 RAG-grounded)?如何平衡。
6. 是否**先补埋点**再改。
7. 我**遗漏/搞错**了什么?有没有更高杠杆但我没列的修复?有没有会引入回归/计费错误/安全问题的设计?

## 输出格式
- 「逐项立场」表(项 | 立场 | 理由/证据 | 替代方案)
- 「你发现的方案缺陷/风险」清单(按严重度)
- 「你的共识建议」:最终你主张的优先级与 Phase 1 最小动手范围(具体到文件/函数)
- 「仍存分歧、需 Claude 回应」的点

务必具体、引用文件:行号、可证伪。
