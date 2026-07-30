# [同频点](https://acg.hobr.site/)

> 从同屏到同点, 让兴趣同频

从同屏到同点, 让兴趣同频, 把分散在各大社交媒体和社交渠道的ACG活动信息聚合起来

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

部署文档: [deploy.md](deploy.md)
