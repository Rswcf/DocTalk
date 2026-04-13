Verdict: APPROVED

D 三组件不过度，a11y/dark mode 达标。
目标替换完成：profile×2、auth、auth/error、collections、collections/[id] 的旧 loading 已清，profile 内联已改 InlineSpinner。
blog 空态（Inbox+描述+/demo CTA）合理。
font-display 8处全替；仅有重复 `tracking-tight` 小瑕疵。
A2 spacing 暂缓可接受，但“0 arbitrary”不准：`BillingPageClient` 仍有 `p-[2px]`×2。
`tOr` 用法正确，fallback 不会被 i18n 挡（当前各 locale 回退英文）。
无新增 dark mode 阻断，P3 前无紧急项。
