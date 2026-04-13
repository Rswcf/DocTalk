Verdict: NEEDS-FIX

1) 阻断：不是“先 sources 后 answer”。`MessageBubble.tsx:272` 要等 citations 才渲染；后端 `chat_service.py:194` 仅在读到 `[n]` 才发 citation，常为答案先流出。
2) 高风险：`SourcesStrip.tsx:37` 以 `docId+page` 去重，会吞掉同页不同 chunk/ref；`docId` 为空时会误合并。
3) 通过：`t(...,{count})` 在 `LocaleProvider.tsx:6,98` 能替换 `{count}`。
4) 非阻断：22字截断在相似长文件名下辨识度低；badge 与内联 `[n]` 视觉不一致；移动端多 source 变高；a11y 建议给 button 加 `aria-label`，容器补 `role`。
