1) diff：已加 `handleSignOut`，Enter/点击两处都改为它。
2) `doctalk_` 仅有 `last_doc_*`,`docs`,`mode`,`fb_*`,`locale`,`tour_completed`,`analytics_consent`；白名单合理，无遗漏。
3) `signOut()` 默认重定向，next-auth 用 `window.location.href`，会硬跳转并重建 Zustand。
4) SSR 安全：`typeof window !== "undefined"`。
5) 缺口：`Profile/AccountActionsSection.tsx` 仍直调 `signOut`；session 过期只清 `doctalk_docs`，其余 key 残留。
6) 结论：方向正确但未闭环，建议抽公共清理函数覆盖所有登出/失效路径。
