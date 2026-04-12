审阅结论（[export.py](/Users/mayijie/Projects/Code/010_DocTalk/backend/app/api/export.py)，L30/L45）  
1. **P1** `filename` fallback 未转义 `"`/`\`，`bad"title🎉` 会产出非法 quoted-string。  
2. **P1** `_sanitize_filename` 用 `\s`，会保留 `\r\n` 进入 header。  
3. RFC5987/8187 格式基本正确：`filename*=UTF-8''...`；`quote(safe='')` 会编码 `/\\?*`。  
4. `?→_` 误杀不严重（当前上游已去 `?`）。  
5. 现代浏览器优先 `filename*`；旧 Safari/IE 回退 `filename`，故 1/2 必修。  
6. 测试缺口：CRLF、引号/反斜杠、超长名、接口级“中文标题不再400且header正确”。  
7. 前端无需额外 UTF-8 处理。