变更已完成。我已按 1→5 顺序修改并验证前后端语法与构建。

- 前端类型与 SSE 载荷同步了可选 page 字段
- 后端引用事件按页过滤、排序并截断 bboxes
- 前端 store 的 navigateToCitation 仅高亮该页 bboxes
- 重写 HighlightOverlay 为“左侧色条 + 淡背景”的并集高亮
- 添加 fadeIn 动画并通过 Next.js 构建校验

**构建与校验**
- 前端构建：成功运行 `npm run build`（frontend/）
- 后端语法：OK（ast.parse 通过）

**修改文件与关键行**
- frontend/src/types/index.ts:9
- frontend/src/lib/sse.ts:9
- backend/app/services/chat_service.py:70, 71, 72, 78, 80, 81, 89
- frontend/src/store/index.ts:69, 70, 71, 73
- frontend/src/components/PdfViewer/HighlightOverlay.tsx:12, 29
- frontend/src/app/globals.css:39, 43

**已做的具体改动**
- frontend/src/types/index.ts:9
  - 在 NormalizedBBox 增加 `page?: number;`
- frontend/src/lib/sse.ts:9
  - 在 CitationPayload 的 `bboxes` 类型加 `page?: number`
- backend/app/services/chat_service.py:70,71,72,78,80,81,89
  - 在 RefParserFSM.feed() 中构造 citation 前：
    - 按 `page_start` 过滤、按 `y,x` 排序并限制前 5 个
    - 用 `limited_bboxes` 替代原 `chunk.bboxes`
- frontend/src/store/index.ts:69,70,71,73
  - navigateToCitation：仅保留与 `citation.page` 相同页的 bboxes，并设置到 `highlights`
- frontend/src/components/PdfViewer/HighlightOverlay.tsx:12,29
  - 重写组件：对传入 bboxes 取并集区域，渲染左侧指示条与淡背景，使用 `animate-fadeIn`
- frontend/src/app/globals.css:39,43
  - 添加 `@keyframes fadeIn` 与 `.animate-fadeIn` 动画类

需要我提交这些改动，或继续处理下一项工作吗？