VERDICT: APPROVE

总体评价
- 改动方向正确：前端去重渲染、PDF 高亮的视觉与混合模式、后端行级 bbox 提取、以及隐藏 TextLayer 都解决了原问题，并互不冲突。
- 我在 PdfViewer.tsx 发现并修复了一个路径问题（详见逐文件审阅与修改说明）；其余修改整体合理且健壮。

逐文件审阅结果
- ChatPanel.tsx
  - 去重逻辑：使用 IIFE + Array.filter + findIndex 按 `refIndex` 去重，保留首个引用，逻辑正确且稳定，O(n^2) 在引用量小的场景可接受。代码位置：frontend/src/components/Chat/ChatPanel.tsx:125-142
  - JSX：IIFE 返回元素，所有 JSX 均完整闭合且条件链安全。
  - Edge cases：`m.citations && m.citations.length > 0` 已防御为空/undefined。若出现没有 `refIndex` 的 citation，会被归为相同键值（只保留第一个），但按当前类型约束该情况不应发生。
- HighlightOverlay.tsx
  - 样式合并：`style={{ ...style, mixBlendMode: 'multiply' }}` 正确；`mixBlendMode` 值合法。
  - Tailwind：`bg-yellow-200/25`、`ring-1`、`ring-yellow-400/60` 均为有效类；去掉 `animate-pulse` 与减淡样式使高亮更克制。代码位置：frontend/src/components/PdfViewer/HighlightOverlay.tsx:29-31
  - 交互层：`pointer-events-none` 保证不遮挡文本交互；与后续 z-index 判断一并评估为安全。
- parse_service.py
  - 行级提取：`extract_pages()` 改为每行生成一个 `BlockInfo`，并通过 `_extract_line_blocks()` 实作，bbox 精度显著提升。代码位置：backend/app/services/parse_service.py:64-101, 322-371
  - 连字符处理：与原 `_build_block_text_and_size()` 一致（行尾 `-` 且下一行以字母/数字开头时去掉连字符，不加空格；否则补空格）。一致性良好。
  - 标题检测：由行级数据计算 `median(font_size)` 与 `font_size > median * 1.3`，不会导致误判，反而避免了“块内标题被平均字号稀释”的问题，更准确。
  - Edge cases：空 `lines`、空 `spans`、缺少 `bbox` 的行均已跳过；`detect_scanned` 仍基于文本长度总和，行级拆分不会误伤；页眉/页脚检测基于顶部/底部区域出现频率，行级更细但逻辑不变（阈值仍合理）。
  - 兼容性：保留 `_build_block_text_and_size()` 不影响当前调用链。
- PdfViewer.tsx
  - TextLayer.css 导入路径：原为 `react-pdf/dist/Page/TextLayer.css`，在已安装的 react-pdf@7.7.1 环境下该路径不存在，正确路径为 `react-pdf/dist/esm/Page/TextLayer.css`。我已修复。代码位置：frontend/src/components/PdfViewer/PdfViewer.tsx:5
  - 层级关系：`<HighlightOverlay />` 作为 `<Page />` 的同级后置元素、绝对定位，默认绘制顺序即在上层；TextLayer CSS 不影响 Overlay 的 z-index，且 Overlay `pointer-events-none`，不会遮挡交互。

具体问题
- PdfViewer.tsx CSS 路径与本地 node_modules 不匹配（dist/esm 才存在 TextLayer.css），会导致构建/运行时报错或样式缺失。

建议修改
- 已直接修复 PdfViewer.tsx 的导入路径：
  - 从 `react-pdf/dist/Page/TextLayer.css` 改为 `react-pdf/dist/esm/Page/TextLayer.css`（frontend/src/components/PdfViewer/PdfViewer.tsx:5）。
- 备注：若后续需要注解层，可在顶层（如 `app/layout.tsx`）或组件中按需额外导入 `react-pdf/dist/esm/Page/AnnotationLayer.css`，当前关闭了注解层渲染则无需导入。

已做的修复说明
- 调整 PdfViewer TextLayer 样式导入路径，确保在 react-pdf@7.7.1 下样式文件可解析并隐藏 Text Layer，使文本不泄露到可视层。