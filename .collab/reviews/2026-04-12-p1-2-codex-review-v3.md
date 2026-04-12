# P1-2 Codex 终裁 v3
## 核查事实 A / B
A：Next14.2.35 中 `NextRequest.ip` 只返回 `INTERNALS.ip`。Node 适配器 `fromNodeNextRequest` 构造时不传 `ip`，故 App Route(Node) 的 `req.ip` 常为 `undefined`，不是直接读 `x-real-ip/x-forwarded-for`。  
B：Vercel 文档写明 `X-Forwarded-For` 会被覆盖防 spoof，`x-real-ip` 与其相同；客户端自带值不可信。

## 是否接受 Claude 反驳
部分接受：③④成立；①不成立；②是工程取舍，不足以推翻风险判断。

## 最终结论（通过 / 需修改）+ 理由
需修改。去掉 `x-real-ip` 回退是安全收益，但默认 Node runtime 可能拿不到真实客户端 IP，后端退化为 `request.client.host` 聚合限流，影响生产风控/额度准确性。应改为稳定取 IP（`ipAddress()` 或明确可信头策略）。
