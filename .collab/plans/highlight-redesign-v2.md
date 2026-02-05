# Plan: 高亮系统重设计 — 缩小范围 + 优化样式
STATUS: DRAFT
AUTHOR: CC
DATE: 2026-02-05
VERSION: v2 (采纳 CX 审阅反馈)

---

## 问题概述

当前高亮覆盖整个 chunk（300-500 tokens，10-25 行），视觉上呈现为一大片黄色方块。参考网站几乎不在 PDF 上放置视觉覆盖。

## 改进目标

1. **缩小高亮范围**: 只高亮 chunk 在 page_start 页的前几行
2. **优化高亮样式**: 左侧色条指示器 + 极淡背景，PDF 文字完全可读
3. **修复跨页 bug**: 按页过滤 bboxes，避免在错误页面绘制错误坐标

---

## 改动方案

### 改动 1: 前端类型 — NormalizedBBox 添加 page 字段

**文件**: `frontend/src/types/index.ts`

```typescript
export interface NormalizedBBox {
  x: number;
  y: number;
  w: number;
  h: number;
  page?: number;  // 新增：1-based 页码，用于按页过滤
}
```

**文件**: `frontend/src/lib/sse.ts` — CitationPayload.bboxes 同步更新

```typescript
bboxes: { x: number; y: number; w: number; h: number; page?: number }[];
```

### 改动 2: 后端 — 按页过滤后截断 bboxes

**文件**: `backend/app/services/chat_service.py`

**位置**: `RefParserFSM.feed()` 构造 citation event 的分支（约 70-82 行）

**逻辑**:
```python
MAX_CITATION_BBOXES = 5

# 1) 按 page_start 过滤（兼容缺少 page 字段的旧数据）
page_bbs = [
    bb for bb in chunk.bboxes
    if isinstance(bb, dict) and bb.get("page", chunk.page_start) == chunk.page_start
]
# 2) 降级：若过滤结果为空，使用原始 bboxes
if not page_bbs:
    page_bbs = chunk.bboxes
# 3) 截断为前 N 个
limited_bboxes = page_bbs[:MAX_CITATION_BBOXES]
```

然后在 citation event 中使用 `limited_bboxes` 替代 `chunk.bboxes`。

### 改动 3: 前端 store — navigateToCitation 按页过滤

**文件**: `frontend/src/store/index.ts`

**位置**: `navigateToCitation` 函数（约第 69-72 行）

```typescript
navigateToCitation: (citation: Citation) => {
  // 按页过滤 bboxes，只保留当前页的
  const pageBboxes = (citation.bboxes || []).filter(
    (bb: any) => (bb.page ?? citation.page) === citation.page
  );
  set({ currentPage: citation.page, highlights: pageBboxes });
},
```

### 改动 4: 前端 — HighlightOverlay 重设计为左侧色条 + 极淡背景

**文件**: `frontend/src/components/PdfViewer/HighlightOverlay.tsx`

**新渲染逻辑**:
1. 若 `highlights` 为空 → 不渲染
2. 计算 union bounding box: `minX, minY, maxX, maxY`
3. 渲染单一指示器区域:
   - **左侧色条**: 4px 宽，`bg-sky-500`（dark: `bg-sky-400`），100% 不透明，从 union top 到 union bottom
   - **背景**: `bg-sky-500/8`（dark: `bg-sky-300/12`），覆盖整个 union 区域
   - **无边框 ring**
   - **添加 animate-fadeIn 动画**

```tsx
export default function HighlightOverlay({ highlights, pageWidth, pageHeight }: HighlightOverlayProps) {
  if (!highlights || highlights.length === 0) return null;

  // Compute union bounding box
  const minX = Math.min(...highlights.map(b => b.x));
  const minY = Math.min(...highlights.map(b => b.y));
  const maxX = Math.max(...highlights.map(b => b.x + b.w));
  const maxY = Math.max(...highlights.map(b => b.y + b.h));

  const left = minX * pageWidth;
  const top = minY * pageHeight;
  const width = (maxX - minX) * pageWidth;
  const height = (maxY - minY) * pageHeight;

  return (
    <div className="absolute inset-0 pointer-events-none"
         style={{ width: pageWidth, height: pageHeight }}>
      {/* 左侧色条 */}
      <div
        className="absolute bg-sky-500 dark:bg-sky-400 rounded-sm animate-fadeIn"
        style={{ left: left - 6, top, width: 4, height }}
      />
      {/* 极淡背景 */}
      <div
        className="absolute bg-sky-500/8 dark:bg-sky-300/12 rounded-sm animate-fadeIn"
        style={{ left, top, width, height }}
      />
    </div>
  );
}
```

### 改动 5: 前端 — globals.css 添加 fadeIn 动画

**文件**: `frontend/src/app/globals.css`

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}
```

---

## 文件清单

| 操作 | 文件 | 改动内容 |
|------|------|---------|
| 改 | `frontend/src/types/index.ts` | NormalizedBBox 添加 `page?: number` |
| 改 | `frontend/src/lib/sse.ts` | CitationPayload bboxes 类型同步 |
| 改 | `backend/app/services/chat_service.py` | 按页过滤 + 截断 bboxes 为前 5 个 |
| 改 | `frontend/src/store/index.ts` | navigateToCitation 按页过滤 |
| 改 | `frontend/src/components/PdfViewer/HighlightOverlay.tsx` | 合并 bbox → 左侧色条 + 极淡背景 |
| 改 | `frontend/src/app/globals.css` | 添加 fadeIn 动画 |

---

## 不改的部分

- `parse_service.py`: 保持 line-level bbox 提取
- `PdfViewer.tsx`: 传递方式不变
- `ChatPanel.tsx`: citation 去重逻辑保留

---

## 验证

1. 点击 citation → PDF 滚动到对应页 → 只有前几行区域被标记（左侧蓝色竖条 + 极淡背景）
2. 文字完全清晰可读，样式比参考网站更友好
3. 跨页 chunk → 只高亮 page_start 页的 bboxes，不会错绘到其他页
4. 旧文档（block-level bboxes）仍能正常显示
5. 暗色模式下色条和背景有适当对比度
6. 高亮出现时有 0.3s fadeIn 动画

---END---
