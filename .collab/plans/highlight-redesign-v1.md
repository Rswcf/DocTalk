# Plan: 高亮系统重设计 — 缩小范围 + 优化样式
STATUS: DRAFT
AUTHOR: CC
DATE: 2026-02-05
VERSION: v1

---

## 问题概述

当前高亮覆盖整个 chunk（300-500 tokens，10-25 行），视觉上呈现为一大片黄色方块，无法让用户快速定位具体哪句话被引用。参考网站（如 ChatDoc）几乎不在 PDF 上放置视觉覆盖，PDF 保持完全可读。

## 改进目标

1. **缩小高亮范围**: 只高亮 chunk 的前几行（引导用户找到起始位置），不覆盖整个 chunk
2. **优化高亮样式**: 从「黄色方块覆盖」改为「左侧色条指示器 + 极淡背景」，PDF 文字完全可读
3. **平滑过渡**: 添加短暂的出现动画，而非突兀的静态覆盖

---

## 改动方案

### 改动 1: 后端 — 限制每个 citation 的 bbox 数量

**文件**: `backend/app/services/chat_service.py`

**改动**: 在构建 citation SSE event 时，将 `chunk.bboxes` 截断为前 5 个（约 5 行文本），足以标识引用的起始位置。

**位置**: RefParserFSM 生成 citation event 的地方

```python
# 限制 bboxes 数量，只标识引用起始区域
MAX_CITATION_BBOXES = 5
limited_bboxes = chunk.bboxes[:MAX_CITATION_BBOXES]
```

**理由**:
- 用户只需要知道"从这里开始读"，不需要整个 chunk 都被高亮
- 5 行文本约 50-80 个 token，足够给出上下文定位
- 减少前端渲染的 overlay 元素数量

### 改动 2: 前端 — 高亮样式从「黄色方块」改为「左侧色条 + 极淡背景」

**文件**: `frontend/src/components/PdfViewer/HighlightOverlay.tsx`

**改动**: 重新设计高亮渲染逻辑

**新设计**:
- 计算所有 bboxes 的总包围区域（union bounding box）
- 渲染一个单一的指示器，包含：
  - **左侧色条**: 3px 宽的蓝色竖线，从第一个 bbox 顶部到最后一个 bbox 底部
  - **极淡背景**: `bg-blue-50/15` 覆盖整个区域（几乎不可见，仅作为视觉引导）
  - **无边框**: 去掉 ring
  - **无 mixBlendMode**: 直接用极低不透明度
- 添加 `animate-fadeIn` 动画（CSS @keyframes，0.3s 从透明到目标值）

**参考样式对比**:
```
当前:  每行一个黄色方块 bg-yellow-200/25 ring-1 ring-yellow-400/60 + mixBlendMode multiply
目标:  一个合并区域，左侧 3px 蓝色竖条 + bg-blue-50/15 背景 + fadeIn 动画
```

### 改动 3: 前端 — globals.css 添加 fadeIn 动画

**文件**: `frontend/src/app/globals.css`

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

## 文件清单

| 操作 | 文件 | 改动内容 |
|------|------|---------|
| 改 | `backend/app/services/chat_service.py` | citation bboxes 截断为前 5 个 |
| 改 | `frontend/src/components/PdfViewer/HighlightOverlay.tsx` | 合并 bbox → 左侧色条 + 极淡背景 |
| 改 | `frontend/src/app/globals.css` | 添加 fadeIn 动画 |

---

## 不改的部分

- `parse_service.py`: 保持 line-level bbox 提取（精度是好的，只是不需要全部展示）
- `store/index.ts`: highlights 数据结构不变
- `PdfViewer.tsx`: 传递方式不变
- `ChatPanel.tsx`: citation 去重逻辑保留

---

## 验证

1. 点击 citation → PDF 滚动到对应页 → 只有 5 行区域被标记（而非整段）
2. 高亮样式为左侧蓝色竖条 + 极淡背景 → 文字完全清晰可读
3. 高亮出现时有短暂 fadeIn 动画
4. 已有文档（旧 block-level bboxes）也能正常显示（兼容）
5. 新解析的文档（line-level bboxes）高亮更精确

---END---
