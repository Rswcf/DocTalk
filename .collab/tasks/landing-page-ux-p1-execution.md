# Landing Page UX P1 执行计划

**状态**: 执行中
**执行者**: Codex (CX)
**审核者**: Claude Code (CC)

---

## P1 任务清单

### Task 1: 服务端文档列表 API

**文件**: `backend/app/api/documents.py`

**改动**:
1. 新增 `GET /api/documents` 端点
2. 支持 `?mine=1` 参数返回当前用户文档
3. 返回 DocumentBrief 列表（id, filename, status, created_at）

---

### Task 2: 前端使用服务端文档列表

**文件**: `frontend/src/app/page.tsx`, `frontend/src/lib/api.ts`

**改动**:
1. 在 api.ts 添加 getMyDocuments() 函数
2. 修改 page.tsx 使用服务端列表替代 localStorage（保留 localStorage 作为 fallback）

---

### Task 3: Demo 页面集成真实 PDF 预览

**文件**: `frontend/src/app/demo/[sample]/page.tsx`

**改动**:
1. 集成 PdfViewer 组件替代占位符
2. 添加占位 PDF 文件到 public/samples/

---

### Task 4: 基础埋点 (PostHog)

**文件**: `frontend/src/lib/analytics.ts` (新建)

**改动**:
1. 集成 PostHog SDK
2. 定义关键事件
3. 在关键位置添加埋点

---

### Task 5: 激励文案组件

**文件**: `frontend/src/components/IncentiveBanner.tsx` (新建)

**改动**:
1. 显示 credits 激励信息
2. 在 Demo 页面和登录模态中使用

---

## 执行顺序

1. Task 1 + Task 2（服务端文档列表）
2. Task 3（Demo PDF 预览）
3. Task 4（埋点 - 可选）
4. Task 5（激励文案）
