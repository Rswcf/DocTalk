判定：APPROVED。
4项block均闭合：①大小校验改`Buffer.byteLength`，UTF-8多字节绕过已封堵；②限流改`x-real-ip`优先，并加`Map`上限+过期清理+超限淘汰，内存无界问题关闭（serverless多实例弱限流已文档化）；③fingerprint改`blockedBucket`，解析失败/空值归稳定桶，不再回退原始`blockedUri`；④`Reporting-Endpoints`与`report-uri`改绝对URL，兼容性风险关闭。未见新增阻断问题。
