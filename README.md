# ACG 活动目录

中国 ACG 活动的半可信目录：访客筛选近期活动和查看官方渠道，提交者免注册提交活动，维护者通过 Cloudflare Access 保护的后台审核、规范词表并管理公开记录。

## 本地开发

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm seed > /tmp/eventlist-seed.sql
pnpm wrangler d1 execute eventlist-db --local --file=/tmp/eventlist-seed.sql
pnpm dev
```

开发后台默认使用 `.dev.vars` 中的 `ADMIN_DEV_EMAIL` mock 身份。`.dev.vars.example` 默认启用 `USE_FIXTURE_DATA=true` 以便直接预览 demo 数据；把它改成 `false` 后会使用本地 D1 数据。

生产环境必须配置 Cloudflare Access，并设置 `CF_ACCESS_AUD`、`CF_ACCESS_ISSUER` 和真实策略。`wrangler.jsonc` 的默认 `APP_ENV` 是 `production`，不要在生产部署中设置 `ADMIN_DEV_EMAIL`。

## 常用脚本

```bash
pnpm test
pnpm lint
pnpm build
pnpm cf-typegen
pnpm deploy
```

## Cloudflare 绑定

- `DB`: D1 权威数据源，保存活动、提交、词表、规模、封面、审计和热度观察。
- `RATE_LIMIT`: KV，用于匿名提交冷却和每日上限。
- `BUCKET`: R2，保存待审核和公开封面图对象。
- `TURNSTILE_SECRET_KEY`: Turnstile 服务端校验 secret，本地可用 Cloudflare 测试 key。
- `IP_HASH_SECRET`: IP 哈希 HMAC secret，必须作为 Wrangler secret 配置，不要提交真实值。

生产初始化：

```bash
pnpm wrangler d1 create eventlist-db
pnpm wrangler kv namespace create RATE_LIMIT
pnpm wrangler r2 bucket create eventlist-covers
pnpm wrangler secret put IP_HASH_SECRET
pnpm wrangler secret put TURNSTILE_SECRET_KEY
pnpm db:migrate:remote
pnpm deploy
```

`wrangler.jsonc` 中的 D1/KV id 是占位值，部署前需要替换为 Cloudflare 创建资源返回的真实 id。
