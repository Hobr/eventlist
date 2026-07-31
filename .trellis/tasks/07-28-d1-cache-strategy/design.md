# Technical Design

## 0. 免费方案前提与预算

本服务部署在 Cloudflare 免费方案上。以下四条额度按"最先撞上"排序，实施与监控都以这个顺序为准：

| 约束 | 免费额度 | 当前主要消耗方 | 本方案的作用 |
| --- | --- | --- | --- |
| Worker CPU / 请求 | **10 ms**，超限 Error 1102 | Astro SSR 渲染 | **净增加**（envelope JSON、SHA-256、`waitUntil` 刷新），必须实测 |
| Worker 请求 / 日 | 100,000，超限 Error 1027 | 页面 SSR + 统计 POST | 热度标记省掉重复 POST，净减少 |
| D1 `rows_read` / 日 | 5,000,000 | `event_visitors` 全表扫描 | 索引改写为主，缓存为辅 |
| D1 `rows_written` / 日 | 100,000 | 首次/跨日访客 + 索引行 | 标记去重 + 关系差异写 |

### 0.1 Cache API 的部署前提（阻断项）

官方文档对 Cache API 的可用范围是枚举式的：*"Workers deployed to custom domains have access to functional `cache` operations. So do Pages functions, whether attached to custom domains or `*.pages.dev` domains."* `*.workers.dev` 不在该列表内；Miniflare 也为此保留了 `cacheWarnUsage`（"Warn on cache usage, for workers.dev subdomains"）。

因此本方案的第 1、2 条路径**以 Worker 绑定自定义域名（Workers 路由或 Custom Domain）为前提**。目标域名已确定为 `acg.hobr.site`；当前 `wrangler.jsonc` 既无 `routes` 也无自定义域，必须在实现缓存层之前完成绑定。

本地 `astro dev` 的 Miniflare 会正常模拟命中，**无法证明生产可用**。上线顺序中必须包含一次真实 hostname 上的探针验证：在 `https://acg.hobr.site` 上用合成 GET 先 `cache.put()` 再 `cache.match()`，把命中结果放进响应头确认。探针未通过前不得启用任何 `PUBLIC_DATA_CACHE_SCOPES`。

### 0.2 CPU 预算

免费版 CPU 上限为每次 HTTP 请求 10 ms，Cron 同样是 10 ms。官方说明"处理鉴权、服务端渲染或解析大负载的工作负载通常消耗 10-20 ms"，本项目正处于该区间边缘。

关键推论：等待 D1 **不计入** CPU，因此缓存命中省下的是延迟而不是 CPU；而本方案新增的 envelope `JSON.parse` / `JSON.stringify`、标记摘要 SHA-256、以及 `waitUntil()` 后台刷新**全部计入同一次调用的 10 ms 预算**。

约束：

- 实施前后必须分别记录 CPU time 基线（`observability.enabled` 已开启，Workers Logs 逐次调用可见 CPU/wall time）。
- 后台刷新只允许刷新当前请求实际使用的键，不得在一次 `waitUntil` 中批量预热多个键。
- 列表 DTO 的 `JSON.stringify` 体积随 `pageSize` 增长，列表缓存（scope `list`）必须在 CPU 基线确认有余量后才启用。
- 若 CPU p99 逼近 10 ms，优先降低渲染/序列化成本，而不是继续增加缓存层。

### 0.3 subrequest 预算

免费版每次调用 50 个 subrequest，**D1 调用与 Cache API 的 `put()` / `match()` / `delete()` 共用这一配额**；`waitUntil()` 中的调用同样计入本次调用。

约束：

- 单次公开读取路径的缓存调用 + D1 调用不得超过 10。
- 写后失效的 `delete()` 总数硬上限为 24（见 §9），超出部分交由 TTL 兜底，不得无界扩张。

## 1. 设计决策

本任务采用五条互补路径：

1. 使用 Cloudflare Cache API 对公开 DTO 做数据级读穿缓存，减少重复 D1 查询。
2. 使用独立的 Cache API 当日成功标记，抑制同活动/IP/中国日期的重复热度 D1 调用。
3. 去掉规范日期/时间列外层不必要的 SQLite 转换函数，让缓存未命中也尽量少读行。
4. 将访客过期清理移出详情访问，交给每天一次的 Worker Cron。
5. 按公开读取、热度、标签和管理员业务操作收口数据库接口，消除无效往返、逐标签 N+1 和无差异全量写入。

不缓存完整 HTML。首页仍先运行 `resolveSelectedDivision()`，再按最终 `divisionCode + popularityWindow` 读取缓存，因此查询参数、Cloudflare IP 定位和默认地区不会串用。

不引入 KV、Durable Objects、Queues、R2 快照或第三方缓存。Cache API 标记可随时丢失，D1 始终是唯一可写事实来源。

## 2. 缓存边界

新增一个服务器端公开数据缓存层，建议放在 `src/lib/cache/public-data.ts`。缓存层只接收已经逐字段投影的 DTO，不接收原始 `EventRecord`。

使用独立命名空间：

```ts
await caches.open("eventlist-public-data-v2");
```

命名空间版本用于部署级逻辑失效。缓存键使用当前请求 origin 下的保留合成路径，且只用于 Cache API：

```text
/_eventlist_cache/v2/home-discovery?division=11
/_eventlist_cache/v2/popularity?division=11&window=7
/_eventlist_cache/v2/event-list?...规范化筛选...
/_eventlist_cache/v2/event-detail?id=123
/_eventlist_cache/v2/top-tags?limit=20
/_eventlist_cache/v2/tag-search?q=同人&limit=12
/_eventlist_cache/v2/sitemap?limit=1000
```

使用命名缓存避免与真实公开路由或默认 `fetch()` 缓存条目混用。缓存请求始终是无 Cookie、无 Authorization、无用户请求头的合成 GET。

## 3. 公开 DTO

缓存层允许的值：

- 首页发现：现有 `PublicFeaturedEvent[]` 和 `PublicEventRow[]`
- 热门榜：现有 `PublicHomepagePopularity`
- 活动列表：新增 `PublicEventPage`，只含 `PublicEventRow[]`、`page`、`pageSize`、`hasNext`
- 活动详情：新增 `PublicEventDetail`，只含页面实际展示的内容、`published | offline` 状态和规范标签
- 标签：现有 `TagSummary[]`
- sitemap：`SitemapEventRow[]`

`PublicEventDetail` 可以包含公开的 `source_url`、购票、地址和交流群字段，但不得包含：

- `submitter_contact`
- `tag_suggestions`
- `reject_reason`
- 审计数据
- 匿名访客键
- pending/rejected 记录

详情和列表页面改为消费公开 DTO，避免即使内部缓存被误用也保存非公开字段。

## 4. 缓存键规范化

所有键由结构化参数生成，并用固定字段顺序写入 `URLSearchParams`。不得直接使用原始查询字符串，因为参数顺序、无效字段和默认值会造成重复键或错误共享。

### 首页和热门

- 先用现有地区守卫解析有效地区。
- 首页发现键：`division`。
- 热门键：`division + window(3|7|30)`。
- `/`、`/api/homepage` 和 `/api/popularity` 必须复用同一缓存函数和键生成器。

### 活动列表

键包含最终有效值：

- `timing`
- `divisionCode`
- `type`
- `scale`
- `tag.trim()`
- `from` / `to` / `starts` / `active`
- 有效排序；未显式传入时写入实际默认排序
- 已钳制的 `page` 和 `pageSize`

准入规则：

- 第一阶段只缓存第 1-3 页。
- 无效参数仍按现有路由规则忽略或回退，但键只使用解析后的值。
- 超过合理长度的自由文本查询照常访问 D1，但绕过缓存，防止攻击者制造大量一次性键。
- 所有筛选组合必须继续返回现有结果；准入只决定“是否缓存”，不改变查询。

### 标签

- 空查询使用固定 `top-tags` 键。
- 非空查询使用 `trim()` 后的精确字符串和 limit。
- 仅缓存长度 1-24 的常规联想词；更长查询绕过缓存，保持现有子串搜索语义。

### 详情与 sitemap

- 详情只按安全正整数 ID。
- 不缓存不存在、pending 或 rejected 的负结果，避免新发布活动被旧 404 阻塞。
- sitemap 使用固定 limit 键。

## 5. 时间策略

缓存响应保存：

```ts
interface CachedEnvelope<T> {
    schema: 2;
    generatedAt: number;
    freshUntil: number;
    normalUntil: number;
    errorUntil: number;
    value: T;
}
```

| 数据 | 新鲜期 | 正常陈旧上限 | 仅 D1 故障可用上限 |
| --- | --- | --- | --- |
| 首页发现 | 40-50 秒抖动 | 60 秒 | 10 分钟 |
| 热门榜 | 25-35 秒抖动 | 60 秒 | 5 分钟 |
| 活动列表 | 40-50 秒抖动 | 60 秒 | 5 分钟 |
| 活动详情 | 40-50 秒抖动 | 60 秒 | 5 分钟 |
| 热门标签/标签联想 | 40-50 秒抖动 | 60 秒 | 10 分钟 |
| sitemap | 60 秒 | 60 秒 | 30 分钟 |

抖动由缓存键稳定计算，只改变后台刷新开始时间，不改变 60 秒正常上限。它用于避免所有热点键在同一秒同时回源。

状态机：

1. `now <= freshUntil`：立即返回缓存。
2. `freshUntil < now <= normalUntil`：立即返回缓存，并通过 `waitUntil()` 后台刷新。
3. `normalUntil < now <= errorUntil`：阻塞尝试 D1；成功时返回新值，只有 D1 失败才返回旧值。
4. `now > errorUntil`：缓存不可用；按现有错误路径处理 D1 失败。

Cache API 保存时间使用最长故障 TTL；是否可以返回由 envelope 时间戳决定，因为 Cache API 不原生支持 `stale-while-revalidate` 或 `stale-if-error`。

## 6. 并发回源控制

模块级 `Map<string, Promise<LoadResult>>` 只用于同一 isolate 内的进行中 Promise 合并：

- 同一键同时未命中时只运行一个 D1 loader。
- 不同键互不阻塞。
- Promise 在 `finally` 中删除。
- isolate 被回收只会失去优化，不影响正确性。

Cache API 本身按数据中心隔离，不能提供全球请求合并。第一阶段接受每个活跃数据中心各自填充一次缓存，不增加 Durable Object 协调层。

## 7. 热度写入专用路径

### 7.1 保留当前精确语义

`event_visitors` 的一行表示“某个活动下某个事件级 IP 摘要的最近访问日期”。这正好支持重叠窗口：只要 `last_seen_date` 落在近 3/7/30 日内，该访客就在对应窗口计一次。

因此不能改成每天一个累计数字。将每日独立访客相加会把跨日回访的同一 IP 重复计算，也无法从 30 日累计值精确推导 3 日或 7 日独立访客。

当前写入预算应按以下口径理解：

- 首次访问或跨日回访可能产生一条逻辑访客写入。
- 同日重复访问因 `WHERE event_visitors.last_seen_date <> excluded.last_seen_date` 不产生逻辑行变更，但当前仍会调用 D1。
- D1 会把表和受影响索引分别计入 `rows_written`。`event_visitors` 具有复合主键和 `idx_event_visitors_recent`，所以 10 万写入行不等于 10 万独立访客。
- Cache API 标记减少的是同日重复 D1 操作，不会省掉业务上确实需要的首次或跨日最近访问日期更新。

### 7.2 当日成功标记

使用独立命名缓存，避免与公开 DTO 混用：

```ts
await caches.open("eventlist-view-dedupe-v1");
```

标记维度为：

```text
event-scoped visitor key + China-local date
```

现有 `visitorKey` 已经由 `HMAC-SHA-256(eventId + IP, VIEW_HASH_SECRET)` 按活动隔离。缓存 URL 不直接放入 `visitorKey`，而是再次计算不可逆摘要：

```text
markerDigest = SHA-256("v1\n" + chinaDate + "\n" + visitorKey)
/_eventlist_cache/v1/view-dedupe/<chinaDate>/<markerDigest>
```

合成请求始终为无 Cookie、无用户请求头的 GET。响应只保存一个内部成功标记，TTL 为“距离下一个中国本地零点的秒数 + 2 小时安全余量”；日期同时进入键，因此标记绝不会跨日阻止必要更新。

缓存 URL、日志和响应均不得包含原始 IP、`visitorKey` 或 `VIEW_HASH_SECRET`。

### 7.3 请求流程

详情 SSR 与统计 POST 共同使用同一标记 helper：

1. `/events/:id` 取得已发布活动后，用当前请求 IP 和 Secret 计算当天标记键。
2. 标记命中时，SSR 不输出 `data-event-view-endpoint`，从而省略本次独立统计 POST；页面正文仍正常返回。
3. 标记未命中、Cache API 不可用、IP 缺失或本地开发无法判断时，SSR 保留现有后台 POST。SSR 只读标记，不写 D1，因此不会把爬虫或未执行 JavaScript 的访问改成热度。
4. `/api/events/:id/view` 重新执行现有 ID、同源、IP 和 Secret 校验，并再次检查标记，以覆盖直接调用和并发竞态。
5. POST 标记未命中时，以标记键进入 isolate 内 `Map<string, Promise<boolean>>`，合并同一实例的并发首次请求。
6. D1 batch 先执行现有条件 upsert，再查询该 `(event_id, visitor_key)` 是否已经具有当天 `last_seen_date`。这一步可区分“同日已存在”与“活动无效/已结束导致未记录”。
7. 只有确认当日记录存在后才 `cache.put()` 标记；随后返回 204。D1 失败或未确认记录时不写标记。

同日 Cache API 标记被驱逐时，第一次恢复请求会再访问 D1；若数据库行已经是当天，upsert 仍是 0 逻辑变更，验证查询成功后重新建立标记。

### 7.4 正确性与并发边界

| 情况 | 结果 |
| --- | --- |
| 同一 isolate 并发首次访问 | Promise 合并，只执行一个 D1 batch |
| 不同 isolate 或不同数据中心并发 | 可能执行多个 D1 batch；复合主键和条件更新保证只有所需逻辑写入 |
| Cache API 标记丢失/过期过早 | 只增加一次 D1 校验，不少计 |
| `cache.put()` 失败 | D1 事实已正确；后续重复访问可能再次校验 D1 |
| D1 失败 | 不写标记，客户端仍按现有方式静默忽略统计失败，后续访问可以重试 |
| IP、活动或中国日期变化 | 生成不同标记键，正常执行新的合法记录 |

Cache API 按数据中心隔离，不能作为全局锁；它只负责减少重复调用。跨数据中心正确性继续由 D1 保证。

### 7.5 过期清理

从 `recordEventView()` 删除每次请求执行的全局清理，新增独立的 `deleteExpiredEventVisitors()`：

```sql
DELETE FROM event_visitors
WHERE last_seen_date < date('now', '+8 hours', '-29 days')
```

直接比较规范日期列，使 `idx_event_visitors_recent(last_seen_date, event_id)` 可用于定位过期范围。

项目使用 Astro 7 / `@astrojs/cloudflare` 14，可按官方自定义入口方式新增 `src/worker.ts`：标准 `fetch` handler 委托给 `@astrojs/cloudflare/handler`，并在同一导出对象中增加 `scheduled()`。`wrangler.jsonc` 将 `main` 指向该文件，并配置 `5 16 * * *`，即每天中国时间 00:05 执行一次。

Cron 每天只增加一次 Worker 调用。即使 Cron 延迟或失败，热门 SQL 自身仍限定近 3/7/30 日，不会把过期行展示出来；影响仅限匿名摘要的存储回收，下一次 Cron 或人工维护可恢复。清理结果只记录聚合行数和错误，不记录访客标识。

### 7.6 热门读取刷新

热门榜继续使用 25-35 秒新鲜期、60 秒正常硬上限。访问写入不主动删除热门缓存：逐访客失效会把热点写流量转换成热门 SQL 回源风暴，反而消耗更多 D1 读取并造成排名组件抖动。

Cache API 标记本身不能消除首次统计 POST，也不能绕过 Workers Free 的 10 万请求/日上限。详情 SSR 的标记命中判断可以省略同一数据中心内后续重复 POST，但首次、跨日、IP 变化、标记丢失和跨数据中心访问仍会产生统计请求。

## 8. 失败与用户体验

- `cache.match()` 失败或条目损坏：视为未命中，回源 D1。
- `cache.put()` / `cache.delete()` 失败：记录采样诊断，但不让原成功请求失败。
- D1 正常时，超过 60 秒的条目必须阻塞刷新，不得继续返回旧值。
- D1 故障且存在 `errorUntil` 内的安全缓存：
  - JSON API 增加 `X-Eventlist-Cache: STALE-IF-ERROR` 和对应 `Server-Timing` 标记。
  - SSR 页面保留内容并显示克制的“数据暂时无法刷新，当前显示最近缓存”提示。
  - sitemap 返回最近完整缓存；无缓存时保留现有仅静态 URL 的降级。
- 无可用缓存时维持现有错误状态和状态码。

成功的 `/api/homepage`、`/api/popularity` 和 `/api/tags` 可返回 `Cache-Control: private, max-age=15`，减少同一浏览器快速往返；错误响应使用 `no-store`。HTML 页面不做共享响应缓存，保留 SSR、地区解析、浏览器历史和现有客户端状态。

## 9. 写后失效

数据库业务操作的事实写入和审计成功后执行 best-effort 本地失效。Cache API 失效不得加入 D1 原子批次，也不得因失败回滚事实写入。

| 写入 | 本地立即失效 | 全球保证 |
| --- | --- | --- |
| 公共投稿 | 无 | pending 不公开 |
| 管理员创建/批量创建 | 预算内的已知地区首页/热门键、top tags、sitemap | 超出预算及其他列表/标签键最多 60 秒 |
| 管理员编辑 | 预算内的详情、旧/新地区首页/热门、top tags、sitemap | 超出预算及无法枚举的筛选/联想键最多 60 秒 |
| 审核通过/下线/重新发布 | 预算内的详情、已知地区首页/热门、top tags、sitemap | 超出预算的固定键与所有公开聚合最多 60 秒 |
| 驳回 | 仅在此前可能公开时才失效；正常无需 | pending 数据从未缓存 |
| 标签归并 | top tags；可识别的详情键 | 搜索和筛选键最多 60 秒 |
| 详情访问 | 当前 `division + window` 热门键可不主动删除 | 热门榜按 25-35 秒开始刷新，最多 60 秒 |

失效 helper 接收 origin 和数据库操作直接返回的 `MutationImpact`。无法安全枚举的高基数列表键不尝试全量删除，由正常 TTL 保证边界；路由不得为构造失效提示再次查询 D1。

### 9.1 地区键必须按祖先前缀展开

`src/lib/geo.ts` 的 `parseDivisionCode()` 接受 2 / 4 / 6 / 12 位地区码，而 `divisionFilter()` 只对 6 位和 12 位使用 `=`，其余长度使用前缀 `LIKE`。因此一个 `110101` 的活动会同时出现在 `division=11`、`division=1101` 和 `division=110101` 三套首页发现与热门缓存中。

失效时只删除活动自身的精确地区码会漏掉省级与市级键，与本节表格"本地立即失效"的承诺不符。失效 helper 必须由活动地区码推导祖先集合：

```text
divisionKeys(code) = { province(code), city(code), code }
```

对每个祖先地区码失效 `home-discovery` 一个键和 `popularity` 三个窗口键（3 | 7 | 30）。单侧地区因此最多 3 × 4 = 12 个键，编辑活动涉及旧/新两侧时最多 24 个键——即 §0.3 规定的 `delete()` 硬上限。旧/新地区相同或批量活动落在同一地区时，按规范 URL 去重后实际键数更少。

当 `homepage` 与 `popularity` 同时启用，且旧/新地区各展开为三个不同祖先时，地区聚合会完整占用 24 次预算。为了同时满足 R27 的硬上限和 R28 的旧/新祖先覆盖，失效 helper 必须先加入地区聚合键，再加入详情、`top-tags` 和 `sitemap` 固定键；预算耗尽时，后者不再声称本地立即失效，而是依赖正常 TTL 在最多 60 秒内收敛。

`top-tags` 与 `sitemap` 是固定低基数键，不受地区影响。活动列表与标签联想的组合键不可枚举，同样由 60 秒正常上限兜底。

## 10. 查询优化

迁移已保证日期/时间文本规范化，因此执行以下等价改写：

| 当前 | 改写 |
| --- | --- |
| `date(events.start_date)` | `events.start_date` |
| `date(events.end_date)` | `events.end_date` |
| `time(events.start_time)` | `events.start_time` |
| `time(events.end_time)` | `events.end_time` |
| `date(last_seen_date)` | `last_seen_date` |
| `datetime(updated_at)` | `updated_at` |

右侧仍使用 `date('now', '+8 hours')` / `time('now', '+8 hours')`，保持中国本地时间口径。用户日期参数已经由路由验证为 `YYYY-MM-DD`，可直接绑定比较。

第一阶段不新增索引。活动列表的标签聚合和排序仍可能使用临时 B-tree，但现有数据规模和索引已经足够；先通过缓存命中率和 D1 `rows_read` 观察真实收益，再决定是否重写为“先分页事件、后聚合标签”的两阶段 SQL。

## 11. 数据库访问边界与写操作收口

### 11.1 D1 binding 与模块边界

`src/lib/db/index.ts` 的 `getDB()` 改为只校验并同步返回 `runtimeEnv.DB`，删除运行时 `ensureFK()`。D1 官方文档确认外键默认对所有查询和迁移启用，用户查询不能关闭；`migrations/0001_init.sql` 顶部的 PRAGMA 可以保留，用于表达 schema 意图和本地 SQLite 兼容，但不得在每个请求重复执行。

将 1008 行的 `queries.ts` 按职责拆为小模块，避免缓存 loader、公开 DTO 和管理写入继续共享完整记录类型：

- `public-events.ts`：公开列表、详情、sitemap 与公开字段投影
- `homepage.ts`：发现区和热门榜读取
- `views.ts`：访问记录、当日确认和过期清理
- `tags.ts`：公开标签读取与集合式规范标签解析
- `admin-events.ts`：创建、编辑、状态变更、标签归并和审计
- `submissions.ts`：公共投稿写入和批量预览所需读取

执行期间可以暂时保留 `queries.ts` 作为仅 re-export 的兼容入口，待路由迁移完成后再删除；不新增抽象 `Repository<T>`、Unit of Work 或 ORM。

### 11.2 公开读取投影

建立共享的 `PUBLIC_EVENT_COLUMNS`，只选择页面和 JSON 实际需要的字段。公开详情查询直接在 SQL 中使用：

```sql
WHERE events.id = ?
  AND events.status IN ('published', 'offline')
```

它不再调用管理用途的 `getEvent()`，也不读取 `submitter_contact`、`tag_suggestions`、`reject_reason`、`created_at` 等非公开字段。首页、热门和活动列表同样从 `events.*` 改为显式公开投影；这不会改变 D1 的按行计费，但会减少传输、序列化和误缓存私有字段的风险。

首页发现与热门仍是两个可独立缓存、独立降级的 loader，各自保留现有 D1 batch；`/events` 的 top tags 与活动页也继续并行。减少调用不能以串行化独立查询或制造巨型 SQL 为代价。

### 11.3 管理业务操作合同

管理路由只负责鉴权、解析输入、把业务结果映射为 HTTP 状态码，以及根据返回的影响信息安排 Cache API 失效。数据库操作函数直接返回：

```ts
interface MutationImpact {
    eventIds: number[];
    oldDivisionCodes: string[];
    newDivisionCodes: string[];
    oldStatus?: EventStatus;
    newStatus?: EventStatus;
    tagsChanged: boolean;
}
```

具体返回值还包含现有的 `changed | already-target | conflict` 或 `not-found` 结果。缓存层只消费 `MutationImpact`，不得在提交后为了取得旧地区、状态或受影响活动再次读取 D1。

### 11.4 状态变更

审核通过、驳回、下线和重新发布统一进入 `transitionEventStatus()`：

1. 条件 `UPDATE` 自身包含期望旧状态；通过和重新发布把“至少一个规范标签”的 `EXISTS` 条件放入同一 SQL，删除独立 `hasCanonicalEventTag()` 调用。
2. 同一 `db.batch()` 随后读取当前状态和标签资格，调用方可从一个结果集区分 changed、already-target、无标签和状态冲突，不再单独回读状态。
3. 执行阶段先以本地 D1 合同测试验证 `changes()` 能否在 batch 的紧邻 statement 中可靠门控审计插入。验证通过时把审计放入同一原子 batch；否则只在确认 changed 后用第二次 D1 调用写审计，绝不为了减少调用写入错误审计。
4. 现有 200/404/409 行为和幂等语义保持不变；正常 changed 路径最多两次 D1 binding 调用，冲突或 already-target 路径最多一次 batch。

### 11.5 集合式标签与差异更新

移除逐标签 `findOrCreateTagIds()`。规范化标签数组只序列化一次，使用 `json_each(?)`：

1. 一条 `INSERT OR IGNORE INTO tags(name) SELECT ... FROM json_each(?)` 创建缺失标签。
2. 关系删除仅针对“不再位于目标规范标签集合”的 `event_tags`。
3. 关系插入使用一条 `INSERT OR IGNORE ... SELECT`，并通过 `COALESCE(alias_of_id, id)` 保持当前别名归一语义。

编辑活动先用一次窄查询取得旧状态、旧地区和当前标签集合，再在一个 batch 中完成活动字段更新、标签集合式 upsert、关系差异删除/插入和审计。D1 调用数固定为两次且不随 1-12 个标签增长；未变化的关系不会产生删除和重写。

单条管理员创建保留 `nextEventId + 原子 batch` 的并发冲突重试边界，但把 `2 × 标签数` 个 statements 收口为“标签集合插入 + 活动插入 + 关系集合插入 + 审计”四类 statements。批量创建已经采用集合式标签插入并把事件、关系和审计放在同一 batch，不推倒重写。

### 11.6 标签归并

源标签、目标标签和源标签关联活动用一次窄读取取得。第二次原子 batch 完成重复关系删除、关系改指、别名更新和审计，并返回预读的受影响活动 ID 供详情缓存失效。所有 mutation SQL 仍带源/目标规范标签谓词，防止并发状态变化把关系改向别名标签。

### 11.7 收益口径

下表的“调用”指 D1 binding 的 `.exec()` / `.first()` / `.all()` / `.run()` / `.batch()`，不把 batch 内 statement 数混为数据库往返：

| 路径 | 当前正常路径 | 目标 | 主要收益 |
| --- | --- | --- | --- |
| `getDB()` | 每次 1 次 PRAGMA | 0 次 | 删除所有动态请求上的无效往返 |
| 公开详情 | 1 次完整记录查询 | 1 次公开投影查询 | 隐私和序列化，不宣称减少 rows_read |
| 审核通过/重新发布 | 标签检查 + 更新 + 审计，冲突时再回读 | changed 最多 2 次；冲突/幂等 1 次 | 删除独立资格查询和状态回读 |
| 驳回/下线 | 更新 + 审计，冲突时回读 | changed 最多 2 次；冲突/幂等 1 次 | 合并更新与结果探针 |
| 编辑活动 | `3 + 标签数 + 新标签数` 次 | 固定 2 次 | 消除 N+1，并只写关系差异 |
| 标签归并 | 2 次校验 + 1 batch + 1 审计 | 固定 2 次 | 合并校验并原子提交审计 |
| 单条管理员创建 | 1 次 ID 读取 + 1 batch | 仍为 2 次 | statements 从随标签增长改为集合式 |

D1 免费额度按扫描/写入行而不是调用次数计算。batch 主要减少网络往返；真正降低 `rows_read` 的是 Cache API 和索引友好查询，真正降低 `rows_written` 的是热度标记、移出请求的清理以及标签关系差异写入。

## 12. 路由集成

- `/`：先解析地区，再并行读取缓存化的发现和热门数据；现有独立错误隔离保持。
- `/api/homepage`：复用同一两个缓存函数，保持全有或全无响应。
- `/api/popularity`：只读热门缓存。
- `/events`：top tags 使用低基数缓存；活动页使用受准入规则保护的列表缓存。
- `/events/:id`：使用公开详情 DTO；按当前活动/IP/中国日期读取热度成功标记，命中时省略独立 POST，未命中或判断失败时保留现有后台 POST。
- `/api/events/:id/view`：不进入公共 DTO 缓存；使用独立热度标记、并发合并和 D1 当日记录确认。
- `/api/tags`：使用规范化联想缓存。
- `/sitemap.xml`：缓存 sitemap 行或完整 XML；origin 仍在请求时拼接，避免跨域串用。
- 所有 POST、PATCH 和管理页读取均绕过公共 DTO 缓存；访问统计 POST 只允许使用专用的不可持久化去重标记。

## 13. 可观测性

缓存读取结果统一为：

```text
BYPASS | MISS | HIT | STALE-REFRESH | REFRESHED | STALE-IF-ERROR
```

- 公共 JSON/API 响应增加 `X-Eventlist-Cache`，便于 curl 和生产诊断。
- 只对 miss、后台刷新失败和 stale-if-error 做低比例结构化日志采样，避免消耗 Workers Logs 免费额度。
- 主要容量指标使用 D1 Dashboard/GraphQL 的 `rows_read`、`rows_written`，不为计数再引入 KV 或 D1 写入。
- CPU time 与 wall time 从 Workers Logs 逐次调用读取，按路由分别记录 p50/p99，并与 §0.2 的 10 ms 上限对比；`exceededCpu` 调用结果必须单独告警。
- 单次调用的 D1 + Cache API 调用数合计对照 §0.3 的 50 subrequest 上限记录峰值。
- 数据库操作另记录采样后的 binding 调用数与 batch statement 数，避免把“更少往返”误报为“更少计费行”。
- 热度链路只记录聚合状态：`VIEW_MARKER_HIT | VIEW_MARKER_MISS | VIEW_D1_RECORDED | VIEW_D1_NOOP | VIEW_ERROR`，不得记录原始 IP、访客键或标记摘要。
- 发布前记录基线；发布后比较首页、热门、标签、详情和列表的 D1 行读取趋势，并单独比较 Worker 统计 POST、热度 D1 操作和 `rows_written` 趋势。

## 14. 分阶段发布与回滚

使用环境变量控制缓存范围：

```text
PUBLIC_DATA_CACHE_SCOPES=homepage,popularity,tags,detail,sitemap,list
VIEW_DEDUPE_CACHE_ENABLED=true
```

`PUBLIC_DATA_CACHE_SCOPES` 缺失或为空时完全绕过公开 DTO Cache API。`VIEW_DEDUPE_CACHE_ENABLED` 未启用时，详情继续输出现有 POST，POST 直接执行 D1 当日 upsert；两个开关相互独立。

自动发布顺序：

1. 先部署数据库接口收口、查询优化、缓存核心、自定义 Worker 入口和测试，两个生产缓存开关关闭。
2. `tags,sitemap` pilot 作为首个稳定版本；外部控制器随后按 `popularity -> homepage -> detail -> list` 每次只增加一个 scope，不再等待逐次人工确认。
3. 每个候选先确认源码已提交且远程 D1 schema 与候选兼容，再构建独立 Worker Version。候选不得夹带 schema 变更或其他产品功能。
4. 控制器对候选执行 HTTP/响应哈希/D1 投影探针，并读取 CPU、`exceededCpu` 和错误指标；任一证据缺失或不合格都视为失败。
5. 候选失败时将上一稳定 Worker Version 恢复到 100% 流量并冻结后续晋级。成功后才把该候选登记为新的稳定版本。
6. 热度去重标记继续按独立 Worker 请求阈值、开关和验收发布，不进入公开 DTO 自动序列。

自动控制面必须位于 Worker 外部。生产 Worker 只读取 `PUBLIC_DATA_CACHE_SCOPES` 这个硬上限，不持有 Workers Scripts 写令牌，也不自行调用部署 API。控制器必须串行执行；远程 D1 schema 不兼容、版本状态不明确、指标 API 超时、探针失败或候选路由 CPU p99 >= 10 ms 时都 fail closed。

公开读取快速回滚：清空 `PUBLIC_DATA_CACHE_SCOPES`。热度快速回滚：关闭 `VIEW_DEDUPE_CACHE_ENABLED`，恢复每个 POST 直接校验 D1；Cron 可独立保留。若自定义入口本身异常，则将 `main` 恢复为 `@astrojs/cloudflare/entrypoints/server` 并用人工维护命令临时清理过期访客。所有路径都不需要迁移或恢复 D1 事实。

## 15. 未采用方案

### KV 通用缓存

每个请求先读 KV 会把压力转移到 10 万 key 读取/日和 1000 写入/日，额度比 D1 行读取更紧；全球最终一致也不能提供优于本方案的 60 秒写后可见性。

### 全局 Workers Cache

决定性理由是免费方案的请求计费口径。官方定价说明：启用 Workers Cache 后，**所有**到该 Worker 的请求都按标准请求费率计费，包括平时免费的静态资源请求和 Worker 间调用。当前 Worker 通过 `assets` 绑定同时承载 Astro SSR、API 和全部静态资产，一次页面加载会带出十几个资源请求，整体开启等于把 100,000 请求/日 的免费额度按页面资源数成倍消耗。

需要明确放弃的能力（若将来上付费方案或把静态资源移出该 Worker，应重新评估）：

- Workers Cache 是 zoneless 的，在 `workers.dev` 上同样可用，不依赖 §0.1 的自定义域前提。
- 默认分层缓存（lower/upper tier），命中范围优于按数据中心隔离的 Cache API。
- 按缓存键的请求合并，本方案只能用 isolate 内 Promise Map 近似（§6）。
- `Cache-Tag` + `cache.purge()` 全局失效，可以消除 §9 依赖的 60 秒最终一致窗口。
- 命中时 Worker 不执行，因此同时省掉 CPU——正是 §0.2 最紧的那条限制。

原先"未显式设置头的 200 响应会被启发式缓存 2 小时"这一顾虑不成立：`@astrojs/cloudflare` 的 cache provider 在启用时默认对响应写入 `Cloudflare-CDN-Cache-Control: no-store`，需要缓存的响应再显式opt-in。该顾虑不再作为否决依据。

### 整页 HTML 缓存

首页依赖 IP/查询参数地区，管理区依赖鉴权，详情还需独立访问统计。数据级 DTO 缓存可以复用 D1 结果而不冻结请求级逻辑，因此风险更低。

### KV 访客标记

逐活动/IP/日期写 KV 会很快触及免费计划 1000 key 写入/日，而且 KV 最终一致仍不能替代 D1 复合主键。Cache API 标记没有独立 KV 写入额度，丢失时安全回源 D1，更适合做纯优化层。

### 浏览器存储作为权威去重

`localStorage`、Cookie 或页面内 `Map` 无法知道当前公网 IP 是否已经变化。直接据此跳过统计会在换网、代理切换或多设备场景少计合法的新 IP，因此只能由服务器按当前 IP 检查标记。

### 每日累计计数或近似基数

每日独立数相加会重复计算跨日访客，HyperLogLog 等近似结构也会改变现有精确口径。当前 `last_seen_date` 单行模型已是支持重叠窗口的最小精确状态。

### Durable Object 或 Queues

Durable Object 会为每次统计增加一次对象请求和新的状态边界，Queues 只能异步传递写入而不能自行精确去重。当前规模下二者都会增加免费额度和运维复杂度；只有当 D1 首次/跨日真实写入量接近上限且 Cache API 去重不足时再重新评估。
