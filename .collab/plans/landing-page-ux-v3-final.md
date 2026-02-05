# DocTalk 登录页 UX 改进计划 v3 (Final)

**日期**: 2026-02-05
**作者**: Claude Code (CC)
**审核**: Codex (CX) - Review #1 & #2
**状态**: 待用户最终审批

---

## 变更日志

| 版本 | 日期 | 变更说明 |
|------|------|---------|
| v1 | 2026-02-05 | 初始计划 |
| v2 | 2026-02-05 | 整合 Codex Review #1 的 10 条改进建议 |
| v3 | 2026-02-05 | 整合 Codex Review #2：AuthModal 移至 P0、优先级微调、技术细节补充 |

---

## Executive Summary

将 DocTalk 从当前的 "无门槛上传" 模式改为 "先体验、后登录" 的分层认证模型：

| 当前状态 | 目标状态 |
|---------|---------|
| 任何人可直接上传 PDF | 上传前必须登录（安全） |
| 无 Demo 体验 | 提供示例 PDF 试用（转化） |
| 跳转 /auth 页面登录 | JIT 模态弹窗登录（体验） |
| localStorage 存储文档列表 | 服务端存储文档列表（持久化） |

**预期收益**：
- 注册转化率 +50-100%
- 付费转化率 +30-50%
- 数据安全合规性 ✓
- 多设备同步 ✓

---

## 最终用户旅程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LANDING PAGE (/)                                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         DocTalk                                       │   │
│  │            与你的 PDF 对话，智能引用，精准定位                        │   │
│  │                                                                       │   │
│  │  🔒 你的文档安全：不用于训练 · 加密存储 · 随时删除  [隐私详情]       │   │
│  │                                                                       │   │
│  │                 ┌────────────────────────────┐                        │   │
│  │  [未登录]       │  ▶ 立即体验示例 PDF        │  ← 主 CTA              │   │
│  │                 └────────────────────────────┘                        │   │
│  │                                                                       │   │
│  │                 或 登录上传你的 PDF →          ← 次级 CTA              │   │
│  │                                                                       │   │
│  │  ────────────────────────────────────────                            │   │
│  │                                                                       │   │
│  │  [🔵 Continue with Google]                                           │   │
│  │  🎁 新用户赠送 50 credits（约 10 次对话）                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  [已登录]                                                             │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │  📁 拖拽 PDF 到此处，或点击选择文件 (主 CTA)                 │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                       │   │
│  │  或 试用示例 →  (次级 CTA)                                           │   │
│  │                                                                       │   │
│  │  ───────────────── 我的文档 ─────────────────                        │   │
│  │  📄 report.pdf         2/5/2026   [Open] [🗑]                        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐
│   DEMO 选择页       │  │   AUTH 模态 (P0)    │  │   文档阅读页        │
│   /demo             │  │   (弹窗)            │  │   /d/{id}           │
│                     │  │                     │  │                     │
│ 选择示例:           │  │  登录以继续         │  │  Chat + PDF Viewer  │
│ • 📊 财报分析       │  │                     │  │  (完整功能)         │
│ • 📄 研究论文       │  │  [Google 登录]      │  │                     │
│ • 📝 合同审查       │  │                     │  │                     │
│                     │  │  🔒 隐私承诺        │  │                     │
│ 5 条消息限制        │  │  🎁 50 credits      │  │                     │
└─────────────────────┘  └─────────────────────┘  └─────────────────────┘
          │                       │
          ▼                       │
┌─────────────────────┐           │
│   DEMO 阅读页       │           │
│   /demo/{sample}    │ ──登录──→─┘
│                     │
│ Chat (5条限制)      │
│ + PDF 示例          │
│                     │
│ 剩余 3/5 条消息     │
│ [登录保存对话]      │
└─────────────────────┘
```

---

## 最终实现优先级

### P0 - MVP 核心（立即实施）

| # | 任务 | 文件 | 工作量 | 说明 |
|---|------|------|--------|------|
| 1 | 后端上传接口 require_auth | `backend/app/api/documents.py` | 低 | 替换 get_current_user_optional |
| 2 | 前端 API 走代理 | `frontend/src/lib/api.ts` | 低 | 敏感接口改 /api/proxy |
| 3 | AuthModal (仅 Google) | `frontend/src/components/AuthModal.tsx` | 中 | 查询参数法触发模态 |
| 4 | 首页动态 CTA | `frontend/src/app/page.tsx` | 中 | 按登录态显示不同 CTA |
| 5 | 隐私微文案组件 | `frontend/src/components/PrivacyBadge.tsx` | 低 | 上传区上方信任标识 |
| 6 | Demo 页 (前端限额) | `frontend/src/app/demo/page.tsx` | 中 | 5 条消息限制 |
| 7 | 简版隐私/条款页 | `frontend/src/app/privacy/page.tsx` | 低 | 最小合规页面 |

### P1 - 增强功能（本周）

| # | 任务 | 文件 | 工作量 |
|---|------|------|--------|
| 1 | 服务端文档列表 API | `backend/app/api/documents.py` | 低 |
| 2 | Email Magic Link | `frontend/src/lib/auth.ts` + 邮件服务 | 中 |
| 3 | 示例库 (3-4 PDF) | `frontend/public/samples/` | 低 |
| 4 | 激励文案组件 | `frontend/src/components/IncentiveBanner.tsx` | 低 |
| 5 | i18n 文本更新 | `frontend/src/i18n/locales/*.json` | 低 |
| 6 | 基础埋点 (PostHog) | `frontend/src/lib/analytics.ts` | 中 |
| 7 | Demo 会话复制到账号 | `frontend/src/app/demo/[sample]/page.tsx` | 中 |

### P2 - 后续迭代

| 任务 | 说明 |
|------|------|
| 服务端 Demo 配额 | sessions 表加 is_demo 字段，防前端绕过 |
| 历史文档迁移提示 | localStorage 检测 + 重新上传引导 |
| Microsoft SSO | Azure AD Provider |
| A/B 测试 | Demo 消息限制 3 vs 5 |
| 高级选项折叠 | 模型选择等移入设置 |
| 拦截路由升级 | AuthModal 从查询参数升级为 @modal 并行路由 |

---

## 技术实现细节

### 1. AuthModal 组件 (P0 版本)

**实现方案**: 查询参数控制（P0 简单起步，P1 可升级为拦截路由）

```tsx
// frontend/src/components/AuthModal.tsx
"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { X } from 'lucide-react';
import { useLocale } from '../i18n';

export function AuthModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLocale();

  const isOpen = searchParams.get('auth') === '1';

  if (!isOpen) return null;

  const handleClose = () => {
    router.back();
  };

  const handleGoogleLogin = () => {
    signIn('google', { callbackUrl: window.location.href.replace('?auth=1', '') });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="auth-modal-title" className="text-xl font-semibold">
            {t('auth.loginToContinue')}
          </h2>
          <button onClick={handleClose} className="p-1 hover:bg-gray-100 rounded">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {t('auth.loginBenefits')}
        </p>

        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300
                     rounded-lg px-4 py-3 hover:bg-gray-50 transition"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">
            🔒 {t('auth.privacyNote')}
          </p>
          <p className="text-xs text-green-600 mt-2">
            🎁 {t('auth.freeCredits')}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**触发方式**:

```tsx
// frontend/src/app/page.tsx (部分)
const handleUploadClick = () => {
  if (status === 'unauthenticated') {
    router.push('?auth=1', { scroll: false });
    return;
  }
  // ... 正常上传逻辑
};
```

**根布局集成**:

```tsx
// frontend/src/app/layout.tsx
import { AuthModal } from '../components/AuthModal';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <Providers>
          {children}
          <AuthModal />
        </Providers>
      </body>
    </html>
  );
}
```

### 2. 后端上传接口改造

```python
# backend/app/api/documents.py

from app.core.deps import get_current_user  # 改用强制版本

@router.post("/upload")
async def upload_document(
    file: UploadFile,
    user: User = Depends(get_current_user),  # 必须登录
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF document. Requires authentication."""
    # user.id 现在保证非空
    document = await doc_service.create_document(
        db=db,
        file=file,
        user_id=user.id,  # 强制关联用户
    )
    return {"documentId": str(document.id)}
```

### 3. 前端 API 代理改造

```typescript
// frontend/src/lib/api.ts

const PROXY_BASE = '/api/proxy';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

// 需要授权的接口走代理
export async function uploadDocument(file: File): Promise<{ documentId: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${PROXY_BASE}/api/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    throw new Error(`Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function getMyDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${PROXY_BASE}/api/documents?mine=1`);
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error('Failed to fetch documents');
  }
  return res.json();
}

// 公开接口可直连
export async function getDocumentStatus(docId: string): Promise<DocumentInfo> {
  const res = await fetch(`${API_BASE}/api/documents/${docId}`);
  // ...
}
```

### 4. 首页动态 CTA

```tsx
// frontend/src/app/page.tsx (部分)
"use client";

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoggedIn = status === 'authenticated';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-2">DocTalk</h1>
      <p className="text-gray-600 mb-8">{t('home.tagline')}</p>

      {/* 隐私微文案 */}
      <PrivacyBadge />

      {isLoggedIn ? (
        // 已登录：显示上传区域
        <>
          <UploadZone onUpload={handleUpload} />
          <Link href="/demo" className="mt-4 text-blue-600 hover:underline">
            {t('home.tryDemo')} →
          </Link>
          <MyDocuments />
        </>
      ) : (
        // 未登录：试用为主，登录为辅
        <>
          <Link
            href="/demo"
            className="bg-blue-600 text-white px-8 py-3 rounded-xl text-lg font-medium
                       hover:bg-blue-700 transition"
          >
            ▶ {t('home.tryDemo')}
          </Link>

          <button
            onClick={() => router.push('?auth=1', { scroll: false })}
            className="mt-4 text-blue-600 hover:underline"
          >
            {t('home.loginToUpload')} →
          </button>

          <div className="mt-8 border-t pt-6">
            <GoogleLoginButton />
            <p className="text-xs text-green-600 mt-2">
              🎁 {t('auth.freeCredits')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
```

### 5. Demo 页面 (前端限额)

```tsx
// frontend/src/app/demo/[sample]/page.tsx
"use client";

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const DEMO_MESSAGE_LIMIT = 5;

export default function DemoPage({ params }: { params: { sample: string } }) {
  const { status } = useSession();
  const router = useRouter();
  const [remaining, setRemaining] = useState(DEMO_MESSAGE_LIMIT);
  const [messages, setMessages] = useState<Message[]>([]);

  const sendMessage = useCallback(async (text: string) => {
    if (remaining <= 0) {
      router.push('?auth=1', { scroll: false });
      return;
    }

    setRemaining((r) => r - 1);
    // ... 发送消息逻辑
  }, [remaining, router]);

  return (
    <div className="flex h-screen">
      {/* 顶部横幅 */}
      <div className="fixed top-0 left-0 right-0 bg-blue-50 border-b p-2 text-center text-sm">
        {status === 'unauthenticated' ? (
          <>
            💡 登录后可保存当前对话、上传你自己的 PDF
            <button
              onClick={() => router.push('?auth=1', { scroll: false })}
              className="ml-2 text-blue-600 font-medium hover:underline"
            >
              登录并保存
            </button>
          </>
        ) : (
          <span className="text-green-600">✅ 已登录 - 对话将自动保存</span>
        )}
      </div>

      {/* Chat Panel */}
      <div className="w-1/2 flex flex-col pt-12">
        <ChatMessages messages={messages} />

        {/* 输入框上方提示 */}
        <div className="px-4 py-2 bg-gray-50 text-sm text-gray-600">
          剩余 {remaining}/{DEMO_MESSAGE_LIMIT} 条消息
          {status === 'unauthenticated' && ' · 登录解锁无限对话'}
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={remaining <= 0}
          placeholder={remaining <= 0 ? '登录以继续对话' : '输入你的问题...'}
        />
      </div>

      {/* PDF Viewer */}
      <div className="w-1/2 border-l">
        <PdfViewer url={`/samples/${params.sample}.pdf`} />
      </div>
    </div>
  );
}
```

---

## 示例 PDF 来源建议

| 类型 | 建议来源 | 版权说明 |
|------|---------|---------|
| 📊 财报 | SEC EDGAR (10-K/10-Q) | 公开政府文件，无版权限制 |
| 📄 研究论文 | arXiv (CC BY 许可) | 检查具体许可证 |
| 📝 合同模板 | 公开 NDA 模板 | 自制或公开许可 |
| 📋 政策文档 | EU AI Act / NIST 指南 | 政府公开文件 |

---

## 埋点方案 (PostHog)

### 关键事件

```typescript
// frontend/src/lib/analytics.ts
import posthog from 'posthog-js';

export const events = {
  CTA_CLICK: 'cta_click',           // { type: 'demo' | 'upload' | 'login' }
  AUTH_MODAL_OPEN: 'auth_modal_open',
  AUTH_SUCCESS: 'auth_success',      // { provider: 'google' | 'email' }
  UPLOAD_ATTEMPT: 'upload_attempt',  // { logged_in: boolean }
  UPLOAD_SUCCESS: 'upload_success',
  DEMO_MESSAGE_SENT: 'demo_message', // { remaining: number }
  DEMO_LIMIT_REACHED: 'demo_limit_reached',
};

export function track(event: string, properties?: Record<string, any>) {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties);
  }
}
```

### 转化漏斗

```
Landing Page Visit
    ↓
CTA Click (demo/upload/login)
    ↓
[Demo] Message Sent (1-5)
    ↓
[Demo] Limit Reached / Auth Modal Open
    ↓
Auth Success
    ↓
Upload Success
```

---

## 文件改动完整清单

### 新增文件

| 路径 | 说明 | 优先级 |
|------|------|--------|
| `frontend/src/components/AuthModal.tsx` | 登录模态 | P0 |
| `frontend/src/components/PrivacyBadge.tsx` | 隐私微文案 | P0 |
| `frontend/src/app/demo/page.tsx` | Demo 选择页 | P0 |
| `frontend/src/app/demo/[sample]/page.tsx` | Demo 阅读页 | P0 |
| `frontend/src/app/privacy/page.tsx` | 简版隐私页 | P0 |
| `frontend/src/app/terms/page.tsx` | 简版条款页 | P0 |
| `frontend/public/samples/*.pdf` | 示例 PDF | P1 |
| `frontend/src/lib/analytics.ts` | 埋点工具 | P1 |
| `frontend/src/components/IncentiveBanner.tsx` | 激励文案 | P1 |

### 修改文件

| 路径 | 改动说明 | 优先级 |
|------|---------|--------|
| `frontend/src/app/page.tsx` | 动态 CTA、移除直接上传 | P0 |
| `frontend/src/app/layout.tsx` | 集成 AuthModal | P0 |
| `frontend/src/lib/api.ts` | 敏感接口走代理 | P0 |
| `backend/app/api/documents.py` | 上传 require_auth、列表 API | P0/P1 |
| `backend/app/schemas/document.py` | DocumentBrief schema | P1 |
| `frontend/src/lib/auth.ts` | 添加 Email Provider | P1 |
| `frontend/src/i18n/locales/*.json` | 新增文本 | P1 |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 上传门槛导致流失 | 15-35% | Demo 体验 + 激励文案 + JIT 模态 |
| Demo 限额阻止转化 | 10-20% | 5 条足够达到 aha moment |
| 前端限额被绕过 | 低 | P2 加服务端配额 |
| Email 送达问题 | 中 | P1 配置 DKIM/SPF，使用 Resend |

---

## 验收标准

### P0 完成标准

- [ ] 未登录用户点击上传 → 弹出登录模态
- [ ] 登录模态 Google SSO 可用
- [ ] Demo 页面可选择示例并对话
- [ ] Demo 对话限制 5 条消息
- [ ] 隐私微文案在上传区上方可见
- [ ] 简版隐私/条款页面可访问
- [ ] 后端上传接口返回 401 给未认证请求

### P1 完成标准

- [ ] 服务端文档列表替代 localStorage
- [ ] Email Magic Link 可用
- [ ] PostHog 事件正常上报
- [ ] 3-4 个示例 PDF 可选
- [ ] 激励文案显示正确

---

## 执行计划

| 阶段 | 时间 | 交付物 |
|------|------|--------|
| P0 实施 | 2-3 天 | AuthModal、API 代理、Demo 页、隐私页 |
| P0 测试 | 1 天 | 端到端流程验证 |
| P1 实施 | 3-4 天 | 文档列表、Email、埋点、示例库 |
| P1 测试 | 1 天 | 功能验证 + 数据验证 |
| 上线观察 | 1 周 | 漏斗数据、调整 |

---

## 下一步

1. **用户审批此计划**
2. 审批通过后，Codex 按 P0 优先级执行
3. 每完成一个模块，CC 验证并提交 PR
4. P0 完成后部署，观察数据
5. 继续 P1 迭代

---

**附: 参考资料**

- v1 计划: `.collab/plans/landing-page-ux-v1.md`
- v2 计划: `.collab/plans/landing-page-ux-v2.md`
- Codex Review #1: `.collab/reviews/landing-page-ux-review-1.md`
- Codex Review #2: `.collab/reviews/landing-page-ux-review-2.md`
