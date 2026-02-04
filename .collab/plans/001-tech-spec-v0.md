# Plan: Tech Spec v0 — DocTalk 文档智能阅读与定位 Web App
STATUS: IN_REVIEW
AUTHOR: CC
DATE: 2026-02-04
VERSION: v0.1

---

## 一、整体技术架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  PDF Viewer   │  │  Chat Panel  │  │  Doc Mgmt │  │
│  │ (react-pdf)   │◄─┤  (streaming) │  │           │  │
│  │  + highlight  │  │  + citations │  │           │  │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         └─────────┬───────┘                │        │
│              EventBus (Zustand)            │        │
└─────────────────┬──────────────────────────┘        │
                  │ REST + SSE                         │
┌─────────────────▼───────────────────────────────────┐
│                  Backend (FastAPI)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Upload & │ │  Chat &  │ │ Search & │ │ Parse  │ │
│  │ Doc API  │ │ Session  │ │ Retrieve │ │ Worker │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘ │
│       │             │            │            │      │
│  ┌────▼─────────────▼────────────▼────────────▼───┐ │
│  │              Service Layer                      │ │
│  │  DocService / ChatService / RetrievalService    │ │
│  └────┬──────────────┬───────────────┬────────────┘ │
└───────┼──────────────┼───────────────┼──────────────┘
        │              │               │
   ┌────▼────┐   ┌─────▼─────┐  ┌─────▼──────┐
   │PostgreSQL│   │  Qdrant   │  │ Object     │
   │(metadata │   │ (vectors) │  │ Storage    │
   │ sessions │   │           │  │ (PDF files)│
   │ chunks)  │   │           │  │ S3/MinIO   │
   └──────────┘   └───────────┘  └────────────┘
```

---

## 二、前端架构

### 技术选型
| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 14 (App Router)** | SSR 首屏快，API routes 可做 BFF |
| PDF 渲染 | **react-pdf** (pdf.js wrapper) | 成熟、支持文本层、社区活跃 |
| 高亮层 | 自定义 Canvas/SVG overlay | 在 pdf.js textLayer 上叠加高亮矩形 |
| 状态管理 | **Zustand** | 轻量，适合跨组件联动 |
| Chat UI | 自研 (streaming) | SSE 逐 token 渲染，引用卡片内嵌 |
| 样式 | **Tailwind CSS + shadcn/ui** | 快速出 UI，一致性好 |

### 核心联动机制

```
用户提问 → Chat 发送请求 → SSE 流式回答
                              ↓
                     回答中包含 citations[]
                     每个 citation = { chunk_id, page, bbox, text_snippet }
                              ↓
                     Chat 渲染引用卡片（可点击）
                              ↓
                     点击引用 → Zustand dispatch:
                       { action: "NAVIGATE", page, highlights: [bbox] }
                              ↓
                     PDF Viewer 监听 → scrollToPage(page) + renderHighlights(bbox[])
```

**关键状态 (Zustand Store)**:
```typescript
interface DocTalkStore {
  // Document
  documentId: string | null;
  documentStatus: 'idle' | 'uploading' | 'parsing' | 'ready' | 'error';
  totalPages: number;

  // PDF Viewer
  currentPage: number;
  scale: number;
  highlights: Highlight[];  // 当前活跃高亮
  setPage: (page: number) => void;
  setHighlights: (highlights: Highlight[]) => void;

  // Chat
  messages: Message[];
  isStreaming: boolean;
  navigateToCitation: (citation: Citation) => void;
}

interface Citation {
  chunkId: string;
  page: number;
  bboxes: BBox[];      // 页面内矩形坐标 [{x, y, w, h}]
  textSnippet: string;  // 引用原文片段
}
```

### PDF 高亮实现方案
- pdf.js 渲染 canvas 后，在其上叠加一个绝对定位的 SVG/div 层
- 高亮矩形通过 `bbox` 坐标定位（坐标来自后端解析时提取）
- 点击引用时：`pdfViewerRef.scrollTo(page)` + 渲染高亮动画（淡入 → 闪烁 → 常驻）

---

## 三、后端架构

### 技术选型
| 层 | 选型 | 理由 |
|---|---|---|
| Web 框架 | **FastAPI** | 异步、类型安全、SSE 原生支持 |
| 任务队列 | **Celery + Redis** | 文档解析异步执行，避免阻塞 |
| 数据库 | **PostgreSQL** | 结构化数据、JSONB 存 bbox |
| 向量数据库 | **Qdrant** | 轻量自部署、支持 payload filter |
| 对象存储 | **MinIO** (开发) / **S3** (生产) | PDF 原始文件存储 |
| LLM | **Claude API** (claude-sonnet-4-5) | 质量/成本平衡，长上下文支持好 |
| Embedding | **voyage-3** 或 **text-embedding-3-small** | 中英文混合文档效果好 |
| PDF 解析 | **PyMuPDF (fitz)** | 快、准、能提取文本+bbox+表格 |

### 服务模块划分
```
app/
├── api/
│   ├── documents.py    # 上传、状态查询、删除
│   ├── chat.py         # 对话（SSE streaming）
│   └── search.py       # 语义搜索
├── services/
│   ├── doc_service.py       # 文档生命周期管理
│   ├── parse_service.py     # PDF 解析 + 切分
│   ├── embedding_service.py # 向量化
│   ├── retrieval_service.py # 检索 + 重排
│   └── chat_service.py      # LLM 对话编排
├── workers/
│   └── parse_worker.py  # Celery 异步解析任务
├── models/              # SQLAlchemy ORM
├── schemas/             # Pydantic schemas
└── core/
    ├── config.py
    └── deps.py
```

---

## 四、文档解析流程

```
上传 PDF
   │
   ▼
存入 Object Storage + 创建 document 记录 (status=parsing)
   │
   ▼ (Celery async task)
PyMuPDF 逐页提取:
   ├─ 文本块 (text blocks) + bbox 坐标
   ├─ 页面尺寸 (width, height)
   └─ 图片区域标记 (不提取图片内容, MVP 跳过 OCR)
   │
   ▼
文本块合并 & 清洗:
   ├─ 去页眉/页脚 (启发式: 每页相同位置相似文本)
   ├─ 合并跨行断句 (hyphenation repair)
   └─ 表格区域标记 (保留原始布局文本)
   │
   ▼
切分为 chunks (详见切分策略)
   │
   ▼
每个 chunk 调用 Embedding API → 向量化
   │
   ▼
写入 PostgreSQL (chunks 表) + Qdrant (向量)
   │
   ▼
更新 document.status = ready
```

---

## 五、切分策略

### 方案：语义段落 + 滑动窗口混合

**第一层：结构化分段**
- 利用 PyMuPDF 提取的 text block 边界和字号信息
- 识别标题（字号较大 / 加粗）→ 作为 section boundary
- 段落自然边界（两个 text block 之间 spacing > 阈值）

**第二层：大小控制**
- 目标 chunk 大小：**300–500 tokens**（中文约 400–700 字）
- 超过上限的段落按句子边界切分
- 不足下限的相邻段落合并（同一 section 内）

**第三层：重叠窗口**
- 相邻 chunk 间 **50 tokens 重叠**，保证跨段语义不丢失

**每个 chunk 保存的元数据：**
```json
{
  "chunk_id": "uuid",
  "document_id": "uuid",
  "chunk_index": 12,
  "text": "原文内容...",
  "page_start": 45,
  "page_end": 45,
  "bboxes": [
    {"page": 45, "x": 72, "y": 120, "w": 468, "h": 80}
  ],
  "section_title": "Revenue Analysis",
  "token_count": 380
}
```

> **为什么不用 RecursiveCharacterTextSplitter？**
> 财报等文档有明确的结构层级，纯字符切分会破坏段落完整性，影响引用精度。结构化分段 + 大小控制是更好的平衡。

---

## 六、向量检索与重排

### 检索流程

```
用户 query
   │
   ▼
Query Embedding (同一 embedding 模型)
   │
   ▼
Qdrant 向量检索: Top-20 candidates
   │  filter: { document_id: "xxx" }
   │
   ▼
Reranker (Cohere rerank-v3 或 bge-reranker)
   │  输入: query + 20 个 chunk.text
   │  输出: 重排后 Top-5, 每个带 relevance_score
   │
   ▼
阈值过滤: score < 0.3 的丢弃
   │
   ▼
返回 final_chunks[] (带完整 bbox 元数据)
```

### 为什么需要 Reranker？
- Embedding 的向量相似度是粗排，recall 高但 precision 不够
- Reranker 做 cross-attention，能更准确判断 query-chunk 相关性
- 对于"引用精度优先"的产品，reranker 是必要的

### MVP 简化方案
如果成本敏感，MVP 阶段可以：
- 用 Qdrant Top-10 + LLM 自己做 rerank（在 system prompt 中要求只引用最相关的）
- 后续再接入专用 reranker

---

## 七、回答与引用绑定机制

### 核心设计：LLM 输出结构化引用

**System Prompt 关键指令：**
```
你是一个文档分析助手。用户会问关于文档的问题。

规则：
1. 只基于提供的文档片段回答，不要编造信息
2. 回答中必须引用原文，使用 [ref:chunk_id] 标记
3. 如果无法从提供的片段中找到答案，明确告知用户
4. 优先精确引用，宁少勿错

回答格式：
{你的分析和回答，在关键论述后使用 [ref:chunk_id] 标记引用来源}
```

**后端处理流程：**
```
LLM 流式输出
   │
   ▼
后端解析 [ref:chunk_id] 标记
   │
   ▼
替换为完整 citation 对象:
{
  "type": "citation",
  "chunk_id": "xxx",
  "page": 45,
  "bboxes": [...],
  "text_snippet": "原文前50字..."
}
   │
   ▼
SSE 推送给前端:
  - text token → 直接推送
  - [ref:xxx] → 解析后推送 citation event
```

**SSE 事件格式：**
```
event: token
data: {"text": "根据财报显示，"}

event: token
data: {"text": "2023年毛利率为35.2%"}

event: citation
data: {"chunk_id":"abc","page":45,"bboxes":[...],"text_snippet":"毛利率35.2%..."}

event: token
data: {"text": "，同比提升2.1个百分点。"}

event: done
data: {}
```

---

## 八、核心数据表设计

### PostgreSQL

```sql
-- 文档表
CREATE TABLE documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename    VARCHAR(500) NOT NULL,
    file_size   BIGINT NOT NULL,           -- bytes
    page_count  INT,
    storage_key VARCHAR(500) NOT NULL,      -- S3/MinIO key
    status      VARCHAR(20) NOT NULL DEFAULT 'uploading',
                -- uploading | parsing | ready | error
    error_msg   TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 文档段落/chunk 表
CREATE TABLE chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,              -- 在文档中的顺序
    text          TEXT NOT NULL,
    token_count   INT NOT NULL,
    page_start    INT NOT NULL,
    page_end      INT NOT NULL,
    bboxes        JSONB NOT NULL,            -- [{page, x, y, w, h}, ...]
    section_title VARCHAR(500),
    vector_id     VARCHAR(100),              -- Qdrant point id
    created_at    TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, chunk_index)
);
CREATE INDEX idx_chunks_document ON chunks(document_id);

-- 会话表
CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 消息表
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL,        -- user | assistant
    content     TEXT NOT NULL,
    citations   JSONB,                       -- [{chunk_id, page, bboxes, text_snippet}]
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### Qdrant Collection

```json
{
  "collection_name": "doc_chunks",
  "vectors": {
    "size": 1024,
    "distance": "Cosine"
  },
  "payload_schema": {
    "document_id": "keyword",
    "chunk_index": "integer",
    "page_start": "integer"
  }
}
```

每个 point:
```json
{
  "id": "chunk-uuid",
  "vector": [0.012, -0.034, ...],
  "payload": {
    "document_id": "doc-uuid",
    "chunk_index": 12,
    "page_start": 45,
    "text": "原文内容（用于 rerank 时减少回查）"
  }
}
```

---

## 九、关键 API 设计

### 1. 文档上传
```
POST /api/documents/upload
Content-Type: multipart/form-data
Body: file (PDF, max 50MB / 500 pages)

Response 202:
{
  "document_id": "uuid",
  "status": "parsing",
  "filename": "annual_report_2023.pdf"
}
```

### 2. 文档状态查询
```
GET /api/documents/{document_id}

Response 200:
{
  "id": "uuid",
  "filename": "...",
  "status": "ready",
  "page_count": 320,
  "chunk_count": 856,
  "created_at": "..."
}
```

### 3. 文档删除
```
DELETE /api/documents/{document_id}

Response 204
```
后端级联删除：S3 文件 + PG 记录 + Qdrant 向量

### 4. 语义搜索
```
POST /api/documents/{document_id}/search
Body:
{
  "query": "2023年毛利率变化原因",
  "top_k": 5
}

Response 200:
{
  "results": [
    {
      "chunk_id": "uuid",
      "text": "...",
      "page": 45,
      "bboxes": [...],
      "score": 0.87,
      "section_title": "Revenue Analysis"
    }
  ]
}
```

### 5. 对话 (SSE Streaming)
```
POST /api/sessions/{session_id}/chat
Body:
{
  "message": "这份财报中，哪些业务板块的毛利率在下降？"
}

Response: text/event-stream
event: token
data: {"text": "根据财报..."}

event: citation
data: {"chunk_id":"...","page":45,"bboxes":[...],"text_snippet":"..."}

event: done
data: {"message_id": "uuid"}
```

### 6. 创建会话
```
POST /api/documents/{document_id}/sessions

Response 201:
{
  "session_id": "uuid",
  "document_id": "uuid"
}
```

### 7. 获取会话历史
```
GET /api/sessions/{session_id}/messages

Response 200:
{
  "messages": [
    {"role": "user", "content": "...", "created_at": "..."},
    {"role": "assistant", "content": "...", "citations": [...], "created_at": "..."}
  ]
}
```

### 8. 定位跳转（前端为主，API 辅助）
```
GET /api/chunks/{chunk_id}

Response 200:
{
  "chunk_id": "uuid",
  "page_start": 45,
  "bboxes": [...],
  "text": "...",
  "section_title": "..."
}
```

---

## 十、MVP 开发计划（3 周）

### Week 1：基础管线打通
| 天 | 任务 | 产出 |
|---|---|---|
| D1-2 | 项目脚手架：Next.js + FastAPI + Docker Compose (PG/Qdrant/Redis/MinIO) | 可启动的开发环境 |
| D2-3 | PDF 上传 API + MinIO 存储 + 文档状态管理 | 上传可用 |
| D3-4 | PDF 解析 Worker：PyMuPDF 提取文本+bbox → chunk 切分 → 写入 PG | 解析管线可用 |
| D4-5 | Embedding 服务 + Qdrant 写入 | 向量化管线可用 |
| D5 | 语义搜索 API (向量检索，暂不做 rerank) | 搜索 API 可调试 |

**Week 1 里程碑：上传一个 PDF → 解析完成 → 搜索返回相关 chunk + 页码**

### Week 2：对话 + 前端核心
| 天 | 任务 | 产出 |
|---|---|---|
| D1-2 | Chat API：LLM 调用 + 引用解析 + SSE streaming | 对话 API 可用 |
| D2-3 | 前端 PDF Viewer 组件 (react-pdf + 高亮层) | 可渲染 PDF + 手动高亮 |
| D3-4 | 前端 Chat 组件 (流式渲染 + 引用卡片) | 对话 UI 可用 |
| D4-5 | Zustand 联动：点击引用 → PDF 跳转 + 高亮 | **核心体验闭环** |
| D5 | 文档管理页面（上传 + 状态展示 + 列表） | 完整前端流程 |

**Week 2 里程碑：上传 PDF → 提问 → AI 带引用回答 → 点击跳转高亮原文**

### Week 3：打磨 + 部署
| 天 | 任务 | 产出 |
|---|---|---|
| D1 | Reranker 集成 (Cohere API 或 BGE) | 引用精度提升 |
| D2 | 会话历史 + 多轮对话上下文管理 | 追问体验完善 |
| D3 | 错误处理、loading 状态、空状态 | 健壮性 |
| D4 | 部署：Vercel (前端) + Railway/Fly.io (后端) + 托管 PG/Qdrant | 线上可访问 |
| D5 | 端到端测试 + 用 3 份真实文档验证 | **MVP 上线** |

**Week 3 里程碑：可公开访问的 MVP，用真实文档验证核心价值**

---

## 十一、Top 3 技术/产品风险与验证方案

### 风险 1：引用定位精度不够 — bbox 与 PDF 渲染不对齐

**问题**：PyMuPDF 提取的 bbox 坐标与 react-pdf 渲染的文本位置有偏差，导致高亮框"飘了"。

**验证方案**：
- **Week 1 D3 立即验证**：用 3 种典型 PDF（扫描版、文字版、混合版）测试 bbox 提取精度
- PyMuPDF 和 pdf.js 都基于同一坐标系（PDF 原生坐标，左下角原点），理论上对齐
- 如果偏差大 → 备选方案：前端用 pdf.js textLayer 做文本匹配定位（用 chunk.text 在页面 textContent 中搜索），放弃后端 bbox
- **判定标准**：90% 的高亮框能准确覆盖目标文本

### 风险 2：长文档解析耗时过长，用户等待体验差

**问题**：500 页 PDF 解析 + embedding 可能需要 3-5 分钟，用户上传后干等。

**验证方案**：
- **Week 1 D4 测量**：用 500 页 PDF 端到端计时
- 优化手段（按优先级）：
  1. 解析完成的页面立即可搜索（渐进式索引，前端轮询 status）
  2. Embedding 批量调用（batch API），减少网络往返
  3. 并行处理：切分后多线程 embedding
- **目标**：500 页 < 2 分钟；前 50 页 < 20 秒可搜索
- **兜底方案**：MVP 限制 200 页以内

### 风险 3：LLM 不遵守引用格式，输出不带 [ref:chunk_id] 或产生幻觉引用

**问题**：LLM 可能忽略 system prompt 中的引用格式要求，或"编造"一个不存在的 chunk_id。

**验证方案**：
- **Week 2 D1 立即验证**：用 20 个问题测试 Claude 的引用遵从率
- 对策：
  1. System prompt 中用 few-shot example 强化格式
  2. 后端对 LLM 输出的 chunk_id 做**存在性校验**，不存在的引用静默丢弃
  3. 将 chunk_id 简化为数字编号 `[ref:1]`、`[ref:2]`（比 UUID 更容易被 LLM 遵守）
  4. 在 context 中明确标注 `[1] chunk内容...`、`[2] chunk内容...`
- **判定标准**：≥ 80% 的回答包含至少 1 个有效引用（对齐 PRD 的 70% 指标）

---

## 十二、技术决策备忘

| 决策 | 选择 | 备选 | 决策理由 |
|---|---|---|---|
| PDF 渲染 | react-pdf (pdf.js) | @react-pdf-viewer | react-pdf 更轻量、自定义空间大 |
| 向量数据库 | Qdrant | Pinecone / pgvector | 自部署免费、payload filter 好用；pgvector 性能在大量文档时不够 |
| 切分方式 | 结构化段落 | LangChain splitter | 需要保留 bbox 和段落完整性，通用 splitter 做不到 |
| 引用传递 | SSE event 流 | 回答结束后统一返回 | SSE 让前端可以在流式过程中实时展示引用，体验更好 |
| 认证 (MVP) | 暂不做 | NextAuth | MVP 验证价值优先，不做登录 |
| 部署 | Docker Compose → 云平台 | K8s | MVP 阶段无需 K8s 复杂度 |

---

## 十三、对 PRD 开放问题的建议

1. **引用粒度：段落 vs 句子？** → MVP 用段落级（chunk 级），原因：句子级 bbox 提取复杂度高，且段落级已能满足"定位到哪一块"的需求。后续可在段落内做句子高亮。

2. **是否允许匿名使用？** → MVP 允许匿名（无登录），用 localStorage 存 document_id 列表。降低上手门槛，利于验证。

3. **搜索模式 vs 对话模式是否区分？** → MVP 统一为对话模式，搜索作为对话的一种 intent 自动识别。减少 UI 复杂度，用一个输入框解决。

---END---
