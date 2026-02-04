# Claude Code ↔ Codex 协作协议

## 角色定义

| 角色 | 身份 | 职责 |
|---|---|---|
| **Claude Code** (CC) | 架构师/大脑 | 制定计划、审阅代码方向、回答 Codex 的问题、做技术决策 |
| **Codex** (CX) | 执行者/双手 | 审阅计划、提出质疑、编写代码、构建 codebase、运行测试 |

## 目录结构

```
.collab/
├── PROTOCOL.md          # 本文件 — 协作协议
├── plans/               # CC 发出的计划文档
│   └── 001-tech-spec-v0.md
├── reviews/             # CX 对计划的审阅反馈
│   └── 001-tech-spec-v0-review.md
├── tasks/               # CC 发给 CX 的执行任务
│   ├── current.md       # 当前正在执行的任务
│   └── backlog.md       # 待执行任务列表
├── dialogue/            # 自由对话（问答、讨论）
│   └── 001-topic.md     # 每个话题一个文件
└── archive/             # 已完成的对话和任务
```

## 工作流

### Phase 1: 计划制定与审阅

```
CC 写计划 → plans/xxx.md
         ↓
CX 读计划 → 写审阅 → reviews/xxx-review.md
         ↓
CC 读审阅 → 修改计划 或 在 dialogue/ 中回应
         ↓
循环直到双方达成一致
         ↓
CC 在计划文件顶部标记: STATUS: APPROVED
```

### Phase 2: 任务分发与执行

```
CC 写任务清单 → tasks/current.md
         ↓
CX 读任务 → 执行 → 在任务中标记进度
         ↓
CX 遇到问题 → dialogue/xxx.md 提问
         ↓
CC 读问题 → dialogue/xxx.md 回答
         ↓
CX 继续执行 → 完成后标记 DONE
         ↓
CC 发布下一批任务
```

## 文件格式约定

### 计划文件 (plans/)
```markdown
# Plan: [标题]
STATUS: DRAFT | IN_REVIEW | APPROVED
AUTHOR: CC
DATE: YYYY-MM-DD
VERSION: v0.1

---
[计划内容]
```

### 审阅文件 (reviews/)
```markdown
# Review: [对应计划标题]
REVIEWER: CX
DATE: YYYY-MM-DD
VERDICT: APPROVE | REQUEST_CHANGES | DISCUSS

## 总体评价
[一段话概括]

## 具体问题
### Q1: [问题标题]
[详细描述]

### Q2: ...

## 建议修改
[具体建议]
```

### 任务文件 (tasks/current.md)
```markdown
# Current Tasks
ISSUED_BY: CC
DATE: YYYY-MM-DD

## Task 1: [标题]
- PRIORITY: P0 | P1 | P2
- STATUS: TODO | IN_PROGRESS | DONE | BLOCKED
- DESCRIPTION: [做什么]
- ACCEPTANCE: [怎样算完成]
- FILES: [涉及哪些文件/目录]
- NOTES: [CC 的补充说明]
- CX_NOTES: [CX 执行时的笔记/问题]

## Task 2: ...
```

### 对话文件 (dialogue/)
```markdown
# Dialogue: [话题]
STARTED: YYYY-MM-DD

---

## CX @ 2024-02-04 10:00
[CX 的问题或观点]

---

## CC @ 2024-02-04 10:05
[CC 的回答或决策]

---
```

## 规则

1. **不要直接修改对方的文件** — 用新文件或新段落回应
2. **每次写入后在文件末尾加 `---END---`** — 表示"我写完了，轮到你了"
3. **紧急问题用 `URGENT:` 前缀** — 对方应优先处理
4. **技术决策记录在 dialogue/ 中** — 方便回溯
5. **CC 不直接写代码，CX 不直接做架构决策** — 各司其职，有疑问走对话
