<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh.md">中文</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

<h1 align="center">DocTalk</h1>

<p align="center">
  <strong>あらゆるドキュメントと対話。出典をハイライト表示する引用付きの回答を取得。</strong>
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT ライセンス" /></a>
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHub Stars" /></a>
  <a href="https://www.doctalk.site/demo"><img src="https://img.shields.io/badge/Live%20Demo-doctalk.site-brightgreen" alt="ライブデモ" /></a>
  <a href="https://github.com/Rswcf/DocTalk/pulls"><img src="https://img.shields.io/badge/PRs-welcome-orange.svg" alt="PR歓迎" /></a>
</p>

<p align="center">
  <a href="https://www.doctalk.site/demo">
    <img src="https://www.doctalk.site/opengraph-image" alt="DocTalk スクリーンショット" width="720" />
  </a>
</p>

---

PDF、Wordドキュメント、PowerPoint、スプレッドシート、または任意のWebページをアップロードし、自然言語で質問できます。DocTalkはAIが生成した回答を番号付き引用（`[1]`、`[2]`）とともに返し、各引用は原文に直接リンクされています。引用をクリックすると、該当箇所がページ上でハイライト表示されます。

## DocTalkの特徴

- **ページハイライト付きの引用回答** — すべての回答が正確な箇所を参照します。引用をクリックすると、該当テキストがハイライトされたページに移動します。
- **マルチフォーマット対応** — PDF、DOCX、PPTX、XLSX、TXT、Markdown、URLインポートに対応。テーブル、スライド、スプレッドシートをすべてサポートしています。
- **3つのAIパフォーマンスモード** — OpenRouter経由で異なるLLMを使用した、クイック・バランス・詳細分析。速度と深度を選択できます。
- **11言語対応** — 英語、中国語、スペイン語、日本語、ドイツ語、フランス語、韓国語、ポルトガル語、イタリア語、アラビア語、ヒンディー語でのUI表示およびAI応答に完全対応。
- **分割ビューリーダー** — ズーム、検索、ドラッグ操作が可能なPDFビューアの横に、サイズ変更可能なチャットパネルを配置。
- **ドキュメントコレクション** — 複数のドキュメントをグループ化し、出典を明示した横断的な質問が可能です。
- **自動要約** — アップロード後、AIがドキュメントの要約と推奨質問を自動生成します。
- **プライバシー重視** — GDPRデータエクスポート、Cookie同意、保存時暗号化、SSRF保護、非rootコンテナ。

<p align="center">
  <a href="https://www.doctalk.site/demo"><strong>ライブデモを試す &rarr;</strong></a>
</p>

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| **フロントエンド** | Next.js 14 (App Router), Auth.js v5, react-pdf v9, Tailwind CSS, Radix UI, Zustand |
| **バックエンド** | FastAPI, Celery, Redis |
| **データベース** | PostgreSQL 16, Qdrant（ベクトル検索） |
| **ストレージ** | MinIO / S3互換 |
| **認証** | Auth.js v5 — Google OAuth, Microsoft OAuth, Emailマジックリンク |
| **決済** | Stripe Checkout + Subscriptions |
| **AI** | OpenRouter — DeepSeek V3.2, Mistral Medium 3.1, Mistral Large 2512 |
| **パーシング** | PyMuPDF, Tesseract OCR, python-docx, python-pptx, openpyxl, LibreOffice |
| **モニタリング** | Sentry, Vercel Analytics |

## アーキテクチャ

```
Browser ──→ Vercel (Next.js) ──→ Railway (FastAPI) ──→ PostgreSQL
                │                       │                Qdrant
                │                       │                Redis
                └── API Proxy ──────────┘                MinIO
                   (JWT注入)
```

**仕組み:** ドキュメントはバウンディングボックス座標付きの150〜300トークンのセグメントに分割され、ベクトル検索のためにQdrantにインデックスされます。質問を投げかけると、関連するチャンクが取得され、出典を引用するよう指示を添えてLLMに送信されます。引用はページ上の正確な位置にマッピングされ、リアルタイムでハイライト表示されます。

詳細な図については [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) をご参照ください。

## クイックスタート

### 前提条件

- Docker & Docker Compose
- Python 3.11+, Node.js 18+
- [OpenRouter](https://openrouter.ai) APIキー
- [Google OAuth 認証情報](https://console.cloud.google.com/)

### セットアップ

```bash
# 1. クローンと設定
git clone https://github.com/Rswcf/DocTalk.git
cd DocTalk
cp .env.example .env   # ご自身のキーで編集してください

# 2. インフラストラクチャの起動
docker compose up -d   # PostgreSQL, Qdrant, Redis, MinIO

# 3. バックエンド
cd backend
pip install -r requirements.txt
python3 -m alembic upgrade head
python3 -m uvicorn app.main:app --reload

# 4. Celery worker（別のターミナルで）
cd backend
OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES python3 -m celery \
  -A app.workers.celery_app worker --loglevel=info -Q default,parse

# 5. フロントエンド（別のターミナルで）
cd frontend
npm install && npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてください。

> `OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES` はmacOSでのみ必要です。

<details>
<summary><strong>環境変数</strong></summary>

### バックエンド (`.env`)

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | はい | PostgreSQL接続文字列 (`postgresql+asyncpg://...`) |
| `OPENROUTER_API_KEY` | はい | OpenRouter APIキー |
| `AUTH_SECRET` | はい | ランダムなシークレット（フロントエンドと共有） |
| `ADAPTER_SECRET` | はい | 内部認証API用シークレット |
| `STRIPE_SECRET_KEY` | いいえ | Stripeシークレットキー |
| `STRIPE_WEBHOOK_SECRET` | いいえ | Stripe Webhook署名シークレット |
| `SENTRY_DSN` | いいえ | エラートラッキング用Sentry DSN |
| `OCR_ENABLED` | いいえ | スキャンPDFのOCRを有効化（デフォルト: `true`） |
| `OCR_LANGUAGES` | いいえ | Tesseract言語コード（デフォルト: `eng+chi_sim`） |

### フロントエンド (`.env.local`)

| 変数 | 必須 | 説明 |
|------|------|------|
| `NEXT_PUBLIC_API_BASE` | はい | バックエンドURL（デフォルト: `http://localhost:8000`） |
| `AUTH_SECRET` | はい | バックエンドの `AUTH_SECRET` と一致させる必要があります |
| `GOOGLE_CLIENT_ID` | はい | Google OAuthクライアントID |
| `GOOGLE_CLIENT_SECRET` | はい | Google OAuthクライアントシークレット |
| `MICROSOFT_CLIENT_ID` | いいえ | Microsoft OAuthクライアントID |
| `MICROSOFT_CLIENT_SECRET` | いいえ | Microsoft OAuthクライアントシークレット |
| `RESEND_API_KEY` | いいえ | マジックリンクメール用Resend APIキー |

</details>

<details>
<summary><strong>プロジェクト構成</strong></summary>

```
DocTalk/
├── backend/
│   ├── app/
│   │   ├── api/            # ルートハンドラ（documents, chat, search, billing, auth, users）
│   │   ├── core/           # 設定、依存関係、SSRF保護、セキュリティログ
│   │   ├── models/         # SQLAlchemy ORMモデル
│   │   ├── schemas/        # Pydantic リクエスト/レスポンススキーマ
│   │   ├── services/       # ビジネスロジック（chat, credits, parsing, retrieval, extractors）
│   │   └── workers/        # Celeryタスク定義
│   ├── alembic/            # データベースマイグレーション
│   ├── seed_data/          # デモ用PDFファイル
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.jsページ
│   │   ├── components/     # Reactコンポーネント
│   │   ├── lib/            # APIクライアント、認証、SSE、ユーティリティ
│   │   ├── i18n/           # 11言語のロケールファイル
│   │   ├── store/          # Zustand状態管理
│   │   └── types/
│   └── public/
├── docs/
│   ├── ARCHITECTURE.md
│   └── PRODUCT_STRATEGY.md
└── docker-compose.yml
```

</details>

## デプロイ

**ブランチ構成:** `main`（開発用） / `stable`（本番用）

| デプロイ先 | 方法 |
|-----------|------|
| **フロントエンド** (Vercel) | `stable` にpush → 自動デプロイ。ルートディレクトリ: `frontend/` |
| **バックエンド** (Railway) | `git checkout stable && railway up --detach` |

Railwayは5つのサービスを実行します: バックエンド、PostgreSQL、Redis、Qdrant、MinIO。

## テスト

```bash
cd backend && python3 -m pytest tests/test_smoke.py -v     # スモークテスト
cd backend && python3 -m pytest -m integration -v           # 統合テスト
cd backend && python3 -m ruff check app/ tests/             # Lint
```

## コントリビューション

コントリビューションを歓迎します。変更したい内容について、まずissueを作成してご相談ください。

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット
4. ブランチにpushしてPull Requestを作成

## ライセンス

[MIT](LICENSE)

---

<p align="center">
  DocTalkが役に立った場合は、スターをいただけると幸いです。プロジェクトの認知度向上に繋がります。
</p>

<p align="center">
  <a href="https://github.com/Rswcf/DocTalk/stargazers"><img src="https://img.shields.io/github/stars/Rswcf/DocTalk?style=social" alt="GitHubでスターする" /></a>
</p>
