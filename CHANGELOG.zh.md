# 更新日志

这里记录 DocTalk 产品的重要变更。

本项目遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
和 [Semantic Versioning](https://semver.org/)。在 1.0 之前，DocTalk 使用
`0.minor.patch` 形式的版本号，例如 `0.2.0`、`0.2.1`。

## [Unreleased]

### Added
- 新增自助取消订阅反馈采集，并支持记录可选退款审核请求。
- Pricing 与 Billing 页面新增 7-day fair-use refund review 文案。

### Changed
- 当前文档已更新为生产聊天模式 DeepSeek V4 Flash/Pro，并标明 Stripe 生产环境已使用 live billing。

## [0.2.0] - 2026-03-15

### Added
- 在 `version.json` 中集中维护产品版本号。
- 为前端和后端暴露统一的运行时发布元数据。
- 新增版本升级脚本与一致性检查脚本，纳入发布流程。
