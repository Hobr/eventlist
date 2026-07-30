# [同频点](https://acg.hobr.site/)

> 从同屏到同点, 让兴趣同频

从同屏到同点, 让兴趣同频, 把分散在各大社交媒体和社交渠道的ACG活动信息聚合起来

## 框架

- 框架：Astro + Svelte
- UI：Tailwind CSS + Flowbite
- 部署：Cloudflare Workers
- 数据库：Cloudflare D1
- 安全：Cloudflare Turnstile + Cloudflare Access

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

## 关于

贡献说明: [CONTRIBUTING.md](CONTRIBUTING.md)
部署文档: [deploy.md](deploy.md)
