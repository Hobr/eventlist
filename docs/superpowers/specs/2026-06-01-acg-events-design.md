# ACG 活动查询网站设计文档

> 日期：2026-06-01
> 代号：eventlist
> 参考项目：[seatview](https://github.com/Sallyn0225/seatview)

## 1. 项目概述

一个查询中国境内 ACG（动画、漫画、游戏）线下活动的网站。数据由用户提交，管理员审核后发布。支持按地点、时间、类型、关联作品、活动规模等条件筛选。

覆盖的活动类型：

- **漫展/同人展**：Comicup、CP、BW 等同人展会，各地商业漫展
- **演唱会/Live**：二次元相关演唱会、声优活动、偶像演出等

## 2. 技术栈

| 层         | 选型                                             | 说明                                            |
| ---------- | ------------------------------------------------ | ----------------------------------------------- |
| 前端框架   | **Astro 6** + React 19 Islands                   | 大部分 SSR，交互组件用 React                    |
| 部署适配器 | **`@astrojs/cloudflare`**                        | Cloudflare Workers（SSR + 静态资源同一 Worker） |
| 运行时绑定 | `import { env } from "cloudflare:workers"`       | 类型见 `src/env.d.ts` 的 `Cloudflare.Env`       |
| 样式       | **Tailwind v4**（Vite 插件 `@tailwindcss/vite`） | 设计 token 写在 `src/styles/global.css`         |
| 数据库     | **Cloudflare D1 + Drizzle ORM**                  | schema 见 `src/server/db/schema.ts`             |
| 图片存储   | **Cloudflare R2**（绑定直写）                    | Worker 经 `BUCKET` 绑定直写，非 presigned URL   |
| 限频       | **Cloudflare KV**（`RATE_LIMIT`）                | 每日计数 + 30s 冷却，TTL 自动过期               |
| 防机器人   | **Cloudflare Turnstile**                         | 前端 token → 后端 siteverify                    |
| 图片处理   | `browser-image-compression`                      | 长边 1920px / WebP / 去 EXIF / ~500KB           |
| 海报放大   | `yet-another-react-lightbox` v3                  | Lightbox 组件                                   |
| 图标       | `lucide-react`                                   |                                                 |
| ID 生成    | 自实现 ULID（`crypto.getRandomValues`）          | 避免 `ulid` 包在 workerd 报错                   |

## 3. 页面路由

| 路由                    | 渲染 | 说明                                              |
| ----------------------- | ---- | ------------------------------------------------- |
| `/`                     | SSR  | 首页：附近活动 + 热门活动 + 全部活动列表 + 筛选器 |
| `/event/[id]`           | SSR  | 事件详情页                                        |
| `/submit`               | SSR  | 用户提交活动表单                                  |
| `/admin`                | SSR  | 管理员后台（Cloudflare Access 保护）              |
| `/api/submit/sign`      | API  | 提交签名端点                                      |
| `/api/submit/commit`    | API  | 提交确认端点                                      |
| `/api/events`           | API  | 事件列表查询（支持筛选参数）                      |
| `/api/events/[id]/view` | API  | 记录浏览（去重计数）                              |
| `/api/admin/*`          | API  | 管理员操作端点                                    |

不引入 i18n，全中文界面。

## 4. 数据模型

### events 表

```sql
CREATE TABLE events (
  id          TEXT PRIMARY KEY,                    -- ULID
  title       TEXT NOT NULL,                       -- 活动名称
  province    TEXT NOT NULL,                       -- 省/直辖市，如"上海""广东"
  city        TEXT NOT NULL,                       -- 市，如"上海""广州"
  venue       TEXT NOT NULL,                       -- 具体场馆名
  address     TEXT,                                -- 场馆地址
  start_date  TEXT NOT NULL,                       -- 开始日期 YYYY-MM-DD
  end_date    TEXT,                                -- 结束日期（单日活动可为空）
  event_type  TEXT NOT NULL,                       -- 'doujin' | 'concert'
  scale       TEXT,                                -- 规模描述，如"全国大型""地方小型"
  qq_group    TEXT,                                -- 官方 QQ 群号
  ticket_url  TEXT,                                -- 购票链接
  poster_key  TEXT,                                -- R2 中的海报图 key
  price_info  TEXT,                                -- 票价信息，如"预售50元/现场60元"
  description TEXT,                                -- 补充描述
  view_count  INTEGER NOT NULL DEFAULT 0,          -- 浏览计数（去重后）
  status      TEXT NOT NULL DEFAULT 'pending',     -- 'pending' | 'approved' | 'rejected'
  deleted_at  TEXT,                                -- 软删除时间戳
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### event_works 表

```sql
CREATE TABLE event_works (
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  work_name  TEXT NOT NULL,                        -- 作品名，如"原神""明日方舟"
  PRIMARY KEY (event_id, work_name)
);
```

### 索引

```sql
CREATE INDEX idx_events_status_date ON events(status, start_date);
CREATE INDEX idx_events_province ON events(province, city);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_works_name ON event_works(work_name);
```

### 关键设计决策

- **ULID** 作为主键：自实现（`crypto.getRandomValues`），不用 `ulid` 包（它在 workerd 抛错）
- **province + city** 拆分：方便按省筛选、按市分组
- **event_type** 枚举：`doujin`（漫展/同人展）、`concert`（演唱会/Live）
- **poster_key** 存 R2 key：前端拼接 `PUBLIC_R2_BASE_URL` 或同源 `/r2/<key>` 兜底
- **status** 三态：提交默认 `pending`，管理员审核后变为 `approved` 或 `rejected`
- **view_count**：去重浏览计数，用 KV 做 IP 去重（TTL 24h）
- **deleted_at** 软删除：前端查询过滤 `deleted_at IS NULL`

## 5. 首页设计

### 布局

```
┌─────────────────────────────────────────┐
│  Header：站点名称 + Logo                │
├─────────────────────────────────────────┤
│  筛选器（地点/时间/类型/作品/规模）       │
├─────────────────────────────────────────┤
│  📍 你附近的活动                         │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │活动│ │活动│ │活动│ │活动│            │
│  │ 卡 │ │ 卡 │ │ 卡 │ │ 卡 │            │
│  └────┘ └────┘ └────┘ └────┘           │
├─────────────────────────────────────────┤
│  🔥 热门即将举办的活动                   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │活动│ │活动│ │活动│ │活动│            │
│  │ 卡 │ │ 卡 │ │ 卡 │ │ 卡 │            │
│  └────┘ └────┘ └────┘ └────┘           │
├─────────────────────────────────────────┤
│  📋 全部活动（筛选后完整列表）           │
│  ┌─────────────────────────────────┐    │
│  │ 活动卡片  活动卡片  活动卡片     │    │
│  │ 活动卡片  活动卡片  活动卡片     │    │
│  └─────────────────────────────────┘    │
│  [加载更多]                              │
├─────────────────────────────────────────┤
│  Footer                                 │
└─────────────────────────────────────────┘
```

### 定位方案

- Cloudflare Workers 自动在 `request.cf` 中注入地理位置（`city`、`region`、`country`）
- 首页 SSR 时读取 `cf.city` 或 `cf.region`，优先展示同省/同城市的 `approved` 活动
- 无定位信息时（如本地开发）默认展示全国
- "附近活动"栏：同省活动按 `start_date` 升序，取最近 8 个
- "热门活动"栏：`start_date >= 今天` 的活动按 `view_count` 降序，取前 8 个

### 活动卡片

每张卡片展示：

- 海报图（缩略图，R2 同源或占位图）
- 活动名称
- 日期
- 城市 + 场馆
- 类型标签（漫展/演唱会）
- 人气数（🔥 XXX）

### 筛选器

| 维度     | UI 组件                             | 数据来源                                                     |
| -------- | ----------------------------------- | ------------------------------------------------------------ |
| 地点     | 二级联动：省 dropdown → 市 dropdown | 中国省市静态数据（`data/provinces.json`，34省级 + 主要城市） |
| 时间     | 月份选择器（横向滚动月份标签）      | 前端组件                                                     |
| 活动类型 | Tab 切换：全部 / 漫展 / 演唱会      | 固定选项                                                     |
| 关联作品 | 搜索输入框 + 标签选择               | D1 `event_works` 表去重                                      |
| 活动规模 | Dropdown                            | 固定选项：全国大型/区域中型/地方小型/不限                    |

筛选条件同步到 URL query params（`/?province=上海&type=doujin&work=原神`），支持分享链接。

默认显示**未来活动**（`start_date >= 今天`），按 `start_date` 升序。分页：每页 20 条。

## 6. 事件详情页

**路由**：`/event/[id]`（SSR）

### 布局

```
┌─────────────────────────────────────────┐
│  ← 返回列表          [分享按钮]         │
├─────────────────────────────────────────┤
│  ┌──────────┐  活动名称                  │
│  │  海报图   │  类型标签：漫展/演唱会     │
│  │          │  规模：全国大型             │
│  └──────────┘  🔥 XXX 人关注            │
├─────────────────────────────────────────┤
│  📅 日期：2026-07-15 ~ 2026-07-16       │
│  📍 地点：上海市XX区XX路XX号 XX展馆       │
│  💰 票价：预售50元 / 现场60元            │
│  🎫 购票：[购票链接按钮]                 │
│  💬 QQ群：12345678（点击复制）            │
│  🏷️ 关联作品：原神 | 明日方舟 | ...      │
├─────────────────────────────────────────┤
│  补充描述...                             │
└─────────────────────────────────────────┘
```

### 交互

- 海报图点击放大（Lightbox）
- QQ 群号一键复制
- 购票链接外跳（`target="_blank"` + `rel="noopener"`）
- 分享按钮复制当前 URL

### SEO

- SSR 渲染，`<title>` 设为活动名称
- Open Graph meta 标签（活动名称 + 海报图）

### 浏览计数

- 页面加载时，客户端调用 `POST /api/events/[id]/view`
- 后端用 KV 记录 `event:{id}:ip:{ip_hash}` 做去重（TTL 24h），去重后 `view_count++`

## 7. 用户提交流程

### 流程

1. **`/submit` 页面**：表单填写所有字段 + 海报图上传
2. **客户端**：图片用 `browser-image-compression` 压缩（长边 1920px / WebP / 去 EXIF / ~500KB）
3. **`POST /api/submit/sign`**：
    - 校验 Turnstile token
    - IP 限频检查（KV：每日 10 次 + 30s 冷却）
    - 签发 HMAC ticket（绑定所有字段 + image_key + ip_hash + 过期时间）
4. **`POST /api/submit/commit`**（multipart）：
    - 校验 HMAC ticket + 过期
    - 海报图写入 R2（`BUCKET` 绑定直写）
    - 用 ticket 字段（不信任请求体）插入 D1 `events` 表（`status=pending`）
    - 插入 `event_works` 关联记录
    - 扣每日配额 + 启动冷却
5. **提交成功页**：提示"已提交，待审核"

### 表单字段

| 字段      | 必填 | 说明                       |
| --------- | ---- | -------------------------- |
| 活动名称  | ✅   |                            |
| 省/市     | ✅   | 二级联动                   |
| 具体场馆  | ✅   |                            |
| 场馆地址  |      |                            |
| 开始日期  | ✅   |                            |
| 结束日期  |      |                            |
| 活动类型  | ✅   | 漫展/演唱会                |
| 规模描述  |      | 全国大型/区域中型/地方小型 |
| 关联作品  |      | 可添加多个标签             |
| QQ 群号   |      |                            |
| 购票链接  |      |                            |
| 票价信息  |      |                            |
| 海报图    |      | 图片上传                   |
| 补充描述  |      |                            |
| Turnstile | ✅   | 验证码                     |

## 8. 管理员后台

### 认证

- **生产**：Cloudflare Access（Zero Trust）边缘鉴权，注入 `Cf-Access-Authenticated-User-Email`
- **本地**：`.dev.vars` 中的 `DEV_ADMIN_EMAIL` mock
- Worker 信任该头，匿名流量到不了 `/admin` 和 `/api/admin/*`

### 功能

| 功能       | 说明                                                   |
| ---------- | ------------------------------------------------------ |
| 待审核列表 | 显示所有 `status=pending` 的事件，按提交时间排序       |
| 审核操作   | 通过（→`approved`）/ 拒绝（→`rejected`），可附审核备注 |
| 已通过列表 | 查看/编辑/删除已发布的事件                             |
| 已拒绝列表 | 查看被拒绝的事件                                       |
| 软删除     | 置 `deleted_at`，前端过滤 `deleted_at IS NULL`         |

### API 端点

- `GET /api/admin/events?status=pending` — 获取待审核列表
- `POST /api/admin/events/:id/approve` — 通过
- `POST /api/admin/events/:id/reject` — 拒绝
- `PUT /api/admin/events/:id` — 编辑
- `DELETE /api/admin/events/:id` — 软删除

## 9. 防滥用方案

- **IP 限频**：Cloudflare KV，键用哈希后的 IP
    - 提交：每日 10 次 + 30s 冷却
    - 浏览计数：每日每事件 1 次去重
- **Cloudflare Turnstile**：提交表单时前端渲染，后端 siteverify
- **软删除**：管理员删除时置 `deleted_at`，不物理删除，可恢复

## 10. 环境变量 / 绑定

| 名称                        | 类型     | 用途                                               | 本地                       | 生产                                  |
| --------------------------- | -------- | -------------------------------------------------- | -------------------------- | ------------------------------------- |
| `DB`                        | D1       | events + event_works                               | miniflare 自动             | `wrangler.jsonc` 填真实 `database_id` |
| `BUCKET`                    | R2       | 海报图存储                                         | miniflare 自动             | `wrangler.jsonc`（`bucket_name`）     |
| `RATE_LIMIT`                | KV       | IP 限频计数 + 冷却                                 | miniflare 自动             | `wrangler.jsonc` 填真实 KV id         |
| `SESSION`                   | KV       | Astro CF 适配器 session API 要求的绑定（不实际写） | miniflare 自动             | `wrangler.jsonc` 填真实 KV id         |
| `TURNSTILE_SECRET_KEY`      | 密钥     | 后端 siteverify                                    | `.dev.vars`（测试 secret） | `wrangler secret put`                 |
| `PUBLIC_TURNSTILE_SITE_KEY` | 公共 var | 前端 Turnstile widget                              | `.env.development`         | `.env.production`                     |
| `PUBLIC_R2_BASE_URL`        | 公共 var | 拼接海报图 URL；空 → 同源 `/r2/<key>` 兜底         | `.env.development`（空）   | `.env.production`                     |
| `PUBLIC_SITE_URL`           | 公共 var | 站点基址                                           | `http://localhost:4321`    | 生产域名                              |
| `DEV_ADMIN_EMAIL`           | 仅本地   | mock 管理员身份                                    | `.dev.vars`（任意邮箱）    | **绝不设置**（用 Cloudflare Access）  |

## 11. 项目结构

```
eventlist/
├── astro.config.mjs          # Astro 6 + CF Workers 适配器 + Tailwind v4 Vite 插件
├── wrangler.jsonc            # CF 绑定：DB(D1) / BUCKET(R2) / RATE_LIMIT,SESSION(KV) / vars
├── drizzle.config.ts         # drizzle-kit 配置
├── data/
│   └── provinces.json        # 中国省市静态数据（34省级 + 主要城市）
├── migrations/               # D1 迁移文件
├── seeds/                    # 本地 demo 种子数据
├── public/
│   └── placeholder-poster.svg # 默认占位海报
├── src/
│   ├── env.d.ts              # Cloudflare.Env 绑定类型
│   ├── middleware.ts          # admin 路由守卫
│   ├── styles/global.css     # Tailwind v4 + 设计 token
│   ├── types/event.ts        # Event 类型定义（单一真源）
│   ├── lib/                  # 工具函数（id生成、限频、turnstile验证等）
│   ├── server/               # Worker 侧：db schema、API 处理
│   ├── components/
│   │   ├── FilterBar.tsx          # 筛选器 React Island
│   │   ├── NearbyEvents.tsx       # 附近活动栏
│   │   ├── PopularEvents.tsx      # 热门活动栏
│   │   ├── EventCard.tsx          # 活动卡片组件
│   │   ├── EventList.tsx          # 全部活动列表（分页）
│   │   ├── SubmitForm.tsx         # 提交表单 React Island
│   │   ├── PosterLightbox.tsx     # 海报放大 Lightbox
│   │   └── CopyButton.tsx         # QQ群号复制按钮
│   └── pages/
│       ├── index.astro            # 首页
│       ├── event/[id].astro       # 事件详情页
│       ├── submit.astro           # 提交表单页
│       ├── admin.astro            # 管理后台页
│       └── api/
│           ├── submit/sign.ts     # 提交签名
│           ├── submit/commit.ts   # 提交确认
│           ├── events.ts          # 事件列表查询
│           ├── events/[id]/view.ts # 浏览计数
│           └── admin/             # 管理员 API
└── package.json
```

## 12. 初始化命令

```bash
# 1. 用 Astro CLI 创建项目（选择 Cloudflare Workers 模板）
pnpm create cloudflare@latest my-astro-app --framework=astro

# 2. 添加集成
pnpm astro add react
pnpm astro add tailwind

# 3. 安装依赖
pnpm install drizzle-orm @astrojs/cloudflare
pnpm install -D drizzle-kit wrangler
pnpm install lucide-react yet-another-react-lightbox
pnpm install browser-image-compression

# 4. 准备本地密钥
cp .dev.vars.example .dev.vars

# 5. 初始化本地 D1
pnpm run db:migrate:local

# 6. 启动开发服务器
pnpm run dev        # 纯页面开发，最快 HMR
# 或
pnpm run preview    # 全功能（含绑定 + API，走 miniflare）
```

## 13. 部署到 Cloudflare

```bash
# 1. 创建 D1 / KV / R2 资源
wrangler d1 create acg-events
wrangler kv namespace create RATE_LIMIT
wrangler kv namespace create SESSION       # Astro CF 适配器要求（不实际使用）
wrangler r2 bucket create acg-events-posters

# 2. 把返回的真实 id 填进 wrangler.jsonc

# 3. 应用迁移到远程 D1
pnpm run db:migrate:prod

# 4. 下发 Turnstile 生产密钥
wrangler secret put TURNSTILE_SECRET_KEY

# 5. 部署
pnpm run deploy
```

## 14. pnpm 脚本

| 命令                                  | 作用                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `pnpm run dev`                        | `astro dev`，页面热更新                                       |
| `pnpm run build`                      | `astro build`                                                 |
| `pnpm run preview`                    | `astro build` 后 `wrangler dev -c dist/server/wrangler.json`  |
| `pnpm run typecheck`                  | `astro check`                                                 |
| `pnpm run format`                     | Prettier 格式化                                               |
| `pnpm run db:generate`                | `drizzle-kit generate`                                        |
| `pnpm run db:migrate:local` / `:prod` | `wrangler d1 migrations apply`                                |
| `pnpm run cf-typegen`                 | `wrangler types`                                              |
| `pnpm run deploy`                     | `astro build && wrangler deploy -c dist/server/wrangler.json` |
