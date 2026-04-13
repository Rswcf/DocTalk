Verdict: NEEDS-FIX

1) T1.A-lite：`--page-background` 已改为 `#fafaf7/#1c1b18` 并传导到 `bg-[var(--page-background)]`；仅有轻微暖底-锌灰色温差（非阻断）。
2) T1.B：HeroArtifact 已是产品工件；连线固定坐标（HeroArtifact.tsx:86-103）在窄屏下不稳定对齐高亮与 pill。
3) T1.C：`/demo` 为 sample，语义正确；但 11 语仅改 en/zh，且 empty-state 新 key 未入 locale（HomePageClient.tsx:508,516），其余语言回退英文。阻断。
4) T1.E-lite：`inputRef.current?.click()` 为显式触发，属于 opt-in；双路径合理。
