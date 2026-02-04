# Plan: Tech Spec v1 — DocTalk 文档智能阅读与定位 Web App
STATUS: APPROVED
AUTHOR: CC
DATE: 2026-02-04
VERSION: v1.0
CHANGELOG: 修复 CX 审阅中全部 4 个 P0 + 8 个 P1 问题

---

## 一、整体技术架构

```
┌───────────────────────────────────────────────────────┐
│                    Frontend (Next.js 14)               │
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  PDF Viewer   │  │  Chat Panel  │  │  Upload /   │  │
│  │  react-pdf    │◄─┤  SSE stream  │  │  Doc List   │  │
│  │  + highlight  │  │  + inline    │  │             │  │
│  │    overlay    │  │  citations   │  │             │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │
│         └────────┬────────┘                 │         │
│            Zustand Store                    │         │
│                                             │         │
│  Routes: / (upload) → /d/{docId} (viewer+chat)        │
└────────────────┬────────────────────────────┘         │
                 │ REST + SSE                            │
┌────────────────▼──────────────────────────────────────┐
│                 Backend (FastAPI + Celery)              │
│                                                        │
│  API Layer:                                            │
│  ├─ /api/documents/*   (upload, status, delete, file)  │
│  ├─ /api/sessions/*    (create, chat SSE, history)     │
│  ├─ /api/search        (semantic search)               │
│  └─ /api/chunks/{id}   (chunk detail for citation)     │
│                                                        │
│  Service Layer:                                        │
│  ├─ DocService         (lifecycle, file serving)       │
│  ├─ ParseService       (PyMuPDF extract + chunking)    │
│  ├─ EmbeddingService   (vectorize, config-driven dim)  │
│  ├─ RetrievalService   (vector search + rerank)        │
│  └─ ChatService        (LLM call + ref parser FSM)     │
│                                                        │
│  Workers: Celery (parse + embed + delete cleanup)      │
│  Migration: Alembic                                    │
└───┬──────────────┬────────────────┬───────────────────┘
    │              │                │
┌───▼───┐   ┌─────▼─────┐   ┌─────▼──────┐
│Postgres│   │  Qdrant   │   │  MinIO/S3  │
│        │   │ (config-  │   │  (PDF 原件) │
│        │   │  driven   │   │            │
│        │   │  dim)     │   │            │
└────────┘   └───────────┘   └────────────┘
```

---

## 二、前端架构

### 技术选型
| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 14 (App Router)** | SSR 首屏、API routes 做 BFF |
| PDF 渲染 | **react-pdf** (pdf.js) | 成熟、文本层、自定义空间大 |
| 高亮层 | 绝对定位 div overlay | 归一化坐标 × 视口尺寸 = CSS 定位 |
| 状态管理 | **Zustand** | 轻量跨组件联动 |
| Chat UI | 自研 SSE consumer | 流式 token + inline citation |
| 样式 | **Tailwind CSS + shadcn/ui** | 快速一致 |

### 前端路由
```
/                     → 上传页（拖拽/点击上传 PDF）
/d/{documentId}       → 文档阅读页（PDF Viewer + Chat）
```
- 无登录，documentId 存 localStorage 做"我的文档"列表
- URL 即入口，可分享（但文档仅上传者可见的安全性依赖 UUID 不可猜测）

### 核心联动机制

```
用户提问 → POST /api/sessions/{sid}/chat → SSE stream
                                            ↓
              event: token  → 追加文本到消息气泡
              event: citation → 在文本 offset 处插入 [n] 标记
                               + 侧边/底部渲染引用卡片
              event: ping   → keepalive（忽略）
              event: error  → 显示错误信息
              event: done   → 结束 streaming
                                            ↓
              用户点击 [n] 或引用卡片
                                            ↓
              Zustand: navigateToCitation({page, bboxes_normalized})
                                            ↓
              PDF Viewer:
                1. scrollToPage(page)
                2. 计算 overlay 坐标: x_css = bbox.x * viewportWidth
                                      y_css = bbox.y * viewportHeight
                3. 渲染高亮矩形 + 闪烁动画
```

### Zustand Store
```typescript
interface DocTalkStore {
  // Document
  documentId: string | null;
  documentStatus: 'idle' | 'uploading' | 'parsing' | 'embedding' | 'ready' | 'error';
  totalPages: number;
  parseProgress: { pagesParsed: number; chunksIndexed: number }; // 渐进进度

  // PDF Viewer
  currentPage: number;
  scale: number;
  highlights: HighlightRect[];
  pdfUrl: string | null; // presigned URL from backend

  // Chat
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;

  // Actions
  setPage: (page: number) => void;
  navigateToCitation: (citation: Citation) => void;
  pollDocumentStatus: (docId: string) => void;
}

interface Citation {
  refIndex: number;      // [1] [2] 等编号
  chunkId: string;
  page: number;
  bboxes: NormalizedBBox[];  // 归一化坐标 [0,1]
  textSnippet: string;
  offset: number;        // 在回答文本中的字符偏移量
}

interface NormalizedBBox {
  page: number;
  x: number;  // 0-1, 归一化，top-left origin
  y: number;  // 0-1
  w: number;  // 0-1
  h: number;  // 0-1
}
```

### PDF 高亮坐标映射（关键）
```typescript
// 后端存储归一化坐标 [0,1], top-left origin
// 前端映射到 DOM:
function bboxToCSS(bbox: NormalizedBBox, viewport: { width: number; height: number }) {
  return {
    left: bbox.x * viewport.width,
    top: bbox.y * viewport.height,
    width: bbox.w * viewport.width,
    height: bbox.h * viewport.height,
  };
}
// viewport 来自 react-pdf Page 组件的 onRenderSuccess 回调
```

---

## 三、后端架构

### 技术选型（最终确定）
| 层 | 选型 | 配置项 |
|---|---|---|
| Web 框架 | **FastAPI** | uvicorn, CORS middleware |
| 任务队列 | **Celery + Redis** | parse/embed/delete workers |
| 数据库 | **PostgreSQL 16** | Alembic migration |
| 向量数据库 | **Qdrant** | 维度由配置决定 |
| 对象存储 | **MinIO** (dev) / **S3** (prod) | presigned URL |
| LLM | **Claude Sonnet 4.5** | anthropic SDK, streaming |
| Embedding | **text-embedding-3-small** (OpenAI) | dim=1536 |
| Reranker | MVP: LLM 自排; v1.1: Cohere rerank-v3 | |
| PDF 解析 | **PyMuPDF (fitz)** | |
| DB Migration | **Alembic** | |

### 环境配置 (.env)
```env
# Embedding — 模型与维度强绑定
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIM=1536
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=doc_chunks  # 自动创建时带维度校验

# LLM
ANTHROPIC_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-5-20250929
LLM_MAX_CONTEXT_TOKENS=180000

# Object Storage
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=doctalk-pdfs
MINIO_PRESIGN_TTL=300  # seconds

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
EMBED_BATCH_SIZE=64
EMBED_MAX_CONCURRENCY=4

# Limits
MAX_PDF_SIZE_MB=50
MAX_PDF_PAGES=500
MAX_CHAT_HISTORY_TURNS=6
MAX_RETRIEVAL_TOKENS=1750  # 5 chunks × 350 tokens
```

### 服务模块
```
backend/
├── alembic/                 # DB migrations
│   ├── versions/
│   └── env.py
├── app/
│   ├── api/
│   │   ├── documents.py     # upload, status, delete, file(presigned URL)
│   │   ├── chat.py          # SSE streaming chat
│   │   ├── search.py        # semantic search
│   │   └── chunks.py        # chunk detail lookup
│   ├── services/
│   │   ├── doc_service.py
│   │   ├── parse_service.py
│   │   ├── embedding_service.py  # config-driven dim
│   │   ├── retrieval_service.py
│   │   ├── chat_service.py       # LLM + ref parser FSM
│   │   └── storage_service.py    # MinIO/S3 presigned URL
│   ├── workers/
│   │   ├── parse_worker.py
│   │   └── delete_worker.py      # 异步删除
│   ├── models/               # SQLAlchemy ORM
│   ├── schemas/              # Pydantic
│   └── core/
│       ├── config.py         # pydantic-settings, 读 .env
│       └── deps.py
├── requirements.txt
└── Dockerfile
```

---

## 四、文档解析流程

```
上传 PDF
   │
   ▼
POST /api/documents/upload
   ├─ 校验: 文件类型, 大小 ≤ 50MB, 页数 ≤ 500
   ├─ 存入 MinIO (storage_key = documents/{uuid}/{filename})
   ├─ 创建 document 记录: status=uploading → parsing
   └─ dispatch Celery task: parse_and_index(document_id)
   │
   ▼ (Celery Worker)
Step 1: PyMuPDF 逐页提取
   ├─ text blocks + bbox (PDF points, top-left origin)
   ├─ page dimensions: width_pt, height_pt, rotation
   ├─ 扫描版检测: 如果 >70% 的页面文本长度 <50 chars → 标记 error
   │   "该文档为扫描版 PDF，暂不支持。请上传含文本层的 PDF。"
   └─ 更新 document: pages_total=N
   │
   ▼
Step 2: 文本清洗
   ├─ 去页眉/页脚 (启发式: 每页 top/bottom 10% 区域出现频率 >60% 的文本)
   ├─ 合并跨行断句 (连字符修复)
   └─ 每处理完 10 页更新 document.pages_parsed
   │
   ▼
Step 3: 结构化切分
   ├─ 识别标题 (字号 > 中位数 × 1.3 或加粗)
   ├─ 段落边界 (spacing > 阈值)
   ├─ 目标 chunk: 300–500 tokens, 重叠 50 tokens
   ├─ bbox 归一化: x_norm = x_pt / page_width_pt, y_norm = y_pt / page_height_pt
   │   (全部转为 [0,1] 范围, top-left origin)
   └─ 写入 chunks 表 + pages 元数据
   │
   ▼
Step 4: 向量化
   ├─ 批量调用 Embedding API (batch_size=64, concurrency=4)
   ├─ 写入 Qdrant (维度由 EMBEDDING_DIM 配置决定)
   ├─ 每批完成更新 document.chunks_indexed
   └─ 全局速率限制: ≤ 3000 tokens/sec 避免 API 限流
   │
   ▼
Step 5: 完成
   └─ document.status = ready
```

---

## 五、切分策略

### 方案：结构化段落 + 大小控制 + 重叠

**第一层：结构化分段**
- PyMuPDF text block 边界 + 字号信息
- 标题识别: font_size > median_size × 1.3 → section boundary
- 段落边界: block 间距 > line_height × 1.5

**第二层：大小控制**
- 目标: **300–500 tokens** (中文约 400–700 字)
- 超上限: 按句子边界 (。！？；.!?) 切分
- 不足下限: 同 section 内向后合并

**第三层：重叠窗口**
- 相邻 chunk 间 **50 tokens** 重叠

**bbox 归一化存储（数据契约）：**
```json
{
  "chunk_id": "uuid",
  "document_id": "uuid",
  "chunk_index": 12,
  "text": "原文内容...",
  "page_start": 45,
  "page_end": 45,
  "bboxes": [
    {"page": 45, "x": 0.1, "y": 0.15, "w": 0.65, "h": 0.1}
  ],
  "section_title": "Revenue Analysis",
  "token_count": 380
}
```
- **x, y, w, h 全部归一化到 [0, 1]**
- **origin: top-left**
- **相对于页面自然尺寸（旋转前的 width_pt × height_pt）**

---

## 六、向量检索与重排

### 检索流程

```
用户 query
   │
   ▼
Query Embedding (EMBEDDING_MODEL, 同一模型)
   │
   ▼
Qdrant search: top_k=20, filter: { document_id: "xxx" }
   │
   ▼
(MVP) LLM-based rerank:
   将 20 个 chunk 的前 200 chars 附在 system prompt 中
   由 LLM 在回答时自然选择最相关的 (省掉额外 API 调用)
   │
(v1.1) Cohere rerank-v3:
   输入: query + 20 chunk.text → 输出: Top-5 + score
   │
   ▼
阈值过滤: score < 0.3 丢弃 (仅 reranker 模式)
   │
   ▼
取 Top-5 chunks → 编号为 [1]..[5] → 注入 LLM prompt
```

### Embedding 配置驱动（解决维度不匹配问题）
```python
# embedding_service.py
class EmbeddingService:
    def __init__(self, config: Settings):
        self.model = config.EMBEDDING_MODEL
        self.dim = config.EMBEDDING_DIM

    async def ensure_collection(self, qdrant_client):
        """启动时校验/创建 Qdrant collection，维度必须匹配"""
        collections = await qdrant_client.get_collections()
        name = settings.QDRANT_COLLECTION
        if name in [c.name for c in collections.collections]:
            info = await qdrant_client.get_collection(name)
            assert info.config.params.vectors.size == self.dim, \
                f"Collection dim {info.config.params.vectors.size} != config {self.dim}"
        else:
            await qdrant_client.create_collection(
                name, vectors_config=VectorParams(size=self.dim, distance=Distance.COSINE)
            )
```

---

## 七、回答与引用绑定机制（已改为编号引用）

### 核心设计：编号引用 [1]..[K]

**LLM Prompt 模板：**
```
你是一个文档分析助手。基于以下文档片段回答用户问题。

## 文档片段
[1] {chunk_1_text}
[2] {chunk_2_text}
[3] {chunk_3_text}
[4] {chunk_4_text}
[5] {chunk_5_text}

## 规则
1. 只基于以上片段回答，不要编造信息。
2. 在关键论述后用 [n] 标注引用来源（n 为片段编号）。
3. 可以引用多个片段，如 [1][3]。
4. 如果以上片段无法回答问题，直接说"文档中未找到相关信息"。

## 示例
用户：2023年毛利率是多少？
助手：根据财报数据，2023年公司整体毛利率为35.2%[2]，较上年同期提升2.1个百分点。其中，云服务板块毛利率为62.3%[2]，硬件板块毛利率为18.7%[4]。
```

### 后端 SSE 引用解析器（有限状态机）

```python
class RefParserFSM:
    """解析 LLM 流式输出中的 [n] 引用标记"""

    def __init__(self, chunk_map: dict[int, ChunkInfo]):
        self.chunk_map = chunk_map  # {1: ChunkInfo, 2: ChunkInfo, ...}
        self.buffer = ""
        self.char_offset = 0  # 已输出字符数
        self.state = "TEXT"   # TEXT | MAYBE_REF

    def feed(self, token: str) -> list[SSEEvent]:
        events = []
        for char in token:
            if self.state == "TEXT":
                if char == "[":
                    self.state = "MAYBE_REF"
                    self.buffer = "["
                else:
                    events.append(TokenEvent(text=char))
                    self.char_offset += 1

            elif self.state == "MAYBE_REF":
                self.buffer += char
                if char == "]":
                    # 尝试解析 [n]
                    inner = self.buffer[1:-1]
                    if inner.isdigit() and int(inner) in self.chunk_map:
                        ref_num = int(inner)
                        chunk = self.chunk_map[ref_num]
                        events.append(CitationEvent(
                            ref_index=ref_num,
                            chunk_id=chunk.id,
                            page=chunk.page_start,
                            bboxes=chunk.bboxes,
                            text_snippet=chunk.text[:80],
                            offset=self.char_offset,
                        ))
                    else:
                        # 不是有效引用，回退 buffer 为普通文本
                        events.append(TokenEvent(text=self.buffer))
                        self.char_offset += len(self.buffer)
                    self.buffer = ""
                    self.state = "TEXT"
                elif len(self.buffer) > 8:
                    # buffer 过长，不可能是 [n]，回退
                    events.append(TokenEvent(text=self.buffer))
                    self.char_offset += len(self.buffer)
                    self.buffer = ""
                    self.state = "TEXT"

        return events

    def flush(self) -> list[SSEEvent]:
        """流结束时 flush buffer"""
        events = []
        if self.buffer:
            events.append(TokenEvent(text=self.buffer))
        return events
```

### SSE 事件协议（完整）
```
# 文本 token
event: token
data: {"text": "根据财报显示，2023年毛利率为35.2%"}

# 引用（inline 锚点）
event: citation
data: {
  "ref_index": 2,
  "chunk_id": "uuid",
  "page": 45,
  "bboxes": [{"page":45,"x":0.1,"y":0.15,"w":0.65,"h":0.1}],
  "text_snippet": "毛利率35.2%，同比...",
  "offset": 42
}

# 心跳（每 15 秒）
event: ping
data: {}

# 错误
event: error
data: {"code": "LLM_ERROR", "message": "模型服务暂时不可用"}

# 完成
event: done
data: {"message_id": "uuid", "citations_count": 3}
```

---

## 八、核心数据表设计（已补齐 pages + 进度字段）

### PostgreSQL (Alembic managed)

```sql
-- 文档表（增加进度字段 + 细化状态机）
CREATE TABLE documents (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename         VARCHAR(500) NOT NULL,
    file_size        BIGINT NOT NULL,
    page_count       INT,
    storage_key      VARCHAR(500) NOT NULL,
    status           VARCHAR(20) NOT NULL DEFAULT 'uploading',
                     -- uploading | parsing | embedding | ready | error | deleting
    error_msg        TEXT,
    -- 进度追踪
    pages_parsed     INT DEFAULT 0,
    chunks_total     INT DEFAULT 0,
    chunks_indexed   INT DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 页面元数据表（支持 bbox 坐标映射）
CREATE TABLE pages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    page_number   INT NOT NULL,
    width_pt      FLOAT NOT NULL,    -- PDF points (1/72 inch)
    height_pt     FLOAT NOT NULL,
    rotation      INT DEFAULT 0,     -- 0, 90, 180, 270
    UNIQUE(document_id, page_number)
);
CREATE INDEX idx_pages_document ON pages(document_id);

-- 文档段落/chunk 表（bbox 改为归一化坐标）
CREATE TABLE chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index   INT NOT NULL,
    text          TEXT NOT NULL,
    token_count   INT NOT NULL,
    page_start    INT NOT NULL,
    page_end      INT NOT NULL,
    bboxes        JSONB NOT NULL,    -- [{page, x, y, w, h}] 归一化 [0,1]
    section_title VARCHAR(500),
    vector_id     VARCHAR(100),
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

-- 消息表（增加 token 统计）
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role            VARCHAR(10) NOT NULL,     -- user | assistant
    content         TEXT NOT NULL,
    citations       JSONB,                    -- [{ref_index, chunk_id, page, bboxes, text_snippet}]
    prompt_tokens   INT,                      -- LLM 调用统计
    output_tokens   INT,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
```

### Qdrant Collection（配置驱动）
```python
# 启动时由 EmbeddingService.ensure_collection() 自动创建/校验
# collection_name = settings.QDRANT_COLLECTION
# vector_size = settings.EMBEDDING_DIM (从 .env 读取)
# distance = Cosine
# payload index: document_id (keyword), chunk_index (integer)
```

---

## 九、关键 API 设计

### 0. PDF 文件获取（新增，解决 P0）
```
GET /api/documents/{document_id}/file-url

Response 200:
{
  "url": "https://minio.../doctalk-pdfs/documents/uuid/file.pdf?X-Amz-...",
  "expires_in": 300
}
```
- 返回 MinIO/S3 presigned GET URL，TTL 300 秒
- 前端直接传给 react-pdf: `<Document file={url} />`
- CORS: MinIO bucket policy 允许前端域名跨域 + Range 请求

### 1. 文档上传
```
POST /api/documents/upload
Content-Type: multipart/form-data
Body: file (PDF, max 50MB)

Response 202:
{
  "document_id": "uuid",
  "status": "parsing",
  "filename": "annual_report_2023.pdf"
}

Error 400: { "error": "FILE_TOO_LARGE" | "NOT_PDF" | "TOO_MANY_PAGES" }
```

### 2. 文档状态查询（含进度）
```
GET /api/documents/{document_id}

Response 200:
{
  "id": "uuid",
  "filename": "...",
  "status": "embedding",
  "page_count": 320,
  "pages_parsed": 280,
  "chunks_total": 856,
  "chunks_indexed": 640,
  "created_at": "..."
}
```
前端每 2-3 秒轮询，展示进度条。

### 3. 文档删除（改为异步）
```
DELETE /api/documents/{document_id}

Response 202:
{
  "status": "deleting",
  "message": "文档正在删除中"
}
```
后端 dispatch delete_worker:
1. document.status = deleting
2. 删除 Qdrant points (filter: document_id)
3. 删除 MinIO 文件
4. 删除 PG 记录 (CASCADE)
5. 幂等: 重试安全

### 4. 语义搜索
```
POST /api/documents/{document_id}/search
Body: { "query": "2023年毛利率变化原因", "top_k": 5 }

Response 200:
{
  "results": [
    {
      "chunk_id": "uuid",
      "text": "...",
      "page": 45,
      "bboxes": [{"page":45,"x":0.1,"y":0.15,"w":0.65,"h":0.1}],
      "score": 0.87,
      "section_title": "Revenue Analysis"
    }
  ]
}
```

### 5. 创建会话
```
POST /api/documents/{document_id}/sessions
Response 201: { "session_id": "uuid", "document_id": "uuid" }
```

### 6. 对话 (SSE Streaming)
```
POST /api/sessions/{session_id}/chat
Body: { "message": "这份财报中，哪些业务板块的毛利率在下降？" }

Response: text/event-stream
(见第七节 SSE 事件协议)
```

### 7. 获取会话历史
```
GET /api/sessions/{session_id}/messages
Response 200: { "messages": [...] }
```

### 8. Chunk 详情（点击历史引用时获取定位信息）
```
GET /api/chunks/{chunk_id}
Response 200: { "chunk_id", "page_start", "bboxes", "text", "section_title" }
```

---

## 十、Token 预算与多轮上下文管理

### 预算分配 (基于 Claude Sonnet 4.5, 200K context)
```
总预算: 180K tokens (留 20K buffer)

┌─────────────────────────────┐
│ System Prompt    ~500 tokens │
│ Retrieved Chunks ~1750 tokens│  (5 × 350)
│ Chat History    ~4000 tokens │  (最近 6 轮 × ~650)
│ User Message     ~200 tokens │
│ ─────────────────────────── │
│ Generation       ~2000 tokens│
│ Total           ~8450 tokens │
└─────────────────────────────┘
```

### 上下文管理策略
1. **历史消息**: 保留最近 6 轮 (6 user + 6 assistant)
2. **超限截断**: 如果历史 > 4000 tokens，从最早的轮次开始移除
3. **检索片段**: Top-5，每个 ≤ 350 tokens；超限截断到 350
4. **每次调用记录** prompt_tokens + output_tokens 到 messages 表

### 成本估算 (MVP)
| 操作 | 单次成本 | 假设频率 |
|---|---|---|
| 上传 100 页 PDF embedding | ~$0.02 (100K tokens × $0.02/1M) | 每文档一次 |
| 单次对话 (搜索 + LLM) | ~$0.01 (embedding) + ~$0.03 (Claude) = $0.04 | 每问一次 |
| 日均 50 文档 + 500 次对话 | $1 + $20 = ~$21/day | |

### MVP 限流
- 单 IP: 10 文档/天, 100 次对话/天
- 全局: embedding API ≤ 3000 tokens/sec
- 文件: ≤ 50MB, ≤ 500 页

---

## 十一、CORS 与 SSE 部署配置

### FastAPI CORS
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],  # e.g., https://doctalk.vercel.app
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### SSE Response Headers
```python
return StreamingResponse(
    event_generator(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",  # 禁用 Nginx/反代缓冲
        "Connection": "keep-alive",
    }
)
```

### MinIO CORS (bucket policy)
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://doctalk.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Range", "Content-Length"],
    "MaxAgeSeconds": 3600
  }]
}
```

---

## 十二、MVP 开发计划（3 周，已调整）

### Week 1：后端管线 + 核心验证
| 天 | 任务 | 产出 | 验证点 |
|---|---|---|---|
| D1 | Docker Compose 脚手架 (PG/Qdrant/Redis/MinIO) + FastAPI/Alembic 骨架 | 可启动 | `docker compose up` 成功 |
| D2 | Alembic migration + documents/pages/chunks/sessions/messages 建表 | 数据库就绪 | `alembic upgrade head` |
| D2 | PDF 上传 API + MinIO 存储 + presigned URL 接口 | 上传+获取文件 | curl 上传, URL 可下载 |
| D3 | **PyMuPDF 解析 + bbox 归一化 + 扫描版检测** | 解析可用 | **用 3 种 PDF 验证 bbox 精度** |
| D4 | 结构化切分 + Embedding + Qdrant 写入 (配置驱动) | 索引可用 | 500 页 PDF 端到端计时 |
| D5 | 语义搜索 API | 搜索可用 | 20 个 query 验证相关性 |

**Week 1 里程碑 + P0 验证**:
- 上传 PDF → 解析 → 搜索返回 chunk + 归一化 bbox
- bbox 精度: ≥ 90% 准确覆盖
- 500 页解析: < 3 分钟

### Week 2：对话 + 前端闭环
| 天 | 任务 | 产出 | 验证点 |
|---|---|---|---|
| D1 | Chat API + 编号引用 Prompt + RefParserFSM + SSE | 对话可用 | **20 问验证引用率 ≥ 80%** |
| D2 | Next.js 脚手架 + 前端 PDF Viewer (react-pdf + presigned URL) | PDF 可看 | 加载+缩放正常 |
| D3 | 高亮 overlay (归一化 bbox → CSS) + 点击跳转 | 高亮可用 | 手动给 bbox 验证定位 |
| D4 | Chat 组件 (SSE consumer + inline citation + 引用卡片) | 对话 UI | 流式渲染+引用可点击 |
| D5 | Zustand 联动: citation → PDF 跳转高亮 + 上传页面 | **核心闭环** | 端到端体验 |

**Week 2 里程碑**:
- 上传 → 提问 → 带引用回答 → 点击 [n] → PDF 高亮跳转

### Week 3：打磨 + 部署
| 天 | 任务 | 产出 |
|---|---|---|
| D1 | 多轮对话上下文管理 + token 统计 | 追问体验 |
| D2 | 进度轮询 UI + 错误/loading/空状态 + 扫描版提示 | 健壮性 |
| D3 | 异步删除 + IP 限流 (FastAPI middleware) | 安全 |
| D4 | 部署: Vercel + Railway/Fly.io + 托管 PG/Qdrant + MinIO CORS | 上线 |
| D5 | 3 份真实文档端到端验证 + 修 bug | **MVP 上线** |

---

## 十三、Top 3 技术/产品风险与验证方案

### 风险 1：bbox 归一化精度 — 高亮与 PDF 渲染不对齐
**验证**: Week 1 D3，用 3 种 PDF 测试:
- 纯文字版财报 (标准排版)
- 双栏学术论文
- 含旋转页面的合同

**判定**: ≥ 90% 高亮覆盖准确
**备选**: 如果 PyMuPDF bbox 不够准 → 前端用 pdf.js textLayer 做文本匹配定位

### 风险 2：长文档解析耗时
**验证**: Week 1 D4，500 页 PDF 端到端计时
**目标**: < 3 分钟全量; 前 50 页 < 30 秒可搜索
**备选**: MVP 限制 200 页; 渐进式索引让已解析部分先可用

### 风险 3：LLM 引用遵从率不足
**验证**: Week 2 D1，20 个问题测试
**目标**: ≥ 80% 回答含 ≥ 1 个有效引用
**备选**: 更强的 few-shot; 后处理匹配 (文本相似度回溯定位 chunk)

---

## 十四、技术决策备忘

| 决策 | 选择 | 理由 |
|---|---|---|
| PDF 文件获取 | **presigned URL** | 简单、不占后端带宽、支持 Range |
| bbox 存储 | **归一化 [0,1] top-left** | 前端映射简单，scale-independent |
| 引用格式 | **编号 [1]..[K]** | LLM 遵从率高，解析简单 |
| 向量维度 | **配置驱动** | 避免硬编码，模型切换不破坏 |
| SSE 引用解析 | **FSM buffer** | 处理跨 token 切断 |
| 删除 | **异步 202** | 避免超时 |
| Migration | **Alembic** | 标准 Python DB migration |
| MVP 认证 | **无** | UUID 不可猜测 + presigned URL TTL |

---

## 十五、对 PRD 开放问题的最终决策

1. **引用粒度** → 段落级 (chunk 级)，bbox 已可精确到文本块区域
2. **匿名使用** → 允许，UUID 做隐式访问控制，IP 限流防滥用
3. **搜索 vs 对话** → 统一为对话模式，一个输入框

---END---
