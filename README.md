# ACG 活动目录

国内ACG活动清单

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

首次部署前需要登录 Cloudflare, 并确认 `wrangler.jsonc` 中的 D1 `database_id` 指向目标环境

```bash
corepack pnpm exec wrangler login
corepack pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
corepack pnpm exec wrangler d1 migrations apply DB
corepack pnpm build
corepack pnpm exec wrangler deploy
```

如果后台使用 Token 登录, 还需要设置:

```bash
corepack pnpm exec wrangler secret put ADMIN_TOKEN
```

默认后台鉴权模式是 Cloudflare Access, 生产环境建议为 `/admin/*` 和 `/api/admin/*` 配置 Cloudflare Access, 并设置 `ACCESS_TEAM`、`ACCESS_AUD`, 如需改用 Token 表单登录, 设置普通环境变量 `AUTH_MODE=token`, 再写入 `ADMIN_TOKEN` secret

## 日常维护

- 新增表结构或字段: 在 `migrations/` 添加迁移, 然后执行 `corepack pnpm exec wrangler d1 migrations apply DB`
- 更新类型绑定: 修改 `wrangler.jsonc` 或 Cloudflare 绑定后执行 `corepack pnpm generate-types`
- 发布前检查: 执行 `corepack pnpm lint` 和 `corepack pnpm build`
- 观察线上日志: 执行 `corepack pnpm exec wrangler tail`
- 更新活动内容: 优先通过后台审核、编辑、下线和标签归并功能维护, 避免直接改生产数据库
