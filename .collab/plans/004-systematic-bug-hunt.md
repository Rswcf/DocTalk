# Plan 004: Systematic Bug Hunt

**Author**: Claude Code (CC)
**Date**: 2026-02-05
**Status**: DRAFT

---

## 目标

系统性审查 DocTalk 整个 codebase，找出潜在 bug、安全漏洞、边界情况处理缺失，并逐一修复。

---

## 审查维度

### 1. 安全性 (Security)
- SQL 注入
- JWT 验证绕过
- 敏感信息泄露
- CORS 配置
- 文件上传验证
- API 权限检查

### 2. 正确性 (Correctness)
- 业务逻辑错误
- 数据类型不匹配
- 异步/并发问题
- 事务完整性

### 3. 边界情况 (Edge Cases)
- 空值/null 处理
- 空数组/空列表
- 超大文件/超长文本
- 并发请求

### 4. 错误处理 (Error Handling)
- 异常未捕获
- 错误信息不明确
- 资源泄露（未关闭连接等）

### 5. 一致性 (Consistency)
- API 响应格式
- 前后端契约
- 类型定义同步

---

## 模块划分

将 codebase 划分为可并行审查的模块：

| ID | 模块 | 范围 | 审查重点 |
|----|------|------|----------|
| M1 | Auth Backend | `backend/app/api/auth.py`, `services/auth_service.py`, `core/deps.py` | JWT验证、权限检查、密钥安全 |
| M2 | Credits Backend | `backend/app/api/credits.py`, `services/credit_service.py` | 原子操作、余额计算、并发安全 |
| M3 | Billing Backend | `backend/app/api/billing.py` | Stripe webhook 安全、幂等性 |
| M4 | Chat Backend | `backend/app/api/chat.py`, `services/chat_service.py` | 流式响应、引用解析、错误处理 |
| M5 | Document Backend | `backend/app/api/documents.py`, `services/doc_service.py`, `parse_service.py` | 文件验证、异步任务、状态机 |
| M6 | Frontend Auth | `frontend/src/app/api/auth/`, `lib/authAdapter.ts` | Token 传递、Session 管理 |
| M7 | Frontend Chat | `frontend/src/components/Chat/` | SSE 处理、状态同步、内存泄露 |
| M8 | Frontend PDF | `frontend/src/components/PdfViewer/` | 渲染性能、坐标计算、大文件 |
| M9 | API Proxy | `frontend/src/app/api/proxy/` | 请求转发、错误处理、超时 |
| M10 | Database Models | `backend/app/models/tables.py`, migrations | 约束完整性、索引、类型 |

---

## 协作流程

### Phase 1: 并行审查 (Parallel Review)

CC 同时派发多个 Codex 任务，每个任务审查一个模块：

```
┌─────────────────────────────────────────────────────────────┐
│                         CC (Coordinator)                     │
│                              │                               │
│    ┌─────────────┬───────────┼───────────┬─────────────┐    │
│    ▼             ▼           ▼           ▼             ▼    │
│  CX-M1        CX-M2       CX-M3       CX-M4         CX-M5   │
│  (Auth)      (Credits)   (Billing)   (Chat)        (Docs)   │
│    │             │           │           │             │    │
│    ▼             ▼           ▼           ▼             ▼    │
│  Report       Report      Report      Report        Report  │
└─────────────────────────────────────────────────────────────┘
```

### Phase 2: 汇总分析 (Consolidate)

CC 收集所有审查报告，按严重性分类：

- **P0 (Critical)**: 安全漏洞、数据损坏风险
- **P1 (High)**: 功能错误、明显 bug
- **P2 (Medium)**: 边界情况、错误处理不完善
- **P3 (Low)**: 代码质量、潜在问题

### Phase 3: 逐一修复 (Fix)

按优先级派发修复任务给 Codex，每个修复包含：
- Bug 描述
- 根因分析
- 修复方案
- 验证方法

### Phase 4: 回归验证 (Verify)

- 运行 `npm run build` 验证前端
- 运行 `python3 -c "from app.main import app"` 验证后端
- 运行 `pytest tests/` 验证测试

---

## Codex 审查 Prompt 模板

```markdown
# Bug Hunt: Module {MODULE_NAME}

## 任务
审查以下文件，找出潜在 bug、安全问题、边界情况处理缺失。

## 范围
{FILE_LIST}

## 审查清单
- [ ] 安全性：输入验证、权限检查、敏感信息
- [ ] 正确性：业务逻辑、数据类型、异步处理
- [ ] 边界情况：null/空值、超限值、并发
- [ ] 错误处理：异常捕获、资源清理、错误信息

## 输出格式
对每个发现的问题，按以下格式报告：

### Issue {N}: {简短标题}
- **文件**: {file:line}
- **严重性**: P0/P1/P2/P3
- **类型**: Security/Correctness/EdgeCase/ErrorHandling
- **描述**: {详细描述问题}
- **根因**: {为什么会出现这个问题}
- **建议修复**: {具体的修复方案}

如果没有发现问题，明确说明 "No issues found"。
```

---

## 执行计划

1. **第一批 (Backend Core)**
   - M1: Auth Backend
   - M2: Credits Backend
   - M3: Billing Backend
   - M4: Chat Backend

2. **第二批 (Backend Support)**
   - M5: Document Backend
   - M10: Database Models

3. **第三批 (Frontend)**
   - M6: Frontend Auth
   - M7: Frontend Chat
   - M8: Frontend PDF
   - M9: API Proxy

---

## 预期产出

1. `/.collab/reviews/bug-hunt-report.md` - 汇总所有发现的问题
2. 按优先级修复的代码更改
3. 更新的测试用例（如需要）

---

**Status**: READY FOR EXECUTION
