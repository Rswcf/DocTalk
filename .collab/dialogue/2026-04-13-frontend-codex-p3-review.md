VERDICT: NEEDS-FIX

1) a11y：三块视觉为装饰，但只有 lock SVG 有 aria-hidden；`1/2/3`、`p.42`、`AES-256`、`No training` 仍会被读屏读出。建议每个 Visual 根节点加 `aria-hidden="true"`。
2) dark mode：线条 `dark:bg-zinc-700` 叠在 `indigo-950/40→zinc-900/40` 上对比偏低（约1.6~1.7:1），缩略后识别差。建议改 `zinc-500/600` 或加亮底。
其余：mobile 单列比例正常；H2 去重 OK；无明显性能回归。
