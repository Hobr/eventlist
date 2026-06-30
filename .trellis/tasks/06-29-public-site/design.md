# Design: 前台站点(public-site)

## 路由与渲染

| 路由           | 方法 | 渲染 | 说明                                                    |
| -------------- | ---- | ---- | ------------------------------------------------------- |
| `/`            | GET  | SSR  | 首页:定位城市 + 近期活动 + 城市选择器 + 筛选入口        |
| `/events`      | GET  | SSR  | 活动列表 + 筛选(查询参数驱动,可 SSR 首屏 + Svelte 增量) |
| `/events/[id]` | GET  | SSR  | 活动详情;pending/rejected → 404,offline → 下线提示      |
| `/submit`      | GET  | SSR  | 投稿表单(含 Turnstile)                                  |
| `/api/submit`  | POST | JSON | 投稿接口                                                |
| `/api/cities`  | GET  | JSON | 城市列表(供选择器,也可直接 SSR 注入)                    |
| `/api/tags?q=` | GET  | JSON | 标签模糊搜索(供筛选/投稿标签输入)                       |
| `/sitemap.xml` | GET  | SSR  | 由 `@astrojs/sitemap` 生成,收录 published 详情          |

## 数据流

### 首页定位

```
request.cf.city / request.cf.region  ──(映射 cities)──▶ cityId
  映射失败 → 默认城市(常量 DEFAULT_CITY_ID,如北京)
localStorage(cityId) ──(客户端切换)──▶ 覆盖
查询: events WHERE status='published' AND city_id=? AND end_date>=date('now') ORDER BY start_date LIMIT 8
```

映射规则:`cities` 表按 `name` 唯一;IP 城市(中文或英文)做归一化匹配(去"市"字、大小写),失败回退默认。

### 列表筛选

查询参数:`city`、`type`、`scale`、`tag`、`from`、`to`、`page`、`sort`。

```sql
SELECT e.* FROM events e
  WHERE e.status='published' AND e.end_date >= date('now')
    [AND e.city_id=?][AND e.type=?][AND e.scale=?]
    [AND e.start_date>=?][AND e.end_date<=?]
    [AND EXISTS(SELECT 1 FROM event_tags et JOIN tags t ON et.tag_id=t.id
                WHERE et.event_id=e.id AND t.name LIKE ? ESCAPE '\')]
  ORDER BY e.start_date [ASC|DESC] LIMIT 20 OFFSET ?
```

标签筛选:高频下拉来自 `SELECT t.name, COUNT(*) c FROM event_tags et JOIN tags t ON et.tag_id=t.id JOIN events e ON et.event_id=e.id WHERE e.status='published' GROUP BY t.name ORDER BY c DESC LIMIT 20`;模糊搜索用 `LIKE`。

### 投稿写入(事务)

```
POST /api/submit
  1. 校验 Turnstile(token → siteverify)
  2. 校验必填 + type∈event_types + scale∈event_scales + city∈cities + 日期合法
  3. 事务:
     a. INSERT events(status='pending', ...)
     b. 对每个 tag: INSERT OR IGNORE tags(name) ; 取 id ; INSERT OR IGNORE event_tags
  4. 返回 {ok:true}
```

Turnstile 校验:`fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {secret, response, remoteip})`。

### 详情可见性

```
SELECT e.*, c.name city_name, et.label type_label, es.label scale_label
  FROM events e JOIN cities c ... JOIN event_types et ... JOIN event_scales es ...
  WHERE e.id=?
status: published → 200; offline → 200 + 下线横幅; pending/rejected/不存在 → 404
```

## 组件结构(src)

> 视觉规范见 `.trellis/spec/frontend/design-system.md`(Material Design 3)。实现首步先建 `src/styles/tokens.css`(M3 配色/排印/高度/形状/动效 token)与基础组件类,所有页面/组件基于 token 构建。不引入 Tailwind;Svelte 组件以 scoped CSS + token 实现。

```
src/
  styles/
    tokens.css        (M3 color/type/elevation/shape/motion tokens, light+dark)
    base.css          (reset + 基础元素样式)
  layouts/
    Base.astro          (HTML 骨架 + SEO meta + JSON-LD 注入槽 + M3 主题应用)
  components/
    CitySelector.svelte (Material dropdown / 持久化)
    FilterBar.svelte    (Material chips / text fields / selects)
    EventCard.astro     (Material card 列表项)
    TagInput.svelte     (Material chip input + /api/tags 模糊提示)
    Turnstile.svelte    (渲染 Turnstile widget,回传 token)
    ui/                 (薄封装:M3 Button / TextField / Chip / Dialog / Snackbar,供全站复用)
  pages/
    index.astro
    events/
      index.astro       (列表)
      [id].astro        (详情)
    submit.astro
    api/
      submit.ts         (POST handler)
      cities.ts         (GET)
      tags.ts           (GET ?q=)
  lib/
    db/                 (foundation-db 提供;本任务追加查询函数)
      queries.ts        (扩展:listPublishedEvents(filters), getEvent(id), insertSubmission(payload), searchTags(q), topTags(n))
    geo.ts              (IP 城市映射:normalizeCity() + matchCity(db))
    turnstile.ts        (siteverify 封装)
    seo.ts              (JSON-LD Event 构造)
```

## 环境变量

- `TURNSTILE_SECRET_KEY`(Server secret)
- `TURNSTILE_SITE_KEY`(Client widget key,可暴露)
- `DEFAULT_CITY_ID`(定位失败回退)
- 在 `wrangler.jsonc` `vars` 声明;secret 用 `wrangler secret put`。

## Rate Limiting

在 `wrangler.jsonc` 顶层:

```jsonc
"routes": { /* 部署时 */ },
// Rate limiting via [rules] (新格式) 或 Dashboard:
"rate_limit": [{
  "match": { "requests": { "paths": ["/api/submit"] } },
  "simple": { "rate": 3, "period": 600 },
  "action": { "type": "block" }
}]
```

> 最终语法以当前 wrangler 版本支持为准;实现时核对 `wrangler` 文档。

## SEO

- `@astrojs/sitemap` 已集成;详情页 `getStaticPaths`/SSR 收录需在 sitemap 配置中提供 published id 列表(或用 sitemap 自定义 endpoint 查 D1)。
- 详情页 JSON-LD:

```json
{"@context":"https://schema.org","@type":"Event","name":...,"startDate":...,"endDate":...,"location":{"@type":"Place","name":venue,"address":address},"image":cover_url,"url":canonical}
```

## 兼容性与回滚

- 纯新增路由/文件,不影响现有空脚手架。
- API 失败回退:Turnstile/DB 异常返回 500 + 友好提示,不暴露内部信息。
- 回滚点:每个路由独立,可单独删除。

## 风险与权衡

- **封面用外 URL**:依赖外链可用性;详情页 `<img>` 加 `onerror` 回退占位图。优点:零存储成本。
- **SSR 首屏 vs 全 Svelte**:列表首屏 SSR(利于 SEO),切换筛选用客户端 fetch `/events?...` 增量更新或直接跳转;MVP 选**直接跳转带查询参数**(简单、可分享、SEO 友好),交互复杂度低。
- **标签 LIKE 全表扫**:数据量级(民间站,千级活动)下可接受;后续量大再加 FTS5。
