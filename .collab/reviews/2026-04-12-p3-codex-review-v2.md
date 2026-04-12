P3 v2审阅结论：需修改。
1) diff：两文件当前为新建未跟踪，`git diff` 无输出；已按文件内容核查。  
2) `JsonLdScript` 为 pure：无 `headers()` 调用、无 `await`、无动态 API，仅导出类型+组件。  
3) `JsonLdData` 覆盖当前实际用法（顶层对象或对象数组）。  
4) P3.1a 外部化 AnalyticsWrapper 对索引基本无影响，但“零SEO影响”建议改为“索引近零影响，可能有轻微CWV波动”。  
5) 必改：plan 第87行仍写“从 headers 读 nonce”；第66行“213处”与“108/41”口径冲突。
