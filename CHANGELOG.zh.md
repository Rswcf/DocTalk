# 更新日志

这里记录 DocTalk 产品的重要变更。

本项目遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
和 [Semantic Versioning](https://semver.org/)。在 1.0 之前，DocTalk 使用
`0.minor.patch` 形式的版本号，例如 `0.2.0`、`0.2.1`。

## [Unreleased]

## [0.11.0] - 2026-05-07

### 变更
- 改进简单双栏 PDF 页面的解析阅读顺序，使左栏正文会先于右栏正文进入 chunk，
  不再按同一行左右交错拼接。
- 改进 chunk 文本拼接：英文 block 边界会保留必要空格，同时继续保持中文相邻字符
  和标点的紧凑拼接。
- 改进 micro-chunk 过滤：短文档不会再被整体过滤成没有任何可检索 chunk。

### 新增
- 新增 parser integrity 回归测试，覆盖双栏阅读顺序、页面中部全宽 block、
  Title Case 正文保留、英文句子边界拼接、短文档和中文标点拼接。

## [0.10.0] - 2026-05-07

### 新增
- 新增聊天检索质量 evaluator，在生成回答前评估普通 RAG 结果，识别空证据、
  精确词覆盖不足、穷尽扫描覆盖不足、向量分数过低、已命中词和缺失词。
- 新增纠错检索路径，用于局部问答、表格/数字问题、引用定位、存在性检查和
  穷尽扫描。该路径保留初始向量结果，再对同一文档范围执行 lexical fallback，
  按 chunk 去重合并，并将证据质量提示注入 prompt。
- 新增单文档和 Collection 的 lexical fallback 检索，基于转义后的 `ILIKE`
  匹配 chunk text 与 section title，并对精确标识符、数字和中文 bigram 进行
  确定性打分。
- 新增 evaluator 决策、纠错检索合并、聊天 prompt 质量提示和摘要路由隔离的
  回归测试。

### 变更
- 普通非摘要聊天现在通过 corrective retrieval wrapper，而不是直接调用一次向量
  检索。全文摘要和集合摘要仍继续使用持久化/代表性的 brief context 路径。

## [0.9.0] - 2026-05-07

### 新增
- 新增解析后持久化的分层 Document Brief。Brief 会保存精简摘要、结构大纲、
  关键要点、事实/数据、建议问题、生成元数据以及代表性 chunk 覆盖范围。
- 新增 `document_briefs` 表和 Celery `default` 队列 brief worker，使 parse
  任务完成时不再在解析任务内部同步执行 LLM 摘要生成。
- 新增 `GET /api/documents/{document_id}/brief`，访问控制与文档接口一致，
  并从 chunk/page/bbox 元数据补全可点击引用。
- 文档阅读页新增与 Chat、Extract 平级的 `Brief` 工作区，展示带引用的
  大纲、要点、事实、建议问题和状态，并支持点击引用跳转原文高亮。
- 新增 brief normalization、legacy summary 镜像、失败隔离、持久化覆盖检索、
  parse-worker 分发、brief API 授权与引用补全等回归测试。

### 变更
- 兼容旧 UI 的 `documents.summary` 与 `documents.suggested_questions` 现在由
  结构化 brief payload 派生。
- 全文总结路由现在优先使用持久化 brief coverage；缺失时再回退到实时代表性
  chunk 选择。

## [0.8.0] - 2026-05-07

### 新增
- 新增面向文档聊天的多标签 Query Router。类似 “summarize this document” 和
  “请总结这篇文档的要点” 的全文总结请求，现在会进入代表性全文摘要上下文路径，
  不再走普通语义 top-8 检索，并用 golden tests 覆盖全部 11 种支持语言。
- 新增代表性摘要上下文选择：按文档顺序覆盖开头、中部、章节变化和结尾，同时跳过
  过短的侧栏/页脚碎片。
- 新增文档集合总结路由：从集合内各文档抽取代表性覆盖片段，而不是用语义 top-k
  命中的零散片段总结整个集合。
- 新增 RAG 路由回归测试，覆盖多语言总结提示、表格/数字问题、存在性检查、
  文档集合对比候选和聊天集成路径。
- 新增 RAG 工作台执行台账，用于持续推进 router、brief、纠错检索、解析、
  表格、planner 和 verifier 阶段。

### 变更
- 全文总结提示现在使用专门的 summary system prompt，避免模型因为上下文是代表性
  摘录就把 ready 文档误判为“不完整文档”。
- 总结类聊天请求现在会预扣更高的 credits 估算值，降低更大代表性上下文带来的
  流式结束后补扣风险。

## [0.7.3] - 2026-05-07

### Changed
- public mobile header 现在将 `Sign Up Free` 作为主入口，Demo 调整为次级路径，
  恢复清晰的注册入口。

### Added
- 新增匿名且带限流的注册漏斗事件，包括 landing CTA 点击、auth modal 打开、
  OAuth provider 点击、email magic-link 结果；不记录邮箱地址或客户端 IP。

## [0.7.2] - 2026-05-07

### Fixed
- 新增 MinIO 后端内部 endpoint 与浏览器可访问 endpoint 的分离配置，使生产上传
  可走 Railway private networking，同时保持文档 presigned URL 可在浏览器访问。
- 当对象存储无法接收文件时，上传和 URL 导入现在会返回结构化
  `STORAGE_UNAVAILABLE`，不再暴露内部 500。

## [0.7.1] - 2026-05-07

### Fixed
- 修复 queued extraction、question-template、document-diff job 返回响应时触发
  async SQLAlchemy lazy-load 的问题，避免用户启动文档工作台异步任务后出现生产
  `HTTP 500`。

## [0.7.0] - 2026-05-07

### Added
- 新增 Pro-only Document Diff 工作流，可对比两份 ready 且属于同一用户的文档。
  报告按新增、删除、修改分组，并提供旧版/新版引用 chip，可跳回对应源文档。
- 新增全局 `/document-diff` 工作台与 Collection 内 Compare 标签，用户可从 dashboard
  或集合工作区启动版本对比。
- 新增 `document_diff` document job 类型、FastAPI 运行/列表/获取/导出接口，
  以及支持 credits 预扣费和实际费用 reconcile 的 Celery worker 任务。

## [0.6.0] - 2026-05-07

### Added
- 文档工作台新增可复用 Question Templates。用户可以创建保存的检查清单，
  在 Plus+ 上对单篇文档运行，并将带引用的答案矩阵导出为 Markdown 或 CSV。
- Pro 支持 Collection 批量模板运行，可对集合中的每份 ready 文档应用同一组
  问题，并展示带引用的答案矩阵。
- 新增 `question_templates` 表、`batch_template` document job 类型、FastAPI
  模板/运行/导出接口，以及用于队列化模板执行和 credits 预扣费/reconcile 的
  Celery worker 任务。

## [0.5.0] - 2026-05-07

### Added
- AI 回复操作区新增单条回答深链分享。回答分享复用现有 session share token，
  并附加稳定 message anchor，让接收者直接定位到对应的带引用回答。
- 公共分享页新增安全 message anchor，并在 URL fragment 命中时高亮目标回答。

### Security
- 公共分享响应继续隐藏 bbox 坐标、chunk id、document id、confidence score 等
  私有引用字段。

## [0.4.0] - 2026-05-07

### Added
- 文档工作台新增 Table Extraction，支持 `Tables` 预览、按需扫描表格、
  PDF `find_tables()`、非 PDF/转换文档的 markdown table fallback，以及 Plus+
  CSV 导出。
- 新增 `document_tables` 表与 `table_scan` document job 类型，为表格提取工作流
  提供可复用基础。
- 新增 FastAPI 表格扫描/列表/导出接口与 Celery table worker 任务。

## [0.3.0] - 2026-05-07

### Added
- 文档阅读页新增 Structured Extraction 工作区，支持 `Chat / Extract` 切换、
  三个带引用的提取模板、异步任务状态、引用跳转以及 Markdown/CSV 导出。
- 新增 `document_jobs` 与 `extraction_results` 表，作为文档工作台后续功能的
  通用异步任务基础。
- 新增 FastAPI 提取接口与 Celery `default` 队列任务，支持 queued extraction
  jobs、预扣费与实际费用 reconcile。
- 新增文档工作台连续交付执行台账。
- 新增自助取消订阅反馈采集，并支持记录可选退款审核请求。
- Pricing 与 Billing 页面新增 7-day fair-use refund review 文案。

### Changed
- 版本元数据升级到 `0.3.0 beta`；版本测试改为根据 `version.json` 推导下一
  个 patch dry-run，不再硬编码旧版本。
- 当前文档已更新为生产聊天模式 DeepSeek V4 Flash/Pro，并标明 Stripe 生产环境已使用 live billing。

## [0.2.0] - 2026-03-15

### Added
- 在 `version.json` 中集中维护产品版本号。
- 为前端和后端暴露统一的运行时发布元数据。
- 新增版本升级脚本与一致性检查脚本，纳入发布流程。
