# 野活网

国内 ACG 活动清单

## 开发

```bash
corepack pnpm install
cp .dev.vars.example .dev.vars
corepack pnpm exec wrangler d1 migrations apply DB --local
corepack pnpm exec wrangler d1 execute DB --local --file=docs/dev/seed-public-site.sql
corepack pnpm build
corepack pnpm dev

corepack pnpm lint
corepack pnpm format
```

## 部署

### 上线前

- 使用 Node.js 22.12+
- 确认 `wrangler.jsonc` 中的 D1 `database_id` 指向生产数据库
- 将 `TURNSTILE_SITE_KEY` 换成正式 Site Key, 并为正式域名创建 Turnstile Widget
- 在 `routes` 中配置 Custom Domain, 例如 `{"pattern":"events.example.com","custom_domain":true}`
- 默认后台鉴权是 Cloudflare Access. 设置 `ACCESS_TEAM` 和 `ACCESS_AUD`
- 使用 `corepack pnpm exec wrangler secret put VIEW_HASH_SECRET` 交互式设置活动访问去重密钥

在 Cloudflare Access 中保护 `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`

普通变量应写在 `wrangler.jsonc` 中. 如需 Token 登录, 再设置 `AUTH_MODE=token` 和 `ADMIN_TOKEN` Secret

如果生产 D1 不存在, 执行 `corepack pnpm exec wrangler d1 create eventlist-db`, 再更新 `database_id`
不要提交或打印 Secret

`VIEW_HASH_SECRET` 只用于生成活动级 HMAC 访客键. 原始 IP 不写入 D1. `event_visitors`
只保留最近 30 个中国自然日的数据. 更换密钥会重置去重连续性, 因此轮换时应先清空保留期内的
`event_visitors`, 再立即设置新密钥, 不要混用不同代密钥.

### 首次部署

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm exec wrangler login
corepack pnpm exec wrangler whoami
corepack pnpm generate-types

corepack pnpm exec wrangler d1 migrations list DB --remote
corepack pnpm exec wrangler d1 migrations apply DB --remote

corepack pnpm lint
corepack pnpm build
corepack pnpm exec wrangler types --check
corepack pnpm exec wrangler deploy --dry-run
corepack pnpm exec wrangler deploy
```

D1 生产命令必须带 `--remote`. 任一检查失败时不要继续部署

### 部署后

```bash
corepack pnpm exec wrangler secret list
corepack pnpm exec wrangler d1 migrations list DB --remote
```

确认 Secret 列表中包含 `TURNSTILE_SECRET_KEY` 和 `VIEW_HASH_SECRET`.

## 维护

发布代码:

```bash
corepack pnpm lint
corepack pnpm build
corepack pnpm exec wrangler types --check
corepack pnpm exec wrangler deploy --dry-run
corepack pnpm exec wrangler deploy
```

修改生产数据库前先备份:

```bash
corepack pnpm exec wrangler d1 export DB --remote --output backup.sql
corepack pnpm exec wrangler d1 migrations list DB --remote
corepack pnpm exec wrangler d1 migrations apply DB --remote
```

不要提交 `backup.sql`. 常用维护命令:

```bash
corepack pnpm exec wrangler tail
corepack pnpm exec wrangler versions list
corepack pnpm exec wrangler rollback VERSION_ID
corepack pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
```
