# 公开 DTO 缓存规范

## Scenario: Cloudflare Cache API 公开数据缓存

### 1. Scope / Trigger

- Trigger：新增或修改 `src/lib/cache/public-data.ts`、`PUBLIC_DATA_CACHE_SCOPES`、公开 DTO 读穿缓存、Cache API 路由接入或写后失效。
- D1 始终是活动、标签和热度的唯一事实来源；缓存只能保存可丢失、只读的公开 DTO。
- 生产门禁未满足时允许将 helper 以暗部署方式接入公开路由，但 `PUBLIC_DATA_CACHE_SCOPES` 必须保持缺失或为空；暗部署请求必须直接回源 D1，且不得调用生产 Cache API。
- 当前生产只提前启用 `tags,sitemap`。这是站点负责人基于预期增长明确批准的低风险 pilot 例外，不代表其他 scope 自动获得豁免；`homepage`、`popularity`、`detail`、`list` 和访问去重仍保持关闭。

### 2. Signatures

- Namespace：`eventlist-public-data-v2`，envelope schema 为 `2`；旧 v1 键和 schema 1 envelope 必须自然失效并被严格拒绝。
- Scope：`homepage | popularity | tags | detail | sitemap | list`。
- 配置解析：`parsePublicDataCacheScopes(value) -> ReadonlySet<PublicDataCacheScope>`。
- 键生成：`buildPublicDataCacheRequest(origin, key) -> Request`。
- 缓存条目：`CachedEnvelope<T> = { schema, generatedAt, freshUntil, normalUntil, errorUntil, value }`。
- 存储适配：`PublicDataCacheStore = { match(request), put(request, response) }`。
- 失效存储适配：`PublicDataCacheInvalidationStore = { delete(request) }`。
- 读取：`readPublicDataCache(options) -> bypass | miss | cached`。
- 写入：`writePublicDataCache(options) -> bypass | stored | skipped | error`。
- 写后失效：`schedulePublicDataInvalidation({ origin, configuredScopes, kind, impact, waitUntil })`；单次最多调度 `24` 个 `delete()`。

### 3. Contracts

- 合成键必须是当前 HTTP(S) origin 下的无 Cookie、无 Authorization、固定字段顺序 GET；不得直接复用原始请求或原始查询字符串。
- 键必须包含资源版本以及最终有效的地区、窗口、筛选、排序、分页、活动 ID、标签查询和 limit。详情 ID 必须是正安全整数，非法值直接抛错，不得映射到其他合法 ID。
- envelope 时间必须满足 `generatedAt <= freshUntil <= normalUntil <= errorUntil`，且全部是非负有限数。
- `now <= freshUntil` 为 `fresh`；之后依次为 `normal-stale`、`fault-stale` 和 `hard-expired`，边界时刻仍属于前一状态。
- `PUBLIC_DATA_CACHE_SCOPES` 缺失、空值或含任一未知 scope 时全量关闭。关闭时 `match` / `put` 调用数必须为 0。
- `match` 异常、非 2xx、损坏 envelope 或 DTO guard 失败按 miss 处理；`put` 异常返回 `error`，不得改变原 D1 成功结果；非法或已过期 envelope 返回 `skipped`。
- 缓存值只能使用逐字段公开 DTO，不得保存投稿联系方式、建议标签、驳回原因、审计数据、访客键或完整管理记录。
- 路由 DTO guard 除逐字段校验外，还必须把 payload 身份绑定到规范键：详情 ID、热门窗口与本地地区、列表页码与 pageSize 不匹配时按 miss 回源；首页今日活动必须属于请求地区。不得只验证 DTO 形状后接受其他键的合法对象。
- `event-detail` 静态 DTO 包含主办方和入场字段；近 30 日热度必须独立查询，不能进入缓存 payload 或 validator。
- 详情负结果不写 Cache API。任一已验证静态详情可用而独立热度读取失败时，保留静态详情、以 0 降级热度并显示提示；热度故障不得把可用详情改成 404。pending/rejected/不存在仍为 404，offline 仍为 200。
- 管理员创建、批量创建、编辑、状态变更和标签归并只在 D1 事实与审计成功后调度 best-effort 失效；already-target、冲突、校验失败和公共 pending 投稿不得触发失效。`delete()` 或 `waitUntil()` 失败不得改变已成功的管理 API 响应。
- 地区聚合失效从活动地区展开去重后的省级、市级和精确地区键；列表和标签联想键不可枚举，继续由 60 秒正常 TTL 保证。失效请求按固定顺序去重并在 `24` 次处截断，不得突破 Worker subrequest 预算。旧/新地区的首页与三个热门窗口键优先于详情、top-tags 和 sitemap；最坏情况下地区键用满预算，未调度的固定键由 60 秒正常 TTL 兜底。
- `popularity` 作为下一个独立 scope 时，一次跨地区编辑最多失效两个 top-tags、一个 sitemap 和 `6 × 3` 个热门键，共 `21` 次；它不会因地区祖先展开触发截断。后续 scope 组合仍必须单独验证最坏失效集合和 CPU 门禁。
- 生产激活前必须同时满足：`wrangler.jsonc` 记录 `acg.hobr.site` 路由、真实 hostname 的 `put` / `match` 探针通过、候选路由 CPU p99 低于 10 ms 且 `exceededCpu=0`。
- 当 Cache API 只获准用于自定义域时，`workers_dev` 必须关闭；若未来确需保留 `*.workers.dev`，则必须在打开任何 scope 前增加受测的 hostname fail-closed 守卫。
- 公开 DTO pilot 默认还需连续 3 个完整 24 小时窗口均达到 D1 `rows_read >= 500000/day`，或存在可归因于 D1 的持续路由延迟/错误。站点负责人可以明确批准提前 pilot，但必须限于点名 scope，保留真实 hostname 探针、候选路由 CPU、响应一致性、可观测性和快速回滚门禁，并在任务记录中写明例外理由与生产证据。
- 当前 `tags,sitemap` 例外已满足其余门禁：真实 hostname 探针返回 `204` 和 `X-Eventlist-Cache-Probe: hit`，候选路由样本 CPU 不超过 8 ms、`outcome=ok` 且无异常；生产版本 `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9` 仅配置这两个 scope，空 scope 回滚版本为 `282528a6-4f0f-4d2f-aa5b-2a4f31f20a03`。探针路由必须在验证后删除。

### 4. Validation & Error Matrix

| 条件 | 行为 |
| --- | --- |
| Scope 缺失、空值或未知 | 全量 bypass，存储调用为 0 |
| 非 HTTP(S) origin | 键生成抛出 `TypeError` |
| 非正安全整数详情 ID | 键生成抛出 `RangeError` |
| TTL 为负数、非有限数、顺序倒置或加法溢出 | envelope 创建抛出 `RangeError` |
| 缓存响应非 2xx、JSON 损坏、schema 不匹配或 DTO guard 失败 | miss，调用方回源 D1 |
| `store.match()` 抛错 | miss，调用方回源 D1 |
| `store.put()` 抛错 | 返回 `error`，保留 D1 成功响应 |
| 写入 envelope 非法或已过 `errorUntil` | 返回 `skipped`，不调用 `put` |
| Scope 关闭、未知或 mutation 不影响公开数据 | 不打开 Cache API，`delete()` 调用为 0 |
| `store.delete()` / namespace / `waitUntil()` 失败 | 吞掉缓存错误，保留已经提交的 D1 事实和 API 成功响应 |
| 失效候选超过 24 个 | 优先删除旧/新地区聚合的前 24 个去重键，详情、top-tags、sitemap 等其余键依赖 60 秒正常 TTL |

### 5. Good/Base/Bad Cases

- Good：路由先完成现有参数守卫，再用结构化参数生成键；scope 关闭时直接执行现有 D1 loader。
- Base：缓存命中返回已通过 envelope 与 DTO guard 的值；缓存未命中或不可用时透明回源 D1。
- Bad：从 `Astro.request` 直接构造缓存键、把 Cookie 带入共享键、缓存完整 `EventRecord`，或因为 `cache.put()` 失败把成功页面改成 500。
- Bad：仅凭预期用户增长启用 scope，而没有连续生产指标、真实 hostname 探针和路由 CPU 余量。

### 6. Tests Required

- `test/public-data-cache.test.ts` 必须覆盖：默认关闭零调用、未知 scope fail closed、资源/地区/窗口/详情/筛选/分页/排序/标签键隔离、参数顺序归一化。
- 必须覆盖 envelope 损坏、schema 错误、TTL 顺序与每个边界时刻，以及加法溢出。
- 必须覆盖 `match` / `put` 异常、非法写入、过期写入和 DTO guard 失败。
- 必须覆盖合法 DTO 放入错误详情 ID、热门窗口/地区或列表页码键时被拒绝，以及 whitespace-only 标签不进入列表缓存。
- 路由接入后再增加：60 秒阻塞回源、stale-if-error、同键并发合并、写后失效、隐私字段和 subrequest 上限测试。
- `test/public-data-cache-invalidation.test.ts` 必须覆盖：scope 关闭零调用、D1 成功后路由接入、delete/open/`waitUntil` 失败不影响成功、地区祖先展开、重复影响去重和 24 次硬上限。`popularity` 跨地区编辑的完整失效集合必须保持在上限内；全 scope 最坏情况必须保留所有旧/新地区键，并明确固定键使用 TTL 兜底。
- 暗部署路由必须覆盖空 scope/未知 scope 零 Cache API 调用；`waitUntil` 调度或 `cache.put()` 失败不得替换成功的 D1 响应。
- 提交前运行 `corepack pnpm test`、`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 和 `git diff --check`。

### 7. Wrong vs Correct

#### Wrong

```ts
const request = new Request(Astro.request);
await cache.put(request, new Response(JSON.stringify(eventRecord)));
```

#### Correct

```ts
const scopes = parsePublicDataCacheScopes(runtimeEnv.PUBLIC_DATA_CACHE_SCOPES);
const request = buildPublicDataCacheRequest(Astro.url, {
    resource: "event-detail",
    eventId
});

const result = await readPublicDataCache({
    scope: "detail",
    scopes,
    store,
    request,
    isValue: (value): value is PublicEventDetail =>
        isPublicEventDetail(value) && value.id === eventId
});
```
