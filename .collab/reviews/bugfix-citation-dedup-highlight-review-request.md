# Review Request: Bug Fix — 重复引用卡片 + 高亮覆盖文字
REVIEWER: CX
DATE: 2026-02-05
VERDICT: PENDING

## 变更概述

CC 对三个文件做了修改，修复两个 bug：

### Bug 1: 相同引用重复显示 citation 卡片
**文件**: `frontend/src/components/Chat/ChatPanel.tsx`
**改动**: 在渲染 CitationCard 之前按 `refIndex` 去重。用 IIFE + `Array.filter` + `Array.findIndex` 只保留每个 refIndex 的第一个 citation。

### Bug 2a: PDF 高亮样式过于突兀
**文件**: `frontend/src/components/PdfViewer/HighlightOverlay.tsx`
**改动**:
- `bg-yellow-300/40` → `bg-yellow-200/25`（更淡）
- `ring-2 ring-yellow-400` → `ring-1 ring-yellow-400/60`（更细更淡）
- 删除 `animate-pulse`（不再闪烁）
- 添加 `mixBlendMode: 'multiply'`（与背景融合，文字更清晰）

### Bug 2b: bbox 从 block 级提升到 line 级
**文件**: `backend/app/services/parse_service.py`
**改动**:
- `extract_pages()` 不再为每个 PyMuPDF block 创建一个 BlockInfo，而是为每个 **line** 创建一个 BlockInfo
- 新增 `_extract_line_blocks()` 方法，遍历 block 下的 lines，为每行提取独立的 bbox
- 原有的 `_build_block_text_and_size()` 方法不再被 `extract_pages` 调用（但保留以防其他地方使用）
- 下游代码（clean_text_blocks, chunk_document 等）无需改动，因为 BlockInfo 结构不变

## 请 CX 审阅以下重点

1. **ChatPanel.tsx 去重逻辑**: IIFE 写法是否正确？JSX 语法是否完整闭合？
2. **HighlightOverlay.tsx**: `mixBlendMode` 在 style 对象中合并是否正确？`bg-yellow-200/25` 是否为有效的 Tailwind class？
3. **parse_service.py `_extract_line_blocks`**:
   - 连字符处理逻辑是否与原 `_build_block_text_and_size` 一致？
   - line-level 提取是否会导致 heading detection（font_size > median * 1.3）误判？（因为现在每行是独立 block，font_size 是行级而非段落级）
   - `_build_block_text_and_size` 现在不再被 `extract_pages` 调用，是否存在其他调用方？是否应该删除？
4. **整体**: 是否有遗漏的 edge case 或潜在 regression？

---END---
