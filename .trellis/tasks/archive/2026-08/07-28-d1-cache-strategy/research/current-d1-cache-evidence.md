# 当前 D1 与缓存证据

## 1. 结论摘要

- 当前动态公开数据确实在请求时直接访问 Cloudflare D1。首页、热门榜、活动目录、活动详情、标签联想和 sitemap 都没有服务器端或边缘数据缓存。
- 唯一已有缓存是 `HomepagePopularity.svelte` 内按 `division + window` 保存的浏览器页面生命周期 `Map`。它只能减少同一页面会话中的重复热门请求，不能减少 SSR、刷新或其他用户的 D1 访问。
- D1 必须继续作为活动、标签、审核状态和访问热度的唯一事实来源。缓存只能保存逐字段投影后的公开 DTO，不能保存完整 `EventRecord`，因为其中包含 `submitter_contact`、审核字段等非公开数据。
- 第一阶段最合适的是 Worker 内部 Cache API。它不占用 KV 的更紧免费额度，也不要求为整个 Astro Worker 开启 Workers Cache。
- 查询本身还有低风险优化空间：迁移已经保证日期和时间列规范化，去掉列外层的 `date()` / `datetime()` 后可以使用现有索引，降低每次缓存未命中的行读取成本。
- 数据库接口值得做针对性整理：删除每请求外键 PRAGMA、把公开字段投影与管理完整记录分离、消除编辑活动的逐标签 N+1 和全量关系重写，并让管理员业务操作直接返回缓存影响信息。
- 仅拆分文件不会减少 D1 免费额度；D1 按扫描/写入行计量。模块收口的价值是让 Cache API、索引友好 SQL、集合式查询和差异写入可以被统一复用和验证。

## 2. 持久化设计

单一迁移 `migrations/0001_init.sql` 创建五张 `STRICT` 表和现有索引：

| 表 | 事实边界 | 公开缓存要求 |
| --- | --- | --- |
| `events` | 活动内容、地区、时间、状态、投稿联系信息和审核字段 | 只能缓存显式公开投影；禁止缓存完整行 |
| `tags` | 规范标签和别名 | 可缓存公开标签摘要，不缓存为可写副本 |
| `event_tags` | 活动与规范标签关系 | 只通过活动/标签 DTO 间接进入缓存 |
| `event_visitors` | 按活动隔离的匿名访客摘要 | 只缓存聚合后的热门榜，绝不缓存访客键 |
| `audit_logs` | 管理员操作审计 | 不进入任何公共缓存 |

现有索引位于 `migrations/0001_init.sql:111-126`：

- `idx_events_public_start(status, end_date, start_date, id)`
- `idx_events_public_division(status, division_code, end_date, start_date, id)`
- `idx_events_status_created(status, created_at, id)`
- `idx_events_status_updated(status, updated_at, id)`
- `idx_event_visitors_recent(last_seen_date, event_id)`
- `idx_event_tags_tag_event(tag_id, event_id)`
- 两个审计索引

开发种子在全新临时 D1 中得到：

- 143 个活动，其中 141 个已发布、1 个待审核、1 个已下线
- 10 个规范标签、24 条活动标签关系
- 91 条匿名访客记录
- 已发布活动使用 14 个精确地区代码

地区目录不是 D1 表，而是 `cn-division` 的应用内数据。当前可选择 34 个省级、344 个市级和 2936 个区县级选项，共 3310 个有效地区代码。因此首页缓存必须在解析出最终地区后按地区代码分区，不能只按路径 `/` 共享。

## 3. 当前公开读取链路

| 入口 | 当前 D1 访问 | 当前缓存 | 风险/特点 |
| --- | --- | --- | --- |
| `/` | `listHomepageDiscovery()` 两条查询 + `listHomepagePopularity()` 两条查询 | 仅浏览器热门 `Map` | 地区来自查询参数、Cloudflare IP 或默认值；必须先解析地区再查缓存 |
| `/api/homepage` | 与首页相同的发现和热门查询 | 无 | 地区切换时要求完整快照全有或全无 |
| `/api/popularity` | 本地榜和全国榜两条查询 | 浏览器页面会话 `Map` | 键已是 `division + window`，可沿用同一维度做服务端缓存 |
| `/events` | `topTags()` + `listPublishedEvents()` | 无 | 筛选和分页组合基数高，必须规范化键并限制缓存准入 |
| `/events/:id` | `getPublicEvent()` 一条详情查询 | 无 | 查询使用主键；缓存 DTO 必须移除投稿联系和审核字段 |
| `/api/tags` | `searchTags()` 一条查询 | 无 | 两个输入组件均在停止输入 160ms 后请求；同一前缀可能重复回源 |
| `/sitemap.xml` | `listPublishedEventSitemapRows()` 一条查询 | 无 | 查询结果完全公开，适合低基数缓存 |
| `/api/events/:id/view` | 清理过期访客 + 当日 upsert | 无公开响应缓存 | POST 不得进入公共 DTO 缓存；可用仅服务器可见的当日成功标记减少重复 D1 |

主要证据：

- 首页在 `src/pages/index.astro:35-69` 先解析地区，再直接取得 D1 并运行两个数据函数。
- 活动目录在 `src/pages/events/index.astro:53-98` 规范化筛选后直接并行查询标签和活动。
- 详情页在 `src/pages/events/[id].astro:23-39` 直接查询 D1，并在 `:222-231` 通过独立 POST 记录访问。
- 标签输入在 `src/components/TagInput.svelte:58-94` 和 `src/components/FilterBar.svelte:132-162` 以 160ms debounce 调用 `/api/tags`。
- sitemap 在 `src/pages/sitemap.xml.ts:21-44` 每次请求直接读取 D1。

## 4. 当前写入链路与公开影响

| 写入 | D1 事实变化 | 公开缓存影响 |
| --- | --- | --- |
| 公共投稿 | 新建 `pending` 活动 | 不影响公开缓存，无需失效 |
| 管理员创建/批量创建 | 新建 `published` 活动、标签关系和审计 | 首页、列表、标签、sitemap 受影响；新详情此前没有缓存 |
| 管理员编辑 | 更新活动内容、地区、时间和标签关系 | 详情、旧/新地区首页、列表、标签、sitemap 受影响 |
| 审核通过/下线/重新发布 | 修改公开状态 | 详情、首页、列表、热门、sitemap 受影响 |
| 驳回 | `pending -> rejected` | 正常不影响公开缓存 |
| 标签归并 | 重写标签关系并创建别名 | 标签联想、列表、首页卡片和详情标签受影响 |
| 详情访问 | 更新 `event_visitors` | 只影响热门榜；公开详情 DTO 缓存不得自行跳过 POST，只有已确认成功的专用当日标记可以抑制重复 POST |

Cache API 的 `delete()` 只删除当前数据中心的条目，因此本地删除只能作为加速手段，不能作为全球正确性的唯一保证。全球正确性必须由最大 60 秒的正常陈旧上限兜底。

### 4.1 当前数据库接口与调用放大

`src/lib/db/index.ts:12-24` 的 `getDB()` 每次都会执行一次 `db.exec("PRAGMA foreign_keys = ON;")`。Cloudflare D1 当前文档明确说明外键默认在所有查询和迁移中启用，等价于每个事务已设置 `PRAGMA foreign_keys = on`，且用户查询无法关闭。因此运行时 `ensureFK()` 不提供额外正确性，只增加一次 D1 binding 往返；迁移顶部的 PRAGMA 可保留用于本地 SQLite 和 schema 意图。

`src/lib/db/queries.ts` 当前共 1008 行，公开读取、热门、访问统计、投稿、标签、管理写入和审计共用一个模块与完整 `EventRecord`：

- `EVENT_SELECT` 使用 `events.*`，因此 `getPublicEvent()` 会读取 `submitter_contact`、`tag_suggestions`、`reject_reason` 等字段，然后才在 JavaScript 中排除 pending/rejected。
- 首页发现和热门分别已经在内部使用 D1 batch，首页可并行加载；活动列表和 top tags 也已在路由中并行。它们的缓存键、错误边界和 TTL 不同，不应为了“一个调用”改成巨型 SQL。
- 单条管理员创建与批量创建已经把事件、标签关系和审计放入原子 batch；批量创建还已使用一次集合式标签插入，应保留该方向。

不计 `getDB()` 的无效 PRAGMA 和后续 Cache API 失效，当前管理写路径为：

| 路径 | 当前 D1 binding 调用 | 主要重复 |
| --- | --- | --- |
| 审核通过/重新发布 changed | 标签资格 SELECT + UPDATE + audit INSERT，共 3 次 | 标签资格可进入条件 UPDATE；审计仍在路由外单独写 |
| 审核通过/重新发布 conflict/幂等 | 标签资格 SELECT + UPDATE + 状态回读，共 3 次 | 更新结果与状态探针可同 batch |
| 驳回/下线 changed | UPDATE + audit INSERT，共 2 次 | 业务写入和审计由路由手工拼接 |
| 驳回/下线 conflict/幂等 | UPDATE + 状态回读，共 2 次 | 更新结果与状态探针可同 batch |
| 编辑活动 | `3 + 标签数 + 新标签数` 次 | 先读状态；每标签 SELECT，缺失再 INSERT；1 batch 全删全建；最后单独审计 |
| 标签归并 | 源标签 SELECT + 目标标签 SELECT + mutation batch + audit，共 4 次 | 两次校验可合并，审计可进入 mutation batch |
| 单条管理员创建 | ID SELECT + 1 batch，共 2 次 | 调用数合理，但 batch 内是 `2 × 标签数 + 2` 个 statements |

编辑允许最多 12 个标签，因此全为已有标签时是 15 次调用，全为新标签时是 27 次调用；加上当前 `getDB()` PRAGMA 后分别为 16 和 28 次。更重要的是它会无条件删除该活动全部 `event_tags`，再写回所有关系，即使标签没有变化也产生写入行和索引维护。

D1 官方当前保证 `batch()` 在一次数据库调用中顺序执行，并作为 SQL transaction 在任一 statement 失败时回滚整个序列。该保证适合把同一业务操作的集合式标签、关系和审计收口，但 batch 内 statements 仍分别贡献 `rows_read` / `rows_written`；减少往返不能替代减少扫描和实际写入。

### 4.2 推荐整理边界

推荐按公开活动、首页/热门、访问统计、标签和管理员活动操作拆分模块，并保留一个短期 re-export 兼容入口。管理员路由调用业务操作函数，函数返回现有 outcome 以及活动 ID、旧/新地区、旧/新状态、受影响标签/活动 ID，使缓存失效不需要提交后回读。

编辑标签改为：一次窄快照读取 + 一个原子 batch。batch 使用 `json_each()` 一次插入缺失标签、只删除目标集合以外的关系、只插入缺失关系，并把审计放在同一事务。调用数固定为两次且不随标签数量增长，未变化关系不再重复写。

不推荐引入 ORM、Repository 基类、Unit of Work、数据库结果全局缓存，或把首页/列表独立读取合并为巨型 SQL。这些做法增加抽象和耦合，却不直接降低 D1 计费行。

## 5. 查询计划验证

在全新临时 D1 中应用迁移和开发种子后，用同一 SQLite 数据文件验证查询计划。临时持久化目录为：

`/home/kanade/.local/state/codex-desktop/tmp/tmp.kV2S1BeLJ3`

该目录不含用户现有数据，因安全策略未自动删除。

| 查询 | 当前计划 | 去掉规范列外层转换后 |
| --- | --- | --- |
| 热门访客窗口 | 扫描 `event_visitors` 主键索引 | 使用 `idx_event_visitors_recent(last_seen_date)` 范围查询 |
| sitemap | 使用状态/更新时间索引后再建临时排序树 | 直接按 `idx_events_status_updated` 输出 |
| 访客清理 | 全表扫描 | 使用 `idx_event_visitors_recent` 范围删除 |
| 精确地区活动列表 | 使用 `idx_events_public_division`，分组/排序仍有临时树 | 保持同一索引并减少日期函数计算；语义不变 |

安全改写依据是迁移已经约束：

- `start_date`、`end_date`、`last_seen_date` 为规范 `YYYY-MM-DD`
- `start_time`、`end_time` 为规范 `HH:MM`
- `updated_at` 由 SQLite `datetime('now')` 生成

因此列可以直接与 `date('now', '+8 hours')`、`time('now', '+8 hours')` 或已校验参数比较，保留中国本地时间口径而不在索引列外层调用转换函数。

## 6. Cloudflare 方案比较

官方文档在 2026-07-28 的当前规则：

| 方案 | 免费额度/命中范围 | 适配结论 |
| --- | --- | --- |
| D1 | 500 万行读取/日、10 万行写入/日、总 5 GB | 仍是唯一事实来源；必须同时优化查询和缓存未命中 |
| Workers KV | 10 万 key 读取/日、1000 key 写入/日；全球最终一致 | 通用读穿缓存会先耗尽更紧额度，且写后全球可见也约需 60 秒，不采用 |
| Cache API | Worker 仍执行；命中可跳过 D1；缓存按数据中心隔离 | 第一阶段最小可行方案，不增加 KV 绑定和持久化副本 |
| Workers Cache | Worker 前置的全局分层缓存、请求合并、全局标签失效 | 当前单入口 Astro Worker 不宜整体开启：启用后静态资源和 Worker 间调用也计入 Worker 请求额度，且未显式设置头的 200 响应会启发式缓存 2 小时 |
| 浏览器缓存 | 仅单用户/单设备 | 保留现有热门 `Map`，可对成功 JSON GET 增加短 `private` 缓存，但不能代替边缘缓存 |

官方依据：

- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
- [Workers Cache](https://developers.cloudflare.com/workers/cache/)
- [Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Astro Cloudflare custom entrypoint](https://docs.astro.build/en/guides/integrations-guide/cloudflare/#changed-custom-entrypoint-api)
- [D1 Database batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [D1 foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)

Cache API 还具有这些必须在设计中补偿的限制：

- 条目不会自动复制到其他数据中心。
- `stale-while-revalidate` 和 `stale-if-error` 指令不受 `cache.put()` / `cache.match()` 原生支持。
- `cache.delete()` 只影响当前数据中心。
- Cache API 不提供请求合并。

D1 数据库接口相关的当前官方保证：

- 外键默认始终启用，用户查询不能关闭，运行时重复 `PRAGMA foreign_keys = ON` 没有必要。
- `batch()` 减少网络往返，statements 顺序执行并在失败时回滚整个序列。
- D1 免费额度按 `rows_read` / `rows_written` 计量；batch 不会把多条 statement 的扫描或写入合并成一行用量。
- 选择更少列不会改变按行计数，但可以减少 Worker 传输、序列化和私有字段误缓存风险。

因此实现必须自行保存时间戳、使用软/正常/故障 TTL、通过 `waitUntil` 后台刷新，并用 isolate 内 Promise 合并减少同一实例的并发回源。

## 7. 研究结论

第一阶段应采用“公开 DTO 读穿缓存 + 热度当日成功标记 + 数据库接口收口 + 现有索引无语义查询改写 + 每日 Cron 清理”，并满足：

1. 不缓存整页 HTML，避免首页 IP 地区、管理员鉴权或 Cookie 串用。
2. 不缓存 POST 响应、投稿、管理接口、访问统计结果或任何用户相关响应；热度链路只允许使用不可持久化的服务器内部成功标记。
3. 正常情况下任何公开数据最多陈旧 60 秒；超过该边界必须阻塞刷新。
4. 仅在 D1 暂时失败时，才允许返回明确标记的更旧安全 DTO。
5. 缓存读取、写入或删除失败均回退 D1，不改变原有成功/失败语义。
6. 先启用低基数、高收益数据，再对活动列表使用准入限制，避免大量一次性筛选键污染缓存。
7. 热度写入保持 `event_visitors` 的最近访问日期模型；同日重复访问使用 Cache API 标记优先绕过 D1，首次和跨日访问仍写 D1。
8. 详情 SSR 可在当前请求内检查标记，命中时不再输出独立统计 POST；这能减少重复 Worker 请求，同时保留“只有执行页面 JavaScript 才计数”的现有行为。
9. 访客清理从每次访问移到每天一次的 Worker Cron，并使用直接日期比较命中现有索引。
10. 热门榜按 25-35 秒新鲜期、60 秒正常上限读取，不因每个访问写入主动失效。
11. 公开读取只使用显式 DTO 投影；管理写入按业务操作收口，返回缓存影响信息并消除逐标签 N+1 和无差异关系重写。

## 8. 热度写入专项证据

### 8.1 当前实际行为

- `src/pages/events/[id].astro:69-70` 仅为已发布活动输出 `/api/events/:id/view`，`:222-231` 在浏览器执行脚本后以 `keepalive` POST，失败被静默忽略。
- `src/pages/api/events/[id]/view.ts:10-42` 校验活动 ID、同源 `Origin`、`CF-Connecting-IP` 和 `VIEW_HASH_SECRET`，再计算事件级 HMAC 访客键并调用 D1。
- `src/lib/events/popularity.ts:14-38` 把 `eventId + IP` 作为 HMAC 输入，因此同一公网 IP 在不同活动下不会共享访客键。
- `src/lib/db/queries.ts:568-592` 对每个 POST 运行两个 D1 statement：全局删除 30 日窗口外访客，然后条件 upsert 当前活动/IP 的中国本地日期。
- `migrations/0001_init.sql:79-90` 以 `(event_id, visitor_key)` 为主键，`:119-120` 另有 `idx_event_visitors_recent(last_seen_date, event_id)`。

当前条件 upsert 的含义不是“每个 PV 写一行”：

```sql
ON CONFLICT(event_id, visitor_key) DO UPDATE SET
    last_seen_date = excluded.last_seen_date
WHERE event_visitors.last_seen_date <> excluded.last_seen_date
```

因此同活动/IP 当天重复访问不会更新行；跨日访问会推进 `last_seen_date`，使该 IP 继续精确进入重叠的 3/7/30 日窗口。

### 8.2 本地 D1 写入验证

在已记录的临时 D1 目录 `/home/kanade/.local/state/codex-desktop/tmp/tmp.kV2S1BeLJ3` 中使用一次性 64 位十六进制访客键执行相同 upsert，并在最后删除测试行：

- 首次插入后的 `SELECT changes()` 为 `1`。
- 同一天再次执行条件 upsert 后 `SELECT changes()` 为 `0`。
- Wrangler 本地模拟器的结果 `meta` 只返回 `duration`，不提供可用于生产计费的 `rows_written`，因此不能从本地结果推断最终账单行数。

Cloudflare D1 Pricing 当前明确说明：表写入和受影响索引分别计算写入行。`event_visitors` 同时涉及表、复合主键结构和最近日期索引，所以一次逻辑访客写入可能消耗多条 `rows_written`；生产必须使用 D1 result meta、Dashboard 或 GraphQL Analytics 实测。

### 8.3 为什么使用 Cache API 当日成功标记

标记键使用“事件级访客键 + 中国本地日期”的二次 SHA-256 摘要，不保存或暴露原始 IP。只有 D1 已确认存在当天访客行后才写标记。

该边界带来以下性质：

- 命中：直接跳过 D1；同日刷新不会持续执行 upsert 和全局清理。
- 驱逐、Cache API 故障或跨数据中心：回到 D1；最多增加校验，不会少计。
- 并发首次访问：同 isolate 可合并 Promise；跨 isolate/数据中心由 D1 主键和条件更新兜底。
- D1 失败或活动无效/已结束：不写标记，避免后续合法访问被错误抑制。

Cache API 内容不会复制到其他数据中心，且 `cache.delete()` 只影响当前数据中心。这些限制对该标记是可接受的，因为标记丢失只降低命中率，不改变 D1 事实。

### 8.4 同时减少重复 Worker 请求

单纯在统计 POST 内检查 Cache API 只能减少 D1 操作，不能减少该 POST 已经占用的 Worker 请求。Workers Free 当前仍为 10 万请求/日。

本项目详情页是动态 Astro SSR，且 HTML 本身不做共享缓存。SSR 已经因为页面请求执行 Worker，因此可以在渲染 `data-event-view-endpoint` 前，用当前请求 IP 读取同一个当日标记：

- 命中时不输出 endpoint，浏览器不再发第二个 Worker 请求。
- 未命中或检查失败时仍输出现有 endpoint。
- SSR 只读标记，不写 D1；爬虫或禁用 JavaScript 的访问仍不会新增热度，保持当前计数触发条件。
- IP、活动或日期变化时标记键变化，仍会发送合法的新 POST。

这比浏览器 `localStorage` 或 Cookie 更符合现有 IP 语义：浏览器存储无法判断公网 IP 是否已经变化，直接据此跳过会少计换网后的合法访客。

### 8.5 将清理移出详情请求

当前每个 POST 都执行：

```sql
DELETE FROM event_visitors
WHERE date(last_seen_date) < date('now', '+8 hours', '-29 days')
```

它即使没有删除行也会调用 D1，而且列外层 `date()` 使现有最近日期索引无法做范围定位。等价改为直接比较后，可由每日 Cron 执行：

```sql
DELETE FROM event_visitors
WHERE last_seen_date < date('now', '+8 hours', '-29 days')
```

Cloudflare Cron 使用 UTC，`5 16 * * *` 对应中国时间每天 00:05。Astro 7 / `@astrojs/cloudflare` 14 已支持在 `wrangler.jsonc` 指定 `src/worker.ts` 自定义入口，并通过 `@astrojs/cloudflare/handler` 保留现有 fetch，同时增加标准 `scheduled()` handler。

Cron 延迟不会影响热门结果，因为热门查询始终按自身 3/7/30 日窗口过滤；它只推迟存储和隐私保留期清理。一次每日 Cron 仅增加一次 Worker 调用，远小于当前每个详情访问都清理的放大。

### 8.6 未采用的热度写入方案

| 方案 | 不采用原因 |
| --- | --- |
| KV 逐访客标记 | 免费仅 1000 key 写入/日，会比 D1 更早成为瓶颈 |
| 浏览器本地存储权威去重 | 不知道当前公网 IP，换网时会少计 |
| 每日累计计数 | 跨日同一 IP 会被重复相加，破坏精确 3/7/30 日窗口 |
| Durable Object | 每个统计增加对象请求和第二状态边界，当前免费额度与复杂度收益不匹配 |
| Queues | 只能异步化，不能自行解决精确去重；仍需额外状态和消费额度 |
| 每个访客写入后失效热门缓存 | 把写热点变成热门 SQL 回源风暴，降低命中率且造成 UI 排名抖动 |
