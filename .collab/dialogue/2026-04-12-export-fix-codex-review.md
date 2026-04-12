结论：我反对“已充分修复”的判断。  
1. 正则只修 C0 控制符，方向对但不完整。XML1.0允许：`#x9/#xA/#xD/#x20-#xD7FF/#xE000-#xFFFD/#x10000-#x10FFFF`；仍漏 `U+FFFE/U+FFFF` 与代理项 `D800-DFFF`。  
2. `_sanitize_xml_text(None)->''`：title/doc_name 可接受；`msg.content` 不建议，`messages.content` 为非空列，会吞上游脏数据。  
3. PDF 防御仅部分充分。若仍 400，先看新 traceback 和 500 条上限；`html_escape/f-string/StreamingResponse` 通常不是 ValueError 源。  
4. `warning+exc_info=True` 偏重：已知用户错误（超限）应 `info` 无栈；未知异常再 `warning/error` 带栈，降低 Railway 日志成本。  
5. `window.alert` 可止血，但阻塞且未 i18n；项目目前无现成 toast。  
6. 必补 `test_export_service.py`：NUL/VT/`FFFE`/`FFFF`/代理项/`None` 回归用例。