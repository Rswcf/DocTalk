# 更新日志

这里记录 DocTalk 产品的重要变更。

本项目遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
和 [Semantic Versioning](https://semver.org/)。在 1.0 之前，DocTalk 使用
`0.minor.patch` 形式的版本号，例如 `0.2.0`、`0.2.1`。

## [Unreleased]

### 文档
- 在 README、多语言 README、架构文档、RetainPDF 运维文档和 agent 交接指南中补齐
  保留排版 PDF 翻译说明。
- 新增当前 RetainPDF 产品流程、目标语言列表、预览与可选导入行为、套餐/页数/文件
  限制、部署检查清单，以及账单、发票、表单、表格密集型 PDF 的质量边界说明。

## [0.18.4] - 2026-05-24

RAG 检索、OCR 与回答质量整改（分 0.18.2–0.18.4 发布），由重放真实失败用户会话驱动。

### 修复
- 回答现在会在正文中标注准确的页码/幻灯片/工作表编号（而不仅在引用角标里），
  因此"请带页码引用""第 N 页有什么"等问题可正常回答。
- 助手不再拒答简短的关键词式提问（如一个地名或术语），而是检索文档后作答，
  或如实告知"未找到"。
- 助手不再向用户暴露内部术语（"片段""节选""chunk"）或其译法（如西班牙语
  "fragmento"），改为称"文档""正文"或具体页码。
- 扫描件及乱码的非拉丁 PDF（乌尔都语、阿拉伯语等）现在能被正确读取：内嵌字体
  提取为乱码的文档会被识别并用 OCR 重读，从而可被问答，而不再回复"文本是加密的"。

### 新增
- 追溯式、质量感知的 OCR 与自动脚本检测：解析器会标记"存在但乱码"的文本层，
  并根据文档实际脚本（而非 UI 语言）选用正确的语言重新识别。

### 变更
- OCR 改为使用按内容判定的窄语言集，非拉丁文档的提取文本明显更干净（且更快）。

## [0.17.1] - 2026-05-09

### 变更
- 降低公开 Demo 的首次体验阻力：示例文档会自动发送预设问题，并移除文档阅读页的
  阻塞式新手引导遮罩。
- 将 analytics consent banner 从全宽底栏改为紧凑浮层，避免遮挡文档输入框和移动端
  app tab。
- 改进移动端转化路径：`/auth` 首屏优先展示登录表单，并为公开站点 Header 增加紧凑
  移动导航菜单。
- 首页 hero 的核心价值主张现在首屏立即可见，不再等待入场动画 hydration。

## [0.17.0] - 2026-05-09

### 新增
- 新增 canonical `document_elements`，把 heading、paragraph 和已检测表格作为
  一等文档结构保存，避免全文任务继续只依赖任意 chunk window。
- 新增解析阶段的文本 element 生成，以及表格扫描阶段的 table element 生成；table
  element 会记录 table id、provider metadata、confidence 和 layout run 关联。
- 新增 element-aware 上下文选择，用于全文摘要、结构化提取、语义文档对比和
  table-aware retrieval。
- 新增 element 生成、代表性 element 覆盖、extraction/diff element-first context、
  table element 持久化，以及缺少同页 chunk 时表格 evidence fallback 的回归测试。

### 变更
- Chunk RAG 现在更明确地负责普通局部问答和 citation anchor；全文、表格和 diff
  工作流会先使用 canonical document structure 来获得更稳定的覆盖。
- 表格检索不会再因为 parser 没有生成同页 chunk 就丢弃已扫描表格；系统会 fallback
  到同文档 chunk 作为 citation anchor，同时保留 evidence payload 中的表格页码。

## [0.16.0] - 2026-05-09

### 新增
- 新增 Azure AI Document Intelligence `prebuilt-layout` provider，用于
  cloud-first PDF layout 和表格提取；SDK 采用 lazy import，避免本地或生产未配置
  Azure 时影响服务启动。
- 新增 `document_layout_runs` 表，记录 provider 执行、页数/表格数、原始 layout
  payload 的存储 key，以及失败原因。
- 新增 Azure 表格 cell metadata 保存，包括单元格区域、表头行/列、合并单元格 span、
  provider metadata 和 layout run id。
- 新增 Azure 表格映射、Azure 失败 fallback、layout run 记录、跨页续表合并以及 CSV
  转义的回归测试。

### 变更
- 表格扫描 job 现在对原生 PDF 优先使用 Azure layout analysis；当 Azure 凭据、SDK、
  鉴权、超时或服务调用失败时自动 fallback 到 PyMuPDF。
- 表格 artifact 轮询现在会展示使用的 provider，并在 Azure 不可用时显示 fallback
  warning。

## [0.15.0] - 2026-05-09

### 新增
- 新增 chat-native Action Planner，在每次聊天开始时判断用户是在普通问答、总结、
  生成 executive summary、提取关键事实、扫描/导出表格、创建模板、运行模板、做文档
  对比，还是定位引用页码。
- 新增聊天内工具 artifact。后台工具现在可以通过 SSE 推送 `tool_status` 和
  `artifact` 事件，把 artifact metadata 持久化到 `messages.metadata_json`，并通过
  统一的 `/api/document-jobs/{job_id}` 查询状态。
- 新增聊天 artifact card，支持 queued/running/succeeded/failed 状态、结果预览、
  引用按钮、Plus 限制的 CSV 下载入口，以及轮询刷新 job 状态。
- 新增整篇文档所有已检测表格的 Plus+ CSV 合并导出接口。

### 变更
- 文档阅读页现在只保留 Chat 作为主入口。Brief、Extract、Tables、Templates、Diff
  继续作为内部工具能力存在，但主页面不再展示独立的 `Brief` 或 `Extract` 标签。
- 推荐问题 chip 现在可以直接触发聊天内动作，例如“提取表格”和“对比版本”，不再把
  用户引导到新的工作区。

## [0.14.0] - 2026-05-07

### 新增
- 新增聊天回答的 claim-level RAG verification。DocTalk 现在会检查可由文档支持的
  回答是否带引用、引用编号是否对应本轮检索 evidence，以及引用文本是否与回答中的
  具体 claim 有实际重叠。
- 新增内部 `rag_verification_completed` 产品事件，用于持续监控回答质量，同时不通过
  公共 events API 暴露 bbox/chunk 等内部证据细节。
- 追加生成的 continuation response 也会写入同一套 verification reporting，避免长回答
  在质量面板中漏数。
- Admin 后台新增 RAG Quality 面板，展示已评估回答数量、平均验证分、pass/warn/fail
  比例、未引用 claim 数、低重叠引用数、数字不匹配数以及最近验证记录。
- 新增有效引用、缺失引用、无效 ref、未引用 claim、低重叠引用、admin 聚合、
  chat-stream verification event 写入和 continuation verification 的回归测试。

### 变更
- 引用重叠评分现在会先过滤常见英文停用词，避免因为 “the”“and” 等泛词重叠而把
  低相关引用误判为支持了回答中的 claim。
- 数字类 claim 现在要求引用来源上下文包含相同数字 token，避免表格值互相矛盾时
  仅因为实体名称重叠就被误判为通过。

## [0.13.0] - 2026-05-07

### 新增
- 新增确定性的 Query Planner，用于对比、多跳、穷尽扫描和多实体指标问题。计划化
  检索会补充受控子查询 evidence，不再只依赖一次普通 top-k 检索。
- 新增 Collection 对比问题的按文档均衡 evidence 覆盖，避免一个强匹配文档挤掉
  其他需要被比较的文档。
- 新增 query-plan prompt contract，指导模型综合多跳/对比 evidence，同时不会把原始
  planned query 回写进 system prompt。
- 新增 direct vs planned routing、实体/指标拆解、Collection 对比覆盖、计划化纠错
  检索以及 query-plan prompt 注入安全的回归测试。

### 变更
- 表格和数字问题现在会始终尝试 table/lexical evidence 与向量检索并行补充，即使
  vector search 看似足够，也能保留金融类短表格行的召回。

## [0.12.0] - 2026-05-07

### 新增
- 新增面向表格和数字类聊天问题的 table-aware retrieval。当文档已有
  `document_tables` 扫描结果时，匹配表格行会被格式化为可引用 evidence，并优先
  合并到普通向量/lexical 片段之前。
- 新增表格检索专用提示，要求数字回答精确保留行标签、单位、期间和币种。
- 新增结构化表格 evidence 排序、通用表格请求、特定词过滤、表格优先纠错检索、
  金融指标路由和表格 prompt guidance 的回归测试。

### 变更
- 表格/数字问题现在使用更低的 lexical chunk 长度阈值，避免短表格行在回答生成前
  被过滤掉。
- Query Router 现在可识别更多金融指标问题，例如 margin、target price、market cap、
  EBITDA、cash flow、币种和百分比，同时不会把普通页码查询误判为表格问题。

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
