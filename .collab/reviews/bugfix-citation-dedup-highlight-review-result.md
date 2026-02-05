VERDICT: APPROVE

总体评价
- 这次修复聚焦且实现得当：前端 citation 卡片按 refIndex 去重实现简洁，PDF 高亮样式更克制且读字清晰度更好；后端将 bbox 从 block 级提升到 line 级的实现稳健，连字符处理与原逻辑保持一致，未见明显回归风险。JSX 闭合、TypeScript/ Python 语法与类型使用均无误。

具体问题
- 未发现语法错误或明显逻辑 bug。
- JSX 闭合正确（frontend/src/components/Chat/ChatPanel.tsx:125 和括号内 IIFE 结构闭合无误）。
- Tailwind 类名有效（bg-yellow-200/25、ring-yellow-400/60），mixBlendMode 合法（frontend/src/components/PdfViewer/HighlightOverlay.tsx:21）。
- 连字符处理保持一致性：
  - 旧 `_build_block_text_and_size`：行末 `-` 且下一行以字母/数字开头时去掉连字符并不追加空格，否则追加空格（backend/app/services/parse_service.py:297-318）。
  - 新 `_extract_line_blocks`：对每行同样处理（backend/app/services/parse_service.py:343-360），保持跨行单词拼接在 chunk 拼接阶段仍能恢复为“transaction”而非“tran saction”。
- heading detection 风险评估：line-level 的 `font_size` 中位数统计仍然鲁棒，阈值使用 `median * 1.3` 在大多数文档上不会误判；且标题通常为单行，受 line-level 切分影响较小。
- `_build_block_text_and_size` 其他调用方：
  - 当前仓库内无调用（仅定义，无引用），保留不会影响行为（rg 检索确认）。
- edge cases：
  - `detect_scanned` 以页面内文本总字数为准，line-level 不改变总长度，判定逻辑不受影响。
  - header/footer 检测基于文本集合 set 去重，line 级不会引入重复计数偏差。
  - chunk 构建按“句子单元”累加；在缺少句读的行内文本场景下，line-level 会把“句子单元”细化为行单元，但 chunk 的最终文本通过字符串拼接恢复连续性，且 bboxes 列表更精细（符合本次改动目标）。

建议修改
- ChatPanel 去重书写风格（可选，非必须）：
  - 目前 IIFE 写法在 JSX 内是可行的，但可考虑用一个局部常量或 useMemo 提升可读性与避免重复计算：
    - frontend/src/components/Chat/ChatPanel.tsx:125
    - 若关心性能，可对 `uniqueCitations` 使用 `useMemo(() => dedup(m.citations), [m.citations])`。

- 文档注释（可选，非必须）：
  - 在 `_extract_line_blocks` 顶部补充一行注释说明“line-level 会让 chunk 的 ‘句子单元’ 更细化为行单元，但最终 chunk 文本通过拼接恢复，bboxes 更精细”，以便后续维护者理解意图（backend/app/services/parse_service.py:322）。

- 保留旧函数（可选，非必须）：
  - `_build_block_text_and_size` 当前未使用。若希望保持最小表面积，可在 docstring 标注“deprecated: replaced by _extract_line_blocks; kept for potential reuse”，避免误用。

结论
- 改动符合预期，无明显回归或 bug。建议如上均为可选风格/注释层面的改进，不影响合并。
- 给予 APPROVE。