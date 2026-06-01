# ACG 活动查询

查询中国境内 ACG（动画、漫画、游戏）线下活动的网站。数据由用户提交，管理员审核后发布。支持按地点、时间、类型、关联作品、活动规模等条件筛选。

## 技术栈

| 层        | 选型                                     |
| --------- | ---------------------------------------- |
| 前端      | Astro 6 + React 19 Islands + Tailwind v4 |
| 部署      | Cloudflare Workers（SSR + 静态资源）     |
| 数据库    | Cloudflare D1（SQLite） + Drizzle ORM    |
| 图片存储  | Cloudflare R2                            |
| 限频/去重 | Cloudflare KV                            |
| 防机器人  | Cloudflare Turnstile                     |
| 测试      | Vitest                                   |

## 开发

### 环境要求

- Node.js 18+
- pnpm（通过 `corepack enable` 启用）

### 安装

```bash
pnpm install
```

### 本地密钥

复制示例文件并填入你的 Turnstile 测试密钥：

```bash
cp .dev.vars.example .dev.vars
```

### 初始化本地数据库

```bash
pnpm run db:migrate:local
pnpm run db:seed:local   # 可选：导入 5 条 demo 数据
```

如果遇到 `no such table: events` 错误，说明迁移跟踪状态与实际数据库不一致，手动执行 SQL：

```bash
pnpm exec wrangler d1 execute acg-events --local --file migrations/0000_initial.sql
pnpm run db:seed:local
```

### 启动开发服务器

```bash
pnpm run dev        # 纯页面开发，最快 HMR（无 binding）
pnpm run preview    # 全功能（含 D1/R2/KV binding，走 miniflare）
```

访问 `http://localhost:4321`。

### 本地管理员

`.dev.vars` 中设置 `DEV_ADMIN_EMAIL` 即可在本地访问 `/admin` 管理后台，无需配置 Cloudflare Access。

## 测试

```bash
pnpm run test          # 运行一次
pnpm run test:watch    # watch 模式
```

测试覆盖：ULID 生成、HMAC 签名/验证、限频逻辑、Turnstile 验证、海报 URL 构建、事件列表查询。

## 代码检查

```bash
pnpm run typecheck     # TypeScript 类型检查
pnpm run format        # Prettier 格式化
```

## 部署到 Cloudflare

### 1. 创建云资源

```bash
wrangler d1 create acg-events
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION
wrangler r2 bucket create acg-events-posters
```

### 2. 配置 wrangler.jsonc

将上一步返回的真实 ID 填入 `wrangler.jsonc` 对应的 `database_id`、`id` 字段。

### 3. 配置环境变量

在 Cloudflare Dashboard 或 `.env.production` 中设置：

| 变量                        | 说明                                          |
| --------------------------- | --------------------------------------------- |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile 公钥                                |
| `PUBLIC_R2_BASE_URL`        | R2 自定义域名（可选，留空走同源 `/r2/`）      |
| `PUBLIC_SITE_URL`           | 站点基址，如 `https://acg-events.example.com` |

### 4. 配置密钥

```bash
wrangler secret put TURNSTILE_SECRET_KEY
```

### 5. 配置管理员

在 Cloudflare Zero Trust 中配置 Access 策略保护 `/admin` 路由，或在 `wrangler.jsonc` 的 `vars` 中设置 `ADMIN_EMAILS`（逗号分隔的邮箱白名单）。

### 6. 运行迁移 & 部署

```bash
pnpm run db:migrate:prod
pnpm run deploy
```

## 项目结构

```
src/
├── components/          # React Islands + Astro 组件
├── layouts/             # 页面布局
├── lib/                 # 工具函数（ULID、HMAC、限频、Turnstile）
├── pages/               # 页面路由 + API 端点
├── server/db/           # Drizzle schema + DB helper
├── styles/              # 全局 CSS
└── types/               # TypeScript 类型定义
data/provinces.json      # 中国省市数据
migrations/              # D1 迁移文件
seeds/                   # 本地 demo 数据
```

## License

MIT
