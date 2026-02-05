VERDICT: APPROVE

总体评价
- 改动方向清晰：后端将 bbox 粒度从 block 提升到 line，前端链路同步适配（类型、SSE、store、overlay），并加入了引用去重、TextLayer 样式导入与动画细节。整体语法正确、逻辑闭环、兼容旧数据，未发现冲突或明显边界问题。

逐文件审阅结果
- backend/app/services/parse_service.py
  - 语法/结构：正确。新增 _extract_line_blocks，将行级 bbox（来自 PyMuPDF 的 line bbox）提升到 BlockInfo，清洗与 chunk 逻辑保持一致。
  - 逻辑：clean_text_blocks/header/footer 识别逻辑保持原样；分句、组 chunk、overlap 以及 bbox 归一化正确。_normalize_bbox 输出包含 page,x,y,w,h，且 clamp 处理。
  - 兼容性：_build_block_text_and_size 保留未调用，不影响运行；旧数据不受影响（由后续链路兼容 page 字段缺省）。
  - Edge cases：无文本返回空列表已处理；估算 token、分句等均有合理兜底。

- backend/app/services/chat_service.py
  - 语法/结构：正确。RefParserFSM.feed 引用解析稳定。
  - 逻辑：按页过滤 bboxes（bb.page 缺省时回退 chunk.page_start，同页为空再回退全部）；y,x 排序；前 5 个截断，防止过多高亮；offset 维护合理。
  - 兼容性：旧 chunk 无 page 字段时仍能回退；SSE citation payload 字段与前端匹配。
  - 备注：flush 未累加 char_offset（仅在流末尾 token flush，不影响后续 citation 的 offset）。

- backend/app/services/retrieval_service.py（旁查）
  - 返回 bboxes=ch.bboxes。DB JSONB 列可存 list；虽类型标注为 dict，但运行不受影响。

- frontend/src/components/Chat/ChatPanel.tsx
  - 语法/结构：正确。IIFE 去重（按 refIndex）并渲染 CitationCard；键 key 稳定。
  - 逻辑：去重在展示层完成（store 不变），避免重复卡片；空引用不渲染/或渲染空容器无害。
  - 交互：流式 append 文本/引用，错误与完成状态清理 isStreaming。Enter 发送、textarea 自适应良好。
  - 兼容性：onDone 回调签名少参可用（TS 允许忽略入参）；历史消息加载失败兜底。

- frontend/src/components/PdfViewer/PdfViewer.tsx
  - 语法：正确；引入 react-pdf TextLayer.css 修复文字层泄露。
  - 逻辑：IntersectionObserver + 滚动导航互斥标志避免抖动；onRenderSuccess 记录 page canvas 尺寸；仅在 currentPage 页渲染高亮。
  - 兼容性：无高亮时传 [] 到 overlay；异常/加载显示友好。

- frontend/src/types/index.ts
  - 新增 NormalizedBBox.page?: number，前后端一致，兼容旧数据（page 可缺省）。

- frontend/src/lib/sse.ts
  - CitationPayload.bboxes 同步 page?: number；事件解析与 ChatPanel 回调匹配。
  - 错误处理与 done 事件解析稳健；忽略多余字段（如 citations_count）安全。

- frontend/src/store/index.ts
  - 逻辑：navigateToCitation 过滤 bboxes 为当前页（bb.page ?? citation.page）=== citation.page；设置 currentPage + highlights。
  - 兼容性：旧数据无 page 时兼容；高亮为空安全。
  - 其它：消息增量更新、引用追加逻辑稳定。

- frontend/src/components/PdfViewer/HighlightOverlay.tsx
  - 语法：正确。将多 bbox 合并为 union，左侧蓝色细条 + 极淡背景 + fadeIn 动画。
  - 计算：基于归一化坐标 × 页面尺寸，barLeft 向左偏移并 clamp 至 0，避免越界。
  - 兼容性：高亮为空直接 null；暗色模式使用 dark: 颜色变体。

- frontend/src/app/globals.css
  - 新增 @keyframes fadeIn 与 animate-fadeIn；与 overlay class 对应；暗色/基础样式正常。

发现的问题及修复
- 未发现需要修复的 bug。以下为注意点但不阻塞：
  - backend/app/models/tables.py 中 Chunk.bboxes 类型标注为 dict，实际存入/取出为 list[dict]（JSONB 可存数组，运行不受影响）。如后续启用严格类型检查，可将类型标注从 dict 调整为 Any 或 list[dict]。
  - RefParserFSM.flush 未更新 char_offset，但 flush 时不再产生 citation，不影响 offset 语义。

综上，改动在语法、逻辑与兼容性方面均达标；跨页 bbox 链路（后端过滤 + 前端 store 过滤 + overlay union）完整有效；暗色模式样式有效；高亮为空安全；旧文档兼容良好；_build_block_text_and_size 保留未调用不影响运行。审批通过。