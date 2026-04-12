1) diff确认：`route.ts` 已是 `req.ip -> xff首项 -> x-real-ip`。
2) Vercel文档 Request headers 的 `x-forwarded-for` 节写明会覆盖 `X-Forwarded-For`、不转发外部IP以防伪造；`x-real-ip` 节写明与其相同。https://vercel.com/docs/headers/request-headers#x-forwarded-for
3) Vercel下可稳定：Edge走 `req.ip`；Node(Next14.2.35) 常无 `req.ip`，回退 `xff` 取真实IP。
4) Self-hosted超范围；`CLAUDE.md` 已定 prod 前端=Vercel(`stable`)。
5) 结论：通过。
