# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Mode: Claude Code (CC) + Codex (CX) 协作

本项目采用 **CC 主导 + CX 执行** 的双 AI 协作模式。Claude Code 是架构师和大脑，Codex CLI 是执行者和双手。

### 角色分工

| 角色 | 工具 | 职责 |
|---|---|---|
| **CC (Claude Code)** | 本终端 | 制定计划、技术决策、审阅方向、回答问题、分配任务 |
| **CX (Codex CLI)** | `codex exec` | 审阅计划、编写代码、构建 codebase、运行测试、执行具体开发任务 |

### 如何调用 Codex

使用 `codex exec` 非交互模式：

```bash
codex exec \
  --skip-git-repo-check \
  --full-auto \
  -C /Users/mayijie/Projects/Code/010_DocTalk \
  -o <output-file> \
  "<prompt>"
```

关键参数：
- `--skip-git-repo-check`: 项目初期可能未初始化 git
- `--full-auto`: 允许 Codex 自动执行文件操作
- `-C`: 指定工作目录
- `-o`: 将 Codex 最后一条消息写入文件（用于读取结果）
- 超时建议 300000ms（5 分钟），复杂任务可更长

### 协作流程

#### 1. 计划阶段（Plan）
- CC 写计划 → `.collab/plans/xxx.md`
- 调用 Codex 审阅：prompt 要求读取计划文件并写 review 到 `.collab/reviews/`
- CC 读取 review，修改计划，再让 Codex 二审
- 循环直到 Codex 给出 APPROVE

#### 2. 执行阶段（Execute）
- CC 将任务写入 `.collab/tasks/current.md`
- 调用 Codex 执行具体任务：prompt 中包含任务描述、验收标准、涉及文件
- CC 检查 Codex 产出，必要时追加修正指令

#### 3. 审阅阶段（Review）
- 代码写完后，CC 可以调用 Codex 做自测或让 Codex 审阅自己的代码
- 也可以 CC 直接审阅 Codex 写的代码

### Codex Prompt 编写要点

1. **告诉 Codex 它的角色**：开头说明它是 DocTalk 项目的执行者
2. **指明要读的文件**：明确给出文件路径，不要让它猜
3. **指明要写的文件**：输出结果的路径要明确
4. **给出验收标准**：什么样算完成
5. **一次一个大任务**：不要在一个 prompt 中塞太多不相关的事

### 示例 Prompt

**让 Codex 审阅计划：**
```
你是 DocTalk 项目的 Codex 执行者 (CX)。
请阅读 .collab/plans/002-tech-spec-v1.md，审阅后把反馈写入 .collab/reviews/002-review.md。
格式：VERDICT: APPROVE | REQUEST_CHANGES + 具体问题列表。
```

**让 Codex 执行开发任务：**
```
你是 DocTalk 项目的 Codex 执行者 (CX)。
请阅读 .collab/tasks/current.md 中的 Task 1.1，按照验收标准完成开发。
完成后在 .collab/tasks/current.md 中将 Task 1.1 的 STATUS 改为 DONE，
并在 CX_NOTES 中记录你的实现决策。
```

## 协作文件结构

```
.collab/
├── PROTOCOL.md          # 完整协作协议
├── plans/               # CC 写的计划文档
├── reviews/             # CX 的审阅反馈
├── tasks/
│   ├── current.md       # 当前 sprint 的执行任务
│   └── backlog.md       # 后续任务
├── dialogue/            # CC ↔ CX 讨论记录
└── archive/             # 已完成的历史文档
```

## 项目概述

DocTalk 是一款面向高强度文档阅读者的 Web App，帮助用户在超长 PDF 中通过 AI 对话快速定位关键信息，回答绑定原文引用并实时高亮跳转。

### 技术栈

- **Frontend**: Next.js 14 (App Router) + react-pdf + Zustand + Tailwind + shadcn/ui
- **Backend**: FastAPI + Celery + Redis
- **Database**: PostgreSQL 16 (Alembic migration) + Qdrant (向量)
- **Storage**: MinIO (dev) / S3 (prod)
- **LLM**: Claude Sonnet 4.5 (Anthropic API)
- **Embedding**: text-embedding-3-small (OpenAI, dim=1536)
- **PDF Parse**: PyMuPDF (fitz)

### 核心架构决策

- **bbox 坐标**: 归一化 [0,1], top-left origin, 存于 chunks.bboxes (JSONB)
- **引用格式**: 编号 [1]..[K]，后端 FSM 解析器处理跨 token 切断
- **PDF 文件获取**: presigned URL (不走后端代理)
- **向量维度**: 配置驱动 (EMBEDDING_DIM)，启动时校验 Qdrant collection
- **删除**: 异步 202 + Celery worker
- **认证 (MVP)**: 无登录，UUID 不可猜测 + IP 限流

### 当前完整 Tech Spec

详见 `.collab/plans/002-tech-spec-v1.md` (STATUS: APPROVED)

### 常用开发命令

```bash
# 启动基础设施
docker compose up -d

# 后端
cd backend && uvicorn app.main:app --reload

# 前端
cd frontend && npm run dev

# 数据库迁移
cd backend && alembic upgrade head

# Celery worker
cd backend && celery -A app.workers worker --loglevel=info
```
