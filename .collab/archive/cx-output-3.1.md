I’ve implemented Task 3.1 (Error Handling + Loading/Empty states) across the frontend and updated the task status.

**What Changed**
- Upload page improvements
  - `frontend/src/app/page.tsx:24`: File type and size checks. Show “请上传 PDF 文件” and “文件大小不能超过 50MB”.
  - `frontend/src/app/page.tsx:114`: Show `progressText` even when not uploading (red for errors).
  - `frontend/src/app/page.tsx:73`: Friendlier upload error message: “上传失败，请检查网络或稍后重试”.
- Reading page error handling
  - `frontend/src/app/d/[documentId]/page.tsx:1`: Added `error` state and friendly fallbacks.
  - 404 on `getDocument` → show “文档不存在” with a “返回首页” button.
  - Generic info load failures → show “加载文档信息失败”.
- PDF load failure UX
  - `frontend/src/components/PdfViewer/PdfViewer.tsx:1`: Added `Document`’s `error` prop with “无法加载 PDF，请刷新页面或稍后重试。”.
- Chat error UX
  - `frontend/src/types/index.ts:23`: Added `isError?: boolean` to `Message`.
  - `frontend/src/components/Chat/MessageBubble.tsx:1`: Render error bubbles with red background when `isError`.
  - `frontend/src/components/Chat/ChatPanel.tsx:1`: In `onError`, append an error message bubble and stop streaming to allow retry.
- Error Boundary
  - `frontend/src/components/ErrorBoundary.tsx:1`: Added a simple `ErrorBoundary` class component with “出了点问题” and “刷新页面”.
  - `frontend/src/app/layout.tsx:1`: Wrapped `children` with `ErrorBoundary`.

**Task Status**
- `.collab/tasks/current.md: Task 3.1` is now marked as DONE.

**Notes**
- Loading messages kept as specified: “Loading PDF…” in PdfViewer and “Initializing chat…” in ChatPanel.
- No new dependencies added. Styling uses existing Tailwind classes.