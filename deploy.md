# 部署

## 上线前

- 使用 Node.js 22.12+
- 登录正确的 Cloudflare 账号, 并确认账号中已启用 Workers、D1、Turnstile 和 Access
- 确认 `wrangler.jsonc` 中的 D1 `database_id` 指向生产数据库
- 确认 `TURNSTILE_SITE_KEY` 对应已有的正式 Turnstile Widget, 且正式域名已在 Cloudflare Dashboard 中配置
- 通过 Cloudflare Dashboard 绑定 Custom Domain, 或在 `wrangler.jsonc` 的 `routes` 中配置
- 默认后台鉴权是 Cloudflare Access. 将 `ACCESS_TEAM` 和 `ACCESS_AUD` 写入 `wrangler.jsonc` 的 `vars`

在 Cloudflare Access 中保护 `/admin`, `/admin/*`, `/api/admin`, `/api/admin/*`

运行时配置如下:

| 配置                    | 存放位置                   | 用途                                   |
| ----------------------- | -------------------------- | -------------------------------------- |
| `DEFAULT_DIVISION_CODE` | `wrangler.jsonc` 的 `vars` | 默认地区代码                           |
| `TURNSTILE_SITE_KEY`    | `wrangler.jsonc` 的 `vars` | 浏览器端 Turnstile Site Key            |
| `TURNSTILE_SECRET`      | Wrangler Secret            | 服务端校验 Turnstile Token             |
| `VIEW_HASH_SECRET`      | Wrangler Secret            | 生成活动级 HMAC 访客键                 |
| `ACCESS_TEAM`           | `wrangler.jsonc` 的 `vars` | Cloudflare Access Team Domain          |
| `ACCESS_AUD`            | `wrangler.jsonc` 的 `vars` | Cloudflare Access Application Audience |
| `AUTH_MODE`             | `wrangler.jsonc` 的 `vars` | 可选. 默认为 `access`, 可改为 `token`  |
| `ADMIN_TOKEN`           | Wrangler Secret            | 仅在 `AUTH_MODE=token` 时使用          |

设置生产 Secret:

```bash
corepack pnpm exec wrangler secret put TURNSTILE_SECRET
corepack pnpm exec wrangler secret put VIEW_HASH_SECRET
```

如需 Token 登录, 将 `AUTH_MODE=token` 写入 `vars`, 再执行:

```bash
corepack pnpm exec wrangler secret put ADMIN_TOKEN
```

如果生产 D1 不存在, 执行 `corepack pnpm exec wrangler d1 create eventlist-db`, 再更新 `database_id`
不要提交或打印 Secret

`VIEW_HASH_SECRET` 只用于生成活动级 HMAC 访客键. 原始 IP 不写入 D1. `event_visitors`
只保留最近 30 个中国自然日的数据. 更换密钥会重置去重连续性, 因此轮换时应先清空保留期内的
`event_visitors`, 再立即设置新密钥, 不要混用不同代密钥.

## 首次部署

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

## 部署后

```bash
corepack pnpm exec wrangler secret list
corepack pnpm exec wrangler d1 migrations list DB --remote
corepack pnpm exec wrangler versions list
```

确认 Secret 列表中包含 `TURNSTILE_SECRET` 和 `VIEW_HASH_SECRET`.
访问公开页面、投稿接口和后台入口, 并使用 `corepack pnpm exec wrangler tail` 检查运行日志.

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
corepack pnpm exec wrangler secret put TURNSTILE_SECRET
```
