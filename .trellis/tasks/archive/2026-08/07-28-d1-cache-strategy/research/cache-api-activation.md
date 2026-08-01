# Research: Cache API 生产激活与真实域名探针

- Query: 核对 Cloudflare Cache API 的自定义域可用性、命名缓存签名、响应语义、Wrangler Custom Domain 配置，并给出启用 `tags,sitemap` 前最安全的真实 hostname 探针与两阶段激活步骤。
- Scope: mixed
- Date: 2026-07-31

## Findings

### 结论

当前可以准备并执行“自定义域 + scope 为空”的第一阶段；用户已明确授权本次直接推进 `tags,sitemap` pilot，构成对三日用量门槛的一次性例外，但不豁免真实域名探针、CPU/错误检查、暗部署和回滚验证：

1. `wrangler.jsonc:9-14` 已在本次研究期间由并行工作写入 `acg.hobr.site` Custom Domain，`wrangler.jsonc:30-35` 也已显式设置 `PUBLIC_DATA_CACHE_SCOPES: ""`，这是正确的 fail-closed 形态。
2. `.wrangler/deploy/config.json:1` 会让 `wrangler deploy/dev` 使用生成的 `dist/server/wrangler.json`；当前 `dist/server/wrangler.json:1` 仍是旧构建，缺少 route 和 `PUBLIC_DATA_CACHE_SCOPES`。部署前必须重新 `build` 并检查生成配置。
3. `src/types/cloudflare.ts:7-16` 尚无 `PUBLIC_DATA_CACHE_SCOPES`，`src/pages/api/tags.ts:9-13` 和 `src/pages/sitemap.xml.ts:29-46` 仍直接读取 D1；只改环境变量不会启用缓存。必须先完成真实 Cache store 适配、RuntimeEnv 字段和两条路由接入，并以空 scope 暗部署。
4. 项目常规门禁尚未满足：`.trellis/tasks/07-28-d1-cache-strategy/implement.md:195-202` 记录的首个 24 小时 `rows_read=2569`，远低于连续 3 个完整窗口 `>=500000/day` 的 pilot 门槛。用户已明确接受本次提前 pilot 的容量依据例外；执行记录必须写明该偏差，不能把它误记为门槛已通过。`.trellis/spec/backend/public-data-cache.md:31-32` 中真实 hostname 探针、候选路由 CPU p99 `<10 ms` 和 `exceededCpu=0` 仍是硬门禁。

### Cloudflare 当前合同

- Cache API 内容只保存在调用所在数据中心，不会自动复制；`cache.put()` 不兼容 Tiered Cache；`cache.delete()` 只清除当前数据中心。
- Workers 只有从自定义域运行时才有可工作的 Cache API 操作；Dashboard editor/Playground 操作无效。被 Cloudflare Access 前置的 Worker 当前不能使用 Cache API。因此探针必须走 `https://acg.hobr.site`，且路径不能落入 `/admin` Access policy。
- 当前运行时签名（`worker-configuration.d.ts:1015-1037`）：
  - `caches.open(cacheName: string): Promise<Cache>`
  - `cache.match(request: RequestInfo | URL, { ignoreMethod? }): Promise<Response | undefined>`
  - `cache.put(request: RequestInfo | URL, response: Response): Promise<void>`
  - `cache.delete(request: RequestInfo | URL, { ignoreMethod? }): Promise<boolean>`
- `match()` miss/过期在脚本中返回 `undefined`，不会向 origin 发 subrequest；Cloudflare Logs 可能仍显示预期的 `504`、`RequestSource=edgeWorkerCacheAPI`。
- `put()` 的 response 会遵守 `Cache-Control`、`Cache-Tag`、`ETag`、`Expires`、`Last-Modified`。带 `Set-Cookie` 的响应默认不缓存；非 GET key、206 response、`Vary: *` 会报错；`stale-while-revalidate` / `stale-if-error` 不受 Cache API 原生支持。
- `match()` 不支持浏览器 Cache API 的 `ignoreSearch` / `ignoreVary`；现有 `buildPublicDataCacheRequest()` 使用固定字段顺序的合成 GET key（`src/lib/cache/public-data.ts:245-290`）是正确方向。
- Workers Free 每次最多 50 次 Cache API 调用，并与 fetch/subrequest 配额共享；探针应保持固定次数和固定 key。
- Wrangler 4.116.0 的 Custom Domain 形态是 `routes: [{ pattern: "acg.hobr.site", custom_domain: true }]`。对于本 Worker 自身就是 origin 的 Astro 应用，Cloudflare 明确推荐 Custom Domain，而不是在已有应用 origin 前加传统 Route。

### 第一阶段：记录域名配置并完成一次性真实 hostname 探针

前置人工核对：在 Dashboard 的 **Workers & Pages > eventlist > Settings > Domains & Routes** 确认 `acg.hobr.site` 当前属于同一个 Worker、类型是 Custom Domain；确认 Access 只保护 `/admin*` / `/api/admin*`，不保护探针路径。Custom Domain 不能创建在已有 CNAME 上，也不能创建在不归当前账号所有的 zone。

配置应保持：

```jsonc
"workers_dev": false,
"routes": [
  { "pattern": "acg.hobr.site", "custom_domain": true }
],
"vars": {
  "PUBLIC_DATA_CACHE_SCOPES": ""
}
```

`workers_dev` 当前未写，因此按 Wrangler schema 默认为 `true`。如果 `*.workers.dev` 没有明确运维用途，激活 Cache API 前应设为 `false`，避免同一 scope 在官方未保证可用的 hostname 上执行。若必须保留，则应用必须只在 `acg.hobr.site` 创建 Cache store，其余 host fail closed 回 D1。

临时探针 endpoint 应为一个公开但能力受限的固定 GET，例如 `/_eventlist-cache-probe-v1`。它不读取输入、不暴露数据，只对命名缓存 `eventlist-preflight-v1` 的固定 key 执行：

```ts
const cache = await caches.open("eventlist-preflight-v1");
const key = new Request(new URL("/_eventlist_cache/preflight-v1", request.url), {
    method: "GET"
});
await cache.delete(key);
await cache.put(
    key,
    new Response("eventlist-preflight-2026-07-31", {
        status: 200,
        headers: {
            "Cache-Control": "public, max-age=60",
            "Content-Type": "text/plain; charset=utf-8"
        }
    })
);
const matched = await cache.match(key);
const hit = (await matched?.text()) === "eventlist-preflight-2026-07-31";
const cleaned = await cache.delete(key);
```

仅当 `hit && cleaned` 时返回 `204` 和 `X-Eventlist-Cache-Probe: hit`；否则返回 `502` 和 `...: failed`。endpoint 自身响应必须 `Cache-Control: no-store`。固定 key、固定小对象、先删后写、验证后再删使公开探针的写入面有界，并能证明 `put()` 后的 `match()`，而不是只相信 `put(): Promise<void>`。

精确发布/验证命令：

```bash
corepack pnpm exec wrangler whoami
corepack pnpm exec wrangler deployments status --json
corepack pnpm exec wrangler versions list --json
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm exec wrangler types --check
rg -n 'acg\.hobr\.site|PUBLIC_DATA_CACHE_SCOPES|custom_domain' dist/server/wrangler.json
corepack pnpm exec wrangler deploy --dry-run --strict
corepack pnpm exec wrangler deploy --strict
curl --fail-with-body --silent --show-error --dump-header - --output /dev/null https://acg.hobr.site/_eventlist-cache-probe-v1
```

另一个终端可同时观察：

```bash
corepack pnpm exec wrangler tail eventlist --format json --sampling-rate 1
```

接受条件：真实 URL 返回 HTTP 204、`X-Eventlist-Cache-Probe: hit`，tail 中没有 endpoint 500/1102。保留完整响应头中的日期、`cf-ray` 和 probe header 作为 A25 证据。随后立即删除临时 endpoint，再以 `PUBLIC_DATA_CACHE_SCOPES: ""` 重跑 build/type/dry-run/deploy，确认探针 URL 404 且公开页面仍正常。

### 第二阶段：暗部署 `tags,sitemap` 接入，门禁满足后再翻转 scope

先完成以下代码合同，但保持 scope 为空：

- `RuntimeEnv.PUBLIC_DATA_CACHE_SCOPES?: string` 与生成类型一致。
- 用 `await caches.open(PUBLIC_DATA_CACHE_NAMESPACE)` 实现 `PublicDataCacheStore`；`match/put` 异常继续按 `src/lib/cache/public-data.ts:343-369` 的 miss/D1 fallback 和写失败不影响成功响应原则处理。
- `/api/tags` 和 `/sitemap.xml` 只缓存逐字段 DTO；不缓存错误响应、Cookie、Authorization 或完整 D1 记录。
- 增加路由级 fail-closed、连续两次请求、D1/Cache 错误注入、60 秒边界和响应头测试。

暗部署命令与第一阶段相同，配置仍为 `PUBLIC_DATA_CACHE_SCOPES: ""`。部署后检查两条路由应返回 `X-Eventlist-Cache: BYPASS`，且实现不得执行 `match/put`：

```bash
curl --fail-with-body --silent --show-error --dump-header - --output /dev/null 'https://acg.hobr.site/api/tags?q=%E5%90%8C'
curl --fail-with-body --silent --show-error --dump-header - --output /dev/null https://acg.hobr.site/sitemap.xml
```

本次用户授权允许跳过“连续三日准入指标通过或存在可归因 D1 持续问题”这一容量门槛，但执行记录必须标注为例外。只有在真实探针通过、暗部署验证通过、`tags` 与 `sitemap` 各自 CPU p99 `<10 ms` 且 `exceededCpu=0` 后，才把 source-of-truth 配置改为：

```jsonc
"PUBLIC_DATA_CACHE_SCOPES": "tags,sitemap"
```

然后再次执行：

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm exec wrangler types --check
rg -n 'acg\.hobr\.site|PUBLIC_DATA_CACHE_SCOPES|tags,sitemap' dist/server/wrangler.json
corepack pnpm exec wrangler deploy --dry-run --strict
corepack pnpm exec wrangler deploy --strict
```

生产两次请求验证正文一致且第二次为 HIT：

```bash
CACHE_CHECK_DIR=$(mktemp -d)
curl --fail-with-body --silent --show-error --dump-header "$CACHE_CHECK_DIR/tags-1.headers" --output "$CACHE_CHECK_DIR/tags-1.json" 'https://acg.hobr.site/api/tags?q=%E5%90%8C'
curl --fail-with-body --silent --show-error --dump-header "$CACHE_CHECK_DIR/tags-2.headers" --output "$CACHE_CHECK_DIR/tags-2.json" 'https://acg.hobr.site/api/tags?q=%E5%90%8C'
curl --fail-with-body --silent --show-error --dump-header "$CACHE_CHECK_DIR/sitemap-1.headers" --output "$CACHE_CHECK_DIR/sitemap-1.xml" https://acg.hobr.site/sitemap.xml
curl --fail-with-body --silent --show-error --dump-header "$CACHE_CHECK_DIR/sitemap-2.headers" --output "$CACHE_CHECK_DIR/sitemap-2.xml" https://acg.hobr.site/sitemap.xml
cmp "$CACHE_CHECK_DIR/tags-1.json" "$CACHE_CHECK_DIR/tags-2.json"
cmp "$CACHE_CHECK_DIR/sitemap-1.xml" "$CACHE_CHECK_DIR/sitemap-2.xml"
rg -i '^x-eventlist-cache:' "$CACHE_CHECK_DIR"/*.headers
```

快速回滚不是全局 purge：把 `PUBLIC_DATA_CACHE_SCOPES` 恢复为 `""`，重新 build + `wrangler deploy --strict`，然后确认两条路由均为 `BYPASS`。Cache API 按数据中心隔离，不能依赖 `cache.delete()` 做全球回滚；空 scope 必须让所有旧条目被忽略并直接回 D1。

### 配置风险

- Wrangler 将配置文件视为 source of truth。配置中一旦出现 `routes`，后续 deploy 会以文件中的 routes 覆盖 Dashboard routes；首次部署前必须盘点所有现有 route/domain，不能只记录 `acg.hobr.site` 后误删其他域名。
- 默认 deploy 会删除 Dashboard 中未出现在配置里的普通 vars，再设置配置内 vars；Secrets 不会被 deploy 删除。必须先核对 Dashboard-only 的 `AUTH_MODE` 等普通变量，避免 route 激活部署顺带改变鉴权。不要用临时 `--var PUBLIC_DATA_CACHE_SCOPES:tags,sitemap`，它会削弱配置的可审计性并可能与其他 vars 的覆盖语义混淆。
- Astro build 会生成 `dist/server/wrangler.json`，而 `.wrangler/deploy/config.json` 会把 deploy 重定向到它；必须 build 后检查生成配置，不得只审查根 `wrangler.jsonc`。
- Custom Domain 会自动管理 DNS/证书，不能覆盖已有 CNAME；传统 Route 则要求已存在 orange-clouded DNS origin。该 Astro Worker 是应用 origin，优先保留 `custom_domain: true`。
- Access 若覆盖整个 hostname，Cache API 不可用；公开 `/api/tags`、`/sitemap.xml` 和探针路径必须不在 Access policy 内。
- 官方 Free CPU 上限仍为 10 ms；当前项目 CPU 门禁没有过时。Cache API 调用可减少 D1 wall time，但 JSON/envelope 工作仍计入 CPU。

## Files Found

- `wrangler.jsonc` - 当前已记录 Custom Domain 和空 cache scope；`workers_dev` 仍缺失。
- `.wrangler/deploy/config.json` - Wrangler deploy/dev 指向 Astro 生成配置。
- `dist/server/wrangler.json` - 当前构建产物陈旧，尚未带入最新 route/scope。
- `package.json` - Wrangler 4.116.0；已有 test/lint/build/generate-types，没有独立 deploy 脚本。
- `src/lib/runtime/env.ts` - 通过 `cloudflare:workers` 的全局 `env` 取得运行时绑定。
- `src/types/cloudflare.ts` - 手写 RuntimeEnv，当前缺少 cache scope 字段。
- `src/lib/cache/public-data.ts` - 命名空间、scope parser、合成 key、envelope、read/write 与 fail-closed 基础。
- `test/public-data-cache.test.ts` - 覆盖默认关闭、key 隔离、TTL、损坏条目和 store 异常；没有真实 Cache API 或路由测试。
- `src/pages/api/tags.ts` - 当前每次请求直接调用 D1 `searchTags()`。
- `src/pages/sitemap.xml.ts` - 当前每次请求直接调用 D1 sitemap query，并保留静态 URL 降级。
- `deploy.md` - 现有发布顺序是 build/types/dry-run/deploy；Custom Domain 仍描述为 Dashboard 或 routes 二选一。

## External References

- [Cloudflare Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) - last updated 2026-07-06；可用 hostname、Access 限制、签名、headers、miss/504、数据中心隔离和 delete 范围。
- [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) - last updated 2026-06-23；Worker-as-origin 推荐、DNS/CNAME 限制和 `custom_domain: true` 配置。
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/) - last updated 2026-07-24；routes/workers_dev、source-of-truth、vars/routes 覆盖和生成配置重定向。
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/) - last updated 2026-06-01；传统 Route 的 origin/DNS 前提与匹配语义。
- [Cloudflare Workers Limits](https://developers.cloudflare.com/workers/platform/limits/) - last updated 2026-07-28；Free CPU 10 ms、50 subrequests、Cache API 50 calls/request 且共享 quota。
- 本地 `worker-configuration.d.ts` - Wrangler 4.116.0 / workerd 1.20260730.1 生成的 CacheStorage/Cache 精确 TypeScript 签名。

## Related Specs

- `.trellis/spec/backend/public-data-cache.md:24-32` - 合成 key、fail closed、生产探针、CPU 与三日 pilot 门禁。
- `.trellis/spec/backend/public-data-cache.md:38-45` - Cache/D1 错误降级矩阵。
- `.trellis/spec/backend/public-data-cache.md:54-60` - 路由接入后的必测项和质量命令。
- `.trellis/tasks/07-28-d1-cache-strategy/prd.md:52-55` - 自定义域、CPU 和共享 subrequest 要求。
- `.trellis/tasks/07-28-d1-cache-strategy/implement.md:184-202` - 暗部署、准入指标、pilot 顺序与当前生产审计。

## Caveats / Not Found

- 未部署、未修改产品代码、未修改 `wrangler.jsonc`、未调用生产 Cache API；真实 `put/match` 证据仍不存在。
- 用户已明确授权本次 `tags,sitemap` pilot 跳过连续三日 `rows_read` 门槛；此例外不覆盖真实 hostname 探针、CPU/错误门禁、空 scope 暗部署或回滚验证，也不自动适用于后续 scope。
- 无 Wrangler `routes list` 命令可直接从当前 CLI 枚举 Dashboard routes；首次 route-as-code deploy 前必须在 Dashboard/API 做远端清单核对。
- 当前 `curl` 只证明 `/`、`/api/tags`、`/sitemap.xml` 在 `acg.hobr.site` 返回 Cloudflare 200，不能证明该绑定类型一定是 Custom Domain，也不能替代 Cache API 探针。
- 研究期间共享工作区有并行修改：最新根配置已加入 route/空 scope，生成类型已更新，但 Astro deploy 产物尚未重新生成；执行者必须以部署前的最新文件为准重新检查。
