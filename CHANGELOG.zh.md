# 更新日志

这里记录 DocTalk 产品的重要变更。

本项目遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
和 [Semantic Versioning](https://semver.org/)。在 1.0 之前，DocTalk 使用
`0.minor.patch` 形式的版本号，例如 `0.2.0`、`0.2.1`。

## [Unreleased]

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
