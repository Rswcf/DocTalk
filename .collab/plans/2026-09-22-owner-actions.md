# Owner 待办（2026-09-22，按 Fable 推荐执行）

owner 于 2026-09-22 接受了 Fable 战略计划（`2026-09-22-next-strategy.md` §4）的全部 8 条推荐。
下面是只能由 owner 本人完成的事项，每项都可以直接照做。Claude 能做的部分（推 `stable`、引文按钮、
学生页 zh/es）由 Claude 负责，不在这里列出。

## 1. 补跑逾期的数据检查（§4.1，约 5 分钟，只读）

在仓库根目录运行（需要已登录的 Railway CLI，以及装了 asyncpg 的 python3.12）：

    DATABASE_URL="$(railway variables --service Postgres --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')" python3.12 .collab/reviews/2026-09-22-checkpoint-readout/readout_0922.py | tee readout-0922.txt

跑完告诉 Claude 即可。Claude 会把结果原样追加到计划里，交给 Fable 解读；09-28 的决定依据的就是这份结果。

**可选：一次性建一个只读账号，以后的读取就不用每次麻烦你。** 用 Railway 的 Postgres 控制台或 psql，
以管理员身份执行（先把 `<密码>` 换成你自己生成的随机串；数据库名以 Railway 显示的为准，通常是
`railway`）：

    CREATE ROLE doctalk_readonly LOGIN PASSWORD '<密码>';
    GRANT CONNECT ON DATABASE railway TO doctalk_readonly;
    GRANT USAGE ON SCHEMA public TO doctalk_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO doctalk_readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO doctalk_readonly;
    ALTER ROLE doctalk_readonly SET default_transaction_read_only = on;

建好后：
- 把连接串存成本机文件，并设为只有你能读（`chmod 600`），例如 `~/.config/doctalk/readonly.env`。
  **不要贴进对话。**
- 在 Claude Code 的权限设置里放行读取这个文件的那条命令。否则自动权限分类器仍会按“生产读取”拦下。

## 2. 提交企业网关的网站分类（§4.5，约 30 分钟，零代码）

目标客户多半在企业网关后面，而这些网关常会拦截“未分类”的域名。在每家的公开页面查询
`www.doctalk.site`；如果显示未分类或分类不对，按页面提示申请重新分类。建议类别：
**Business / Information Technology / Productivity software（商业软件、生产力工具）**。

| 厂商 | 页面 |
|---|---|
| Symantec / Bluecoat (Broadcom WebPulse) | https://sitereview.bluecoat.com/ |
| Palo Alto Networks | https://urlfiltering.paloaltonetworks.com/ |
| Zscaler | https://sitereview.zscaler.com/ |
| Cisco Talos / Umbrella | https://talosintelligence.com/reputation_center/ （脚本访问被拦，浏览器可以打开；可能需要 Cisco 账号） |
| Fortinet FortiGuard | https://www.fortiguard.com/webfilter |
| Forcepoint | https://csi.forcepoint.com/ （2026-09-22 探测时没有响应，打不开就跳过） |
| Netskope | https://www.netskope.com/url-lookup （脚本访问被拦，浏览器可以打开） |

Fable 说这是第三次、也是最后一次提这件事。

## 3. Search Console：网域属性、重新上传 disavow、导出一次基线（§4.6）

1. 在 Search Console 里添加属性，选“网域”，填 `doctalk.site`，按提示去域名的 DNS 添加一条 TXT 记录完成验证。
   原因：现在只有 `https://www.doctalk.site/` 这个网址前缀属性，而 86 个引荐域名指向的是不带 www
   或 http 的地址。
2. 用 disavow 工具，把 09-20 上传过的同一份 188 个域名的文件，为新的网域属性再上传一次。
3. 导出一次基线：“效果”报告选过去 3 个月，导出；“链接”报告也导出一次。这就是计划里的 D2。有了它，
   标题改动才能按阈值自动决定（D4），学生页的标题实验（§2.2 B 片）也才有对照。

## 其余推荐由 Claude 执行，或等 09-28

- 4.2 推 `stable`：Claude 已于 2026-09-22 07:22Z 推送，并在推送后验证线上。
- 4.3 引文按钮：Claude 在 `feat/citation-save-bridge` 分支上做，09-28 前只做不发。
- 4.4 匿名上传：09-28 带着数据检查结果再定，之前不动工。
- 4.7 学生页 zh/es 搜索标题：已获批准，随 §2.2 在 09-24 到 09-25 期间做。
- 4.8 09-28 默认规则：已确认。没有更强的线索就做获客；引文按钮不依赖数据检查结果。
