# P1-2 Codex 评审
## 验证结果
- Diff 验证：`git diff frontend/src/app/api/proxy/[...path]/route.ts` 已确认改动为 `const clientIp = req.ip || req.headers.get("x-real-ip")` → `const clientIp = req.ip`（第 69 行）。
- Vercel / NextRequest 文档核查：
  - Next.js 14 文档中 `NextRequest` 仍有 `ip` 字段（`https://nextjs.org/docs/14/app/api-reference/functions/next-request`）。
  - Next.js 当前文档的 Version History 明确 `v15.0.0` 已移除 `ip`/`geo`，并提供 codemod 改为 `@vercel/functions` 的 `ipAddress`/`geolocation`（`https://nextjs.org/docs/app/api-reference/functions/next-request`、`https://nextjs.org/docs/15/app/guides/upgrading/codemods`）。
  - Next.js 14 Route Segment Config 显示 `runtime` 默认是 `nodejs`（Serverless Runtime），不是 Edge（`https://nextjs.org/docs/14/app/api-reference/file-conventions/route-segment-config`）。当前 `route.ts` 未导出 `runtime='edge'`。
  - Vercel Request Headers 文档：`x-forwarded-for` 是客户端公网 IP，且 Vercel 会覆盖该头防止伪造；`x-real-ip` 与 `x-forwarded-for` 等同（`https://vercel.com/docs/headers/request-headers`）。
- 代码路径核查（本仓库）：
  - `backend/app/api/chat.py:44-63`：优先信任带 `X-Proxy-IP-Secret` 的 `x-real-client-ip`，否则回退 `request.client.host`。
  - `backend/app/api/chat.py:150-152,243-245,263-264`：匿名 demo 的创建限流、聊天限流、消息额度都以该 IP 键控。
  - `backend/app/core/rate_limit.py:99-124`：Redis 不可用时回退内存限流，但键仍是同一 `client_ip`。
  - 本地安装的 Next 14 运行时代码显示 App Route 在 Node 路径通过 `NextRequestAdapter.fromNodeNextRequest` 构造 `NextRequest`，未注入 `ip`（`frontend/node_modules/next/dist/server/web/spec-extension/adapters/next-request.js`）；`base-server.js` 的 App Route 处理链确实走该 adapter。

## 风险评估
- 安全收益：删除对 `req.headers.get("x-real-ip")` 的直接回退，避免在非托管/本地环境下被客户端伪造头绕过匿名限流。
- 兼容风险（高）：当前路由默认 Node(Serverless) 运行时，`req.ip` 在该路径大概率为 `undefined`。一旦为 `undefined`，前端代理不会发送 `X-Real-Client-IP`，后端将退化为 `request.client.host` 键控。
- dev 行为：`npm run dev` 下退化到 `request.client.host`（通常是 `127.0.0.1` 或网关地址），匿名流量共享同一桶，容易提前触发 429，但可工作。
- prod 行为：若 Vercel Serverless 同样拿不到 `req.ip`，匿名用户会按 Vercel→Railway 连接 IP 聚合限流，可能出现跨用户互相“挤占”额度/误封；与“按真实客户端 IP 控制 demo 滥用”的目标不一致。
- 版本前瞻风险：升级到 Next >=15 后 `req.ip` 已官方移除，当前实现会失去语义支撑。

## 结论
需修改。
理由：该改动提升了反伪造能力，但在当前默认 Node(Serverless) 运行时下存在显著可用性/准确性风险，可能让 prod 匿名限流退化成“按代理出口 IP”而不是“按用户 IP”。
建议：改用 `@vercel/functions` 的 `ipAddress(req)`（Next 官方升级指引同路径）统一兼容 Edge/Serverless；后端保持现有签名校验与 `request.client.host` 兜底即可。
