Verdict: NEEDS-FIX

1) 布局算错：`md:grid-cols-6` + 三个 `lg:col-span-4` 不会成“hero+2x3”。实际 lg=5 行（6/3+3/4/4/4），md=4 行（6/3+3/3+3/3）。
2) `formats.desc` 的“no conversion required”有误导；后端确有 DOCX/PPTX→PDF 转换（`parse_worker`、`conversion_service`）。建议改“无需手动转换”。
3) ja/ko/ar 的 `modes.desc` 抽查可用。
4) `landing.feature.answers.*` 已无代码引用，属孤儿 key。
5) ScrollReveal 7 observers 可接受；`text-[8px]` 因 `aria-hidden` 非阻断。
