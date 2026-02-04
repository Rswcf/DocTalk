# Task Backlog
ISSUED_BY: CC
DATE: 2026-02-05
STATUS: MVP_COMPLETE

---

## 已完成 Sprints

### Sprint 1: 基础管线打通 — DONE
- Task 1.1: 项目脚手架搭建
- Task 1.2: PDF 上传 + 存储 + 文档状态
- Task 1.3: PDF 解析 Worker
- Task 1.4: Embedding + 向量存储
- Task 1.5: 语义搜索 API

### Sprint 2: 对话 + 前端核心 — DONE
- Task 2.1: Chat API + SSE Streaming
- Task 2.2: 前端 PDF Viewer + 高亮
- Task 2.3: 前端 Chat 组件
- Task 2.4: Zustand 联动闭环
- Task 2.5: 文档管理页面

### Sprint 3: 打磨 + 部署 — DONE
- Task 3.0: Frontend-Backend API + Type 对齐
- Task 3.1: Error Handling + Loading / Empty 状态
- Task 3.2: Git Init + .gitignore + 依赖安装验证
- Task 3.3: 端到端 Smoke Test 脚本
- Task 3.4: 部署 (Vercel + Railway)
- Task 3.5: 端到端验证

---

## 未来增强 (Backlog)

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P1 | Reranker 集成 | 检索后用 cross-encoder 重排，提升引用精准度 |
| P1 | 多轮对话上下文优化 | 更智能的历史消息截断 + 上下文压缩 |
| P2 | 搜索 UI | 前端搜索面板，展示语义搜索结果 |
| P2 | 文档删除 UI | 前端添加删除文档按钮 + 确认弹窗 |
| P2 | 用户认证 | 登录注册，文档归属用户 |
| P3 | 移动端适配 | 响应式布局优化 |
| P3 | 深色模式 | 主题切换 |

---END---
