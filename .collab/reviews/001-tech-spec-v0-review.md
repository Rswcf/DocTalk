# Review: Tech Spec v0 — DocTalk
REVIEWER: CX (self-review by CC, adversarial mode)
DATE: 2026-02-04
VERDICT: REQUEST_CHANGES

## 总体评价
架构方向正确，选型合理。但有若干关键实现细节缺失，如果不补齐会在开发中卡住。

## 具体问题

### Q1: 前端如何拿到 PDF 文件来渲染？
Tech Spec 没有说明 react-pdf 的 file source。需要一个后端 API 返回 PDF 二进制或 presigned URL。否则前端无法加载文件。

### Q2: bbox 坐标系转换问题
PyMuPDF 的坐标系是左上角原点 (origin top-left)，pdf.js 的默认坐标系也是左上角。但 react-pdf 渲染到 DOM 后有 scale 因子（CSS pixels vs PDF points）。需要明确：
- 后端存的 bbox 是 PDF points 还是 normalized (0-1)？
- 前端如何根据当前缩放比例映射？
- 需要存页面尺寸 (page_width, page_height) 才能做映射。

### Q3: SSE 流中 [ref:X] 可能被 token 切断
LLM 流式输出时，`[ref:1]` 这个字符串可能被拆成 `[ref:` 和 `1]` 两个 token。后端需要一个 buffer 策略来处理跨 token 的引用标记解析。

### Q4: 多轮对话的 token 预算管理
当对话轮次变多，历史消息 + 检索 chunks 可能超过 LLM context window。需要明确：
- 历史消息保留策略（最近 N 轮？token 截断？）
- 每次对话的 token 分配：system prompt + history + retrieved chunks + generation

### Q5: MVP 成本估算缺失
匿名 C 端产品没有成本控制 = 烧钱。需要估算：
- 每次上传的 embedding 成本
- 每次对话的 LLM + embedding 成本
- 是否需要限制每日使用量

### Q6: 前端路由设计未说明
用户打开网站后看到什么？上传后跳转到哪？URL 结构是什么？

### Q7: 数据库 migration 工具未指定
用 raw SQL 还是 Alembic？MVP 也需要 migration 管理。

### Q8: chunks 表缺少 page_width/page_height
bbox 是绝对坐标（PDF points），前端需要知道页面尺寸才能正确定位高亮。应该在 documents 表或单独的 pages 表中存储。

## 建议修改
1. 补充 PDF 文件服务 API（presigned URL 或 proxy）
2. 明确 bbox 坐标系 + 前端映射算法
3. 补充 SSE ref 标记的 buffer 解析逻辑
4. 补充 token 预算管理策略
5. 补充成本估算 + 限流方案
6. 补充前端路由设计
7. 指定 Alembic 做 migration
8. 数据表增加 page dimensions

---END---
