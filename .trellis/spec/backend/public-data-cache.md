# 公开 DTO 缓存规范

## Scenario: Cloudflare Cache API 公开数据缓存

### 1. Scope / Trigger

- Trigger：新增或修改 `src/lib/cache/public-data.ts`、`PUBLIC_DATA_CACHE_SCOPES`、公开 DTO 读穿缓存、Cache API 路由接入或写后失效。
- D1 始终是活动、标签和热度的唯一事实来源；缓存只能保存可丢失、只读的公开 DTO。
- 生产固定启用 `homepage,popularity,tags,detail,sitemap,list` 六个 scope；缺失、空值或未知 token 仍全量 fail closed。
- 访问去重、整页 HTML、Workers Caching 和 D1 schema 不属于本缓存层。

### 2. Signatures

- Namespace：`eventlist-public-data-v2`，envelope schema 为 `2`；旧 v1 键和 schema 1 envelope 必须自然失效并被严格拒绝。
- Scope：`homepage | popularity | tags | detail | sitemap | list`。
- 配置解析：`parsePublicDataCacheScopes(value) -> ReadonlySet<PublicDataCacheScope>`。
- 键生成：`buildPublicDataCacheRequest(origin, key) -> Request`。
- 缓存条目：`CachedEnvelope<T> = { schema, generatedAt, freshUntil, normalUntil, errorUntil, value }`。
- 存储适配：`PublicDataCacheStore = { match(request), put(request, response) }`。
- 失效存储适配：`PublicDataCacheInvalidationStore = { delete(request) }`。
- 读取：`readPublicDataCache(options) -> bypass | miss | cached`。
- 写入：`writePublicDataCache({ ..., cacheTags }) -> bypass | stored | skipped | error`，响应附加固定 `Cache-Tag`。
- 写后失效：`schedulePublicDataInvalidation({ origin, configuredScopes, kind, impact, zoneId, purgeToken, waitUntil })`；单次最多调度 `24` 个本地 `delete()` 和 `1` 个全局 tag purge。

### 3. Contracts

- 合成键必须是当前 HTTP(S) origin 下的无 Cookie、无 Authorization、固定字段顺序 GET；不得直接复用原始请求或原始查询字符串。
- 键必须包含资源版本以及最终有效的地区、窗口、筛选、排序、分页、活动 ID、标签查询和 limit。首页发现与活动列表还必须包含同一次 load 捕获的中国本地日期。详情 ID 必须是正安全整数，非法值直接抛错，不得映射到其他合法 ID。
- envelope 时间必须满足 `generatedAt <= freshUntil <= normalUntil <= errorUntil`，且全部是非负有限数。
- `now <= freshUntil` 为 `fresh`；之后依次为 `normal-stale`、`fault-stale` 和 `hard-expired`，边界时刻仍属于前一状态。
- `PUBLIC_DATA_CACHE_SCOPES` 缺失、空值或含任一未知 scope 时全量关闭。关闭时 `match` / `put` 调用数必须为 0。
- `match` 异常、非 2xx、损坏 envelope 或 DTO guard 失败按 miss 处理；`put` 异常返回 `error`，不得改变原 D1 成功结果；非法或已过期 envelope 返回 `skipped`。
- Cache-Tag 只能来自代码常量，必须是去重后的 printable ASCII。固定 scope tag 为 `eventlist-homepage`、`eventlist-popularity`、`eventlist-tags`、`eventlist-detail`、`eventlist-sitemap`、`eventlist-list`；不得包含用户输入、原始查询字符串、secret 或 Unicode。
- `event-taxonomy` 是无参数的公开 DTO 资源，复用 `tags` scope、`eventlist-tags` Cache-Tag 和标签/公开活动变更失效路径；其 payload 只包含规范标签、已知类型/规模代码及非零 `event_count`，fresh/normal 为 30 分钟、故障兜底为 48 小时。
- 缓存值只能使用逐字段公开 DTO, 不得保存投稿联系方式, 建议标签, 驳回原因, 审计数据, 访客键或完整管理记录. `home-discovery` 只包含 `{ featuredEvents }`; `popularity` 必须是 `{ window, unopened: { local, nationwide }, unended: { local, nationwide } }`.
- 路由 DTO guard 除逐字段校验外, 还必须把 payload 身份绑定到规范键: 详情 ID, 热门窗口与两个场景的本地地区, 列表页码与 pageSize 不匹配时按 miss 回源; 首页每个 Hero candidate 的 `division_code` 必须匹配请求地区. 不得只验证 DTO 形状后接受其他键的合法对象.
- Hero DTO 仅包含 `id`, `title`, `scale`, `division_code`, 活动日期/时间和 `cover_url`. 榜单 DTO 仅包含 `id`, `title`, `division_code`, 活动日期/时间, 开票日期/时间和非负整数 `unique_visitors`. 旧 `{ featuredEvents, today }` 或 `{ window, local, nationwide }` payload 必须由 exact-shape guard 拒绝并回源.
- `event-detail` 静态 DTO 包含主办方和入场字段；近 30 日热度必须独立查询，不能进入缓存 payload 或 validator。
- 详情负结果不写 Cache API。任一已验证静态详情可用而独立热度读取失败时，保留静态详情、以 0 降级热度并显示提示；热度故障不得把可用详情改成 404。pending/rejected/不存在仍为 404，offline 仍为 200。
- 热门榜 fresh 使用稳定键抖动 `45-55s`，normal 上限 `60s`，D1 故障兜底 `5m`。`/api/popularity` 浏览器缓存为 `private, max-age=5`，访问 POST 不主动 purge。
- 首页、标签和列表 fresh/normal 均为 `30m`；详情和 sitemap fresh/normal 均为 `6h`；这五类 D1 故障兜底均为 `48h`。fresh 与 normal 相等时不得安排周期后台刷新，到期后同步回源。
- 管理员创建、批量创建、公开数据编辑、审核通过、下线和重新发布只在 D1 事实与审计成功后 purge 全部六个 scope tag；标签归并 purge 除 sitemap 外的五个 tag。pending 驳回、already-target、冲突、校验失败、公共 pending 投稿和访问 POST 不 purge。
- 全局 purge 映射不得按当前 `PUBLIC_DATA_CACHE_SCOPES` 裁剪。关闭 scope 只阻止读取和本地 Cache API 操作；管理员 mutation 仍 purge 完整受影响 tag 集合，避免 48 小时内的旧条目在重新启用 scope 后恢复可见。
- 全局 purge 固定调用 `POST https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/purge_cache`，使用 `CLOUDFLARE_CACHE_PURGE_TOKEN` Bearer secret，body 为一次去重后的 `{ "tags": [...] }`。token 必须仅有目标 zone 的 Cache Purge: Edit 权限。
- purge 缺配置、网络失败、非 2xx、限流、无效 JSON 或 `success:false` 时只记录不含 token、Authorization 或完整上游 body 的结构化错误；不得回滚 D1 或改变成功管理响应。
- 地区聚合本地失效继续展开省级、市级和精确地区键，固定顺序去重并在 `24` 次处截断；全局 scope tag purge 负责不可枚举的列表、标签联想和其他数据中心条目。长 TTL 是 purge 失败时的最终收敛边界。
- 当 Cache API 只获准用于自定义域时，`workers_dev` 必须关闭；若未来确需保留 `*.workers.dev`，则必须在打开任何 scope 前增加受测的 hostname fail-closed 守卫。
- 本次六 scope 激活由站点负责人明确批准，不使用旧的 D1 用量、CPU、`exceededCpu` 或逐 scope canary 自动门禁；这些指标继续记录但不阻断激活。旧自动晋级控制器保持暂停。

### 4. Validation & Error Matrix

| 条件 | 行为 |
| --- | --- |
| Scope 缺失、空值或未知 | 全量 bypass，存储调用为 0 |
| 非 HTTP(S) origin | 键生成抛出 `TypeError` |
| 非正安全整数详情 ID | 键生成抛出 `RangeError` |
| 非规范中国日期 | 键生成抛出 `RangeError` |
| TTL 为负数、非有限数、顺序倒置或加法溢出 | envelope 创建抛出 `RangeError` |
| 缓存响应非 2xx, JSON 损坏, schema 不匹配, 旧首页合同或 DTO guard 失败 | miss, 调用方回源 D1 |
| Hero 地区, 热门窗口或任一场景本地榜地区与请求键不匹配 | miss, 调用方回源 D1 |
| `store.match()` 抛错 | miss，调用方回源 D1 |
| `store.put()` 抛错 | 返回 `error`，保留 D1 成功响应 |
| 写入 envelope 非法或已过 `errorUntil` | 返回 `skipped`，不调用 `put` |
| Cache-Tag 含空白、Unicode 或不可打印字符 | 返回 `skipped`，不调用 `put` |
| Scope 关闭、未知或 mutation 不影响公开数据 | 不打开 Cache API，`delete()` 调用为 0 |
| `store.delete()` / namespace / `waitUntil()` 失败 | 吞掉缓存错误，保留已经提交的 D1 事实和 API 成功响应 |
| purge 配置缺失、429、非 2xx、无效 JSON、`success:false` 或网络失败 | 结构化记录并吞掉错误，保留 D1 事实和管理 API 成功响应 |
| 失效候选超过 24 个 | 优先删除旧/新地区聚合的前 24 个去重键，其余条目由全局 tag purge 或 TTL 收敛 |

### 5. Good/Base/Bad Cases

- Good: 路由先完成现有参数守卫, 再用结构化参数生成键; scope 关闭时直接执行现有 D1 loader.
- Good: `division=31` 的 discovery cache 只接受全部 `division_code` 以 `31` 开头的 Hero candidates.
- Base: 缓存命中返回已通过 envelope, exact-shape 和 key identity guard 的值; 缓存未命中或不可用时透明回源 D1.
- Bad: 从 `Astro.request` 直接构造缓存键, 把 Cookie 带入共享键, 缓存完整 `EventRecord`, 或因为 `cache.put()` 失败把成功页面改成 500.
- Bad: 删除 `today` 后只保留 `isPublicHomepageDiscovery(value)` 形状校验; 这会让另一个地区的合法 Hero payload 进入当前地区的缓存键.
- Bad: 在管理员路由中复制 purge URL/Header/body, 把 token 写进 `wrangler.jsonc`, 或因 purge 失败返回 500.

### 6. Tests Required

- `test/public-data-cache.test.ts` 必须覆盖：默认关闭零调用、未知 scope fail closed、资源/地区/窗口/详情/筛选/分页/排序/标签键隔离、参数顺序归一化。
- 必须覆盖 envelope 损坏、schema 错误、TTL 顺序与每个边界时刻，以及加法溢出。
- 必须覆盖 `match` / `put` 异常、非法写入、过期写入和 DTO guard 失败。
- 必须覆盖合法 DTO 放入错误详情 ID, Hero 地区, 热门窗口/任一场景本地地区或列表页码键时被拒绝, 以及 whitespace-only 标签不进入列表缓存.
- 必须覆盖旧 discovery/popularity payload, 额外私有字段, 非法日期/时间, 开票时间缺少日期和负热度被 exact-shape guard 拒绝.
- 必须覆盖六类 TTL 边界、首页/列表跨日期键、每类固定 Cache-Tag、热门 45-55 秒稳定抖动、stale-if-error、同键并发合并、隐私字段和 subrequest 上限。
- `test/public-data-cache-invalidation.test.ts` 必须覆盖：scope 关闭零调用、D1 成功后路由接入、delete/open/`waitUntil` 失败不影响成功、地区祖先展开、重复影响去重和 24 次硬上限。
- 必须覆盖单次 mutation 至多一个 purge 请求、固定 endpoint、Bearer header、去重 tag body、六类/五类映射、pending 驳回零请求，以及缺配置、网络、429、非 2xx、无效 JSON、`success:false` 的安全降级和不泄密日志。
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
    scope: "homepage",
    scopes,
    store,
    request,
    isValue: (value): value is PublicHomepageDiscovery =>
        isPublicHomepageDiscovery(value) &&
        value.featuredEvents.every((event) =>
            matchesDivisionCode(event.division_code, divisionCode)
        )
});
```
