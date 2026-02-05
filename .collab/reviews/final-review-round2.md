VERDICT: APPROVE

逐文件结论
- frontend/src/components/Chat/ChatPanel.tsx：语法正确，IIFE 去重在流式过程中安全，无功能性问题。
- frontend/src/components/PdfViewer/PdfViewer.tsx：语法正确，页面尺寸追踪与可见页监测逻辑合理。
- frontend/src/components/PdfViewer/HighlightOverlay.tsx：存在大数组扩展运算符导致的潜在溢出风险，已修复。
- frontend/src/types/index.ts：类型定义完整且与前后端字段一致，无问题。
- frontend/src/lib/sse.ts：SSE 解析逻辑正确，回调类型与 ChatPanel 使用一致，运行时安全。
- frontend/src/store/index.ts：(bb as any).page 断言使用合理，分页过滤与高亮状态同步正确。
- frontend/src/app/globals.css：Tailwind 用法正确，暗色模式变量与类并用无冲突。
- backend/app/services/parse_service.py：_extract_line_blocks 连字符逻辑与 _build_block_text_and_size 保持一致；其他逻辑健壮。
- backend/app/services/chat_service.py：chunk.bboxes 为 None 时过滤分支安全，排序/截断边界正确。

发现的问题与修复
- 文件：frontend/src/components/PdfViewer/HighlightOverlay.tsx
  - 问题1：对超大数组使用 Math.min/max 的扩展运算符（...highlights.map(...)）有调用参数过多导致的“Maximum call stack size exceeded”风险；且重复 map 多次有不必要的性能开销。
  - 修复：改为单次遍历计算 union bbox，避免扩展运算符与重复 map。
  - 问题2：Tailwind 颜色透明度类使用了 bg-sky-500/8 和 dark:bg-sky-300/12，这些值在 3.4 下并非标准预设，可能不被解析。
  - 修复：改为支持的任意值语法 bg-sky-500/[0.08] 与 dark:bg-sky-300/[0.12]，确保在 v3.4 下稳定生效。
  - 变更位置：frontend/src/components/PdfViewer/HighlightOverlay.tsx

其他重点关注点检查说明
- ChatPanel.tsx IIFE 去重：仅在渲染期执行并且无副作用，流式 token 更新频繁时只是重复计算一次去重（O(n^2) 但 n 很小），不会造成渲染错误；滚动定位在 token 流式期间频繁触发可能略有性能开销，但属可接受范围。
- HighlightOverlay.tsx Math.min/max spread：已修复，避免在超大数组下的参数过多问题，同时减少重复计算。
- chat_service.py bbox 过滤：对 None 使用 (chunk.bboxes or [])，且排序/切片在空列表下安全；page 过滤使用字典取值默认 page_start，不会抛异常。
- store/index.ts (bb as any).page：在 NormalizedBBox.page 可选的前提下，(bb: any) 强转并使用 Nullish 合并判断与 citation.page 对比，逻辑正确；类型层面不会导致运行时错误。
- parse_service.py 连字符逻辑：_extract_line_blocks 的跨行连字符处理与 _build_block_text_and_size 保持一致（末尾连字符 + 下一行首字符为字母/数字则去连字符不加空格，否则保留空格），一致性通过。

备注
- 清单标称“共 10 个”，实际列出 9 个文件；已逐一审阅所列 9 个文件。

结论
- 已修复 HighlightOverlay.tsx 的两处问题，其余文件无需修改，全部通过。