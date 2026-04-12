P1-3 v2 复核
1) diff 核对通过：SSR 已发送 `X-Real-Client-IP` + `X-Proxy-IP-Secret(AUTH_SECRET)`，后端 HMAC 校验链路成立。
2) `headers()` 在 `fetch` 前调用，按 Next.js App Router 语义该请求通常不入 Data Cache；`revalidate=60` 基本不生效，也不会按 clientIp 形成缓存分片。建议显式 `cache:'no-store'`。
3) `AUTH_SECRET` 非 `NEXT_PUBLIC_`，且仅在服务端文件使用，不会泄漏到浏览器。
4) XFF 多跳取最左作为客户端 IP 合理（前提：Vercel 注入可信头）。
5) 结论：通过（附第2点小优化建议）。
6) 其他匿名端点限流同意延后为独立 P2。
