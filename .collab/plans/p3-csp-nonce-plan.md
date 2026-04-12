# P3：CSP Nonce 化改造路线图

**状态**：规划（本 PR 仅铺路 + 分析，不完成迁移）
**驱动**：移除 `script-src 'unsafe-inline'` 使 CSP 真正阻止 XSS-via-injected-script
**阻塞**：Next.js 14 nonce 机制与**静态渲染**不兼容（`headers()` 在页面触发动态渲染）

---

## 一、现状扫描

- **CSP 当前状态**（`frontend/next.config.mjs`）：
  - `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://*.sentry-cdn.com https://www.googletagmanager.com`
  - `style-src 'self' 'unsafe-inline'`
- **需要 nonce 的 inline script 位置**（精确口径，`grep application/ld+json` + AnalyticsWrapper）：
  - `AnalyticsWrapper.tsx` — GA4 init script（**1 处，唯一真正可执行的 inline JS**）
  - SEO 页面 JSON-LD — **~108 处跨 41 个文件**（`blog/`, `use-cases/*`, `alternatives/*`, `compare/*`, `features/*`, `tools/*`, `pricing/`, `about/`, `terms/`, `privacy/`, `contact/`, `demo/` 等）
  - JSON-LD 是 `type="application/ld+json"` 数据脚本（浏览器不执行，但 CSP `script-src` 仍适用）

## 二、三种方案对比

### A. 全量 nonce（每请求生成 + 动态渲染）

```
middleware → crypto.randomUUID() → x-nonce header
             → CSP: script-src 'strict-dynamic' 'nonce-xxx' https://trusted.com
layout.tsx (async) → headers() → nonce 传给所有 script
```

- ✅ 真正阻止 `script-src 'unsafe-inline'` 类攻击
- ❌ **所有页面变为 dynamic** —— SEO 页面失去静态 prerender + CDN 缓存
- ❌ Next.js 官方文档确认：使用 `headers()` 会强制 dynamic rendering
- 预估影响：首字节时间（TTFB）+50–200ms，Vercel CDN 边缘缓存失效（对匿名用户流量影响最大）

### B. Hash-based CSP（build-time SHA-256）

```
build script → 扫描所有 <script dangerouslySetInnerHTML> 内容
             → 计算 sha256 → 写入 next.config.mjs
             → CSP: script-src 'self' 'sha256-abc...' 'sha256-def...' https://...
```

- ✅ 保持全静态渲染 + CDN 缓存
- ❌ 每次 JSON-LD 内容变更必须重 build hash 列表
- ❌ 需新增 build 脚本 + CI 集成
- ❌ 动态内容（如基于 locale 的 meta description）的 JSON-LD 无法 hash
- 预估工作量：2–3 天 + 持续维护负担

### C. 现状 + Report-Only 监控（**规划方向**；本 PR 仅完成铺路，不加 Report-Only）

```
保留 'unsafe-inline' + 加 CSP-Report-Only header 严格版
→ 浏览器报告所有违规到后端收集端点
→ 收集 1–2 周数据后决定 A/B
```

- ✅ 零回归风险
- ✅ 收集实际攻击面数据，指导下一步决策
- ❌ 短期内未真正阻止 inline script XSS
- ❌ 需后端加 CSP report 接收端点（小工作量）

## 三、推荐

**C → 观察数据 → B**：

1. **本 PR（完成）**：方案 C 的**基础设施部分**
   - 新增 `frontend/src/components/JsonLdScript.tsx` **pure** helper（接收 `nonce?: string` prop，由调用方决定是否 `headers()`；不触发页面 dynamic）。现有 ~108 处 / 跨 41 文件的 JSON-LD 暂不迁移
   - 不加 Report-Only（需后端端点，独立 PR）
   - 文档化决策路径到本文件

2. **下一 PR**（P3.1a）：**先处理 AnalyticsWrapper** — 它是唯一真正可执行的 inline script（Codex 发现的最高 ROI 动作）
   - 选项 1：把 GA init `window.dataLayer=...` 移到 `public/ga-init.js`，用 `<Script src>` 加载（`script-src 'self'` 即可）
   - 选项 2：计算该 script 的 sha256 hash，加到 CSP（hash-based）
   - 两选项都**不强制 SEO 页面动态化**（索引近零影响；可能有轻微 CWV 波动，需 Lighthouse 验证）

3. **下一 PR**（P3.1b）：Report-Only 监控
   - 后端新增 `POST /api/csp-report` 端点（接收 application/csp-report，写结构化日志）
   - 前端加 `Content-Security-Policy-Report-Only` 头（严格版本，带 nonce）
   - Vercel/Sentry 聚合 violations

4. **观察 1–2 周后**（P3.2）：选择 A 或 B 解决 JSON-LD
   - 如果 SEO 页面 dynamic 化对 CWV 影响 < 5%：走 A（全 nonce，逐页用 JsonLdScript + nonce prop）
   - 否则走 B（build-time hash），接受维护成本

## 四、本 PR 已交付

- [x] 方案对比文档（本文件）
- [x] `JsonLdScript.tsx` helper（**pure** 组件：接收 `data` + 可选 `nonce` prop，不自己调 `headers()`，不强制 dynamic rendering）
- [x] `docs/ARCHITECTURE.md §10` 未改（已有 P2-5 CSP 说明）

## 五、本 PR 刻意**未**交付

- 现有 ~108 处 / 41 文件的 JSON-LD 迁移到 JsonLdScript —— 需 A/B/C 决策后再做
- `script-src 'unsafe-inline'` 移除 —— 同上
- 后端 CSP report 接收端点 —— 独立 PR
