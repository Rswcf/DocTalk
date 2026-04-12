1. `next.config.mjs` diff 确认：新增 `media-src 'none'`、`upgrade-insecure-requests`，并注明 unsafe-inline 暂留与 P3。
2. grep `<video|<audio|new Audio|new Video`（frontend/src）无命中，`media-src 'none'` 当前无功能影响。
3. UIR+HSTS：未见生产跨域 `http://` 资源；Railway/Sentry/Vercel/GTM 均 HTTPS。仅 env 误配 HTTP 时可能升级后失败。
4. `upgrade-insecure-requests` 无值、单独 token 写法正确，顺序无关。
5. 结论：可合入。
6. 同意完整 nonce 化独立为 P3，并走 staging Report-Only 观察期。
