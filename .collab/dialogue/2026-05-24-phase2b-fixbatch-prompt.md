# 任务:修复你 review 出的真 map-reduce 4 个 Must-fix(TDD,gpt-5.5/xhigh)

你的 review 在 `.collab/reviews/2026-05-24-phase2b-codex-review.md`。实现修复:每个 Must-fix 先写会 FAIL 的测试,再改到全绿;不破坏既有测试。我随后对抗审+提交(你不能 git)。产品已决定:**summary 场景的引用可以是节/页级,不强求精确到句。**

## Must-fix(全部)
1. **成本闭环:缓存 + 计量。** 
   - 缓存:把 map-reduce summary context **持久化**(建议存进 DocumentBrief,带指纹=document_id+chunk 集指纹/数量+map_reduce prompt version+model)。`get_summary_context` 大文档命中缓存直接复用(不再每次重跑);chunk 变更(重解析)失效。
   - 计量:cache miss 真跑 map/reduce 时,把 map+reduce 的 token 用量计入用户 usage(UsageRecord/ledger),或返回用量让 `chat_service` 并入 reconcile。**不能再出现"18+ 次 LLM 调用既不缓存也不计费"。**
2. **部分失败安全。** map 阶段:显式建 task + `return_exceptions=True` + **全局 deadline**;异常/超时时 **cancel 未完成 task**;**保留成功组**,失败组用 deterministic fallback(代表 chunk)补,而不是整篇退回 representative。
3. **引用精度不造假。** summary-modality 的 retrieval item:标 `retrieval_modality="summary"`,**清空/不输出精确 bbox**,引用展示为节/页范围(`chat_service` 的 citation payload + 前端跳转据此不做假精确高亮;前端无 bbox 时已回退 text-snippet)。不要再用单个 anchor bbox 冒充整组摘要的精确出处。
4. **覆盖度不假阳性。** 分别记录 `target_sections / model_covered_sections / fallback_sections / missing_sections`;**只有模型有效返回或 deterministic fallback 明确填充的节才算 covered**;把 degraded/missing 覆盖信息传给最终 prompt(让答案如实说明哪些节信息有限)。

## Should-fix(尽量一起)
- collection 路径显式 `allow_map_reduce=False`(或 per-doc budget <18),别让单文档 collection 误触发 map-reduce。
- 开头 noisy section(纯数字/单字母/罗马数字)归入 "Front matter"/并入首个有效节,别直接丢。
- map JSON 空内容/解析失败做一次短 retry + 结构化 telemetry。

## 硬约束
- `SKIP_INTEGRATION=1 python3 -m pytest -q` = 0 failed;`ruff check app/ tests/` 干净;不破坏小文档/persisted/element-aware/collection 既有路径与测试。
- map/reduce 测试用注入桩,不连真实 LLM。
- 输出:改了哪些文件/函数、新增测试、测试输出原文、对 cost/latency/缓存键 的说明、自评可否合并。
