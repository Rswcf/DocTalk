VERDICT: REQUEST_CHANGES

- v2 计划总体方向正确，基本覆盖了 v1 的核心关注：缩小高亮范围（按页过滤 + 截断）、样式更克制（左侧色条 + 极淡背景）、跨页 bug 处理（按 page_start 过滤）、类型与 SSE 对齐，并保留对旧数据的兼容。建议在后端截断前增加“按 y 升序排序”保证“前几行”的语义一致，否则“前 N 个”不一定是页面顶部几行（见下文“遗漏/改进”）。

- 改动 2（后端 bbox 截断）代码位置与精确行号
  - citation 事件构造处起始调用位置：backend/app/services/chat_service.py:70
  - 事件名设置位置（"citation"）：backend/app/services/chat_service.py:72
  - 需要替换为 `limited_bboxes` 的精确行（当前为 `chunk.bboxes`）：backend/app/services/chat_service.py:77

- 改动 4（HighlightOverlay）union bbox 与左侧色条
  - union bbox 计算逻辑正确（minX/minY/maxX/maxY → 像素映射无误）。
  - 风险：`style={{ left: left - 6, width: 4 }}` 在 `minX≈0` 时会把色条绘制到容器外侧（父容器未裁剪 overflow）。建议钳制并避免越界：
    - 将色条定位为 `left: Math.max(0, left - 6)`；或将条置于 union 内侧（比如 `left: Math.max(0, left)`, 再用 `transform: translateX(-6px)` 但同样需要 clamp）。
    - 另外建议也对背景进行 0..pageWidth/pageHeight 的 clamp，防止异常 bbox 溢出。
  - 现有容器写法 `className="absolute inset-0"` 同时又设定了 `style={{ width: pageWidth, height: pageHeight }}`，在当前 PdfViewer 布局下能正常覆盖页面，但二者有一定冗余；保持一致即可，不是阻断问题。

- 改动之间的冲突或遗漏
  - 后端遗漏：建议在截断前按 y（必要时先按 page 再按 y）稳定排序，确保“前几行”确实位于页面顶部。伪码：`page_bbs.sort(key=lambda b: (b.get('page', page_start), b['y'], b['x']))`，再 `[:MAX_CITATION_BBOXES]`。
  - 前端 store 改动与类型改动一致，不冲突；注意 `citation.bboxes` 可能无 `page`，`(bb.page ?? citation.page)` 的降级逻辑合理。
  - SSE 解析与类型：需要将 `frontend/src/lib/sse.ts` 的 `CitationPayload.bboxes` 同步为 `{ x; y; w; h; page?: number }[]`（计划已写），否则 TS 类型与后端不一致。
  - 现有 `frontend/src/components/PdfViewer/HighlightOverlay.tsx` 已存在且按矩形逐个渲染；按计划需改为 union 渲染，注意上述色条越界点。

- 暗色模式 Tailwind 类 bg-sky-300/12 的有效性
  - 有效。项目使用 tailwindcss ^3.4.1，支持斜杠不透明度（任意 0–100 整数），`bg-sky-500/8` 与 `bg-sky-300/12` 都可用。

如采纳以上小改（后端排序 + 前端色条位置 clamp），我对方案执行的可预期性与稳定性有信心。