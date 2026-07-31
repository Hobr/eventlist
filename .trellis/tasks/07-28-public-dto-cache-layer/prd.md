# Public DTO cache layer on Cache API

## Goal

以默认关闭的方式预先建立基于 Cloudflare Cache API 的公开 DTO 缓存基础，并在生产证据达到明确阈值、真实 hostname 探针通过后，分 scope 引入读穿缓存与热度当日成功标记。在所有阶段保持 D1 为唯一事实来源，正常服务陈旧不超过 60 秒；本子任务保留并延后激活，不取消。

## Parent

父任务：`.trellis/tasks/07-28-d1-cache-strategy/`

需求以父任务 `prd.md` 的 R1-R33 为准；技术设计见父任务 `design.md` §0-§9、§12-§15；执行清单见父任务 `implement.md` §0.1、§3（当日成功标记部分）、§4-§8、§10、§11。本文件只界定本子任务的范围、前置条件与验收边界。

## Activation Preconditions

纯函数、注入式适配接口和默认关闭的配置解析可以先实现、测试和部署；任何公开路由的 Cache API `match` / `put`、生产 scope 激活或热度标记激活，仍须满足以下门禁（父设计 §0.1）：

1. Worker 已绑定自定义域名 `acg.hobr.site`（Workers 路由或 Custom Domain）。官方文档只保证自定义域与 Pages 域具备可用的 Cache API 操作，`*.workers.dev` 不在该列表内。
2. 在 `https://acg.hobr.site` 上的探针证明 `cache.put()` 后 `cache.match()` 可以命中。本地 `astro dev` 的 Miniflare 结果不作为依据。

此外，子任务 `07-28-d1-query-write-optimization` 应已上线并观察完整指标窗口，其 `rows_read`、Worker 请求与 CPU 实测数据用于确认本子任务的必要性与启用范围。

公开 DTO scope 只有在连续 3 个完整 24 小时窗口中，D1 `rows_read` 每个窗口均达到日额度 5,000,000 的 10%（500,000），或出现可归因于 D1 公开读取的持续延迟/错误压力时，才进入生产 pilot 评审。热度标记只有在连续 3 个完整 24 小时窗口中，Worker 请求每个窗口均达到日额度 100,000 的 25%（25,000），且详情统计 POST 占比足以形成可测收益时，才单独评审。提前 pilot 必须有路由级延迟/错误证据，不能只凭预期收益。

任何候选 scope 还必须有目标路由的正常流量 CPU 基线；CPU p99 达到或超过 10 ms、出现 `exceededCpu`，或样本不足以判断时不得激活该 scope。

## Scope

- `src/lib/cache/public-data.ts`：命名 namespace、版本化规范键、`CachedEnvelope<T>` 状态机、稳定抖动、`waitUntil()` 后台刷新、isolate 内 Promise 合并、异常安全降级。首个 preflight slice 只交付规范键、envelope/TTL 状态、严格默认关闭的 scope 解析和注入式最小存储接口。
- `src/lib/cache/view-dedupe.ts`：中国本地日期 TTL、二次 SHA-256 标记摘要、独立 namespace、D1 确认后才写标记。
- 路由接入：首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags`、`/sitemap.xml`；详情 SSR 命中标记时省略统计 POST。
- 写后失效：`MutationImpact` 驱动，地区键按省/市/县祖先前缀展开（父设计 §9.1）。
- 分阶段开关 `PUBLIC_DATA_CACHE_SCOPES` 与 `VIEW_DEDUPE_CACHE_ENABLED`，以及对应回滚路径。

## Out of Scope

- 索引改写、Cron 清理、`getDB()` 收口、DTO 投影、管理写入收口——属于子任务 `07-28-d1-query-write-optimization`。
- KV、Durable Objects、Queues、整页 HTML 缓存、全局 Workers Cache（父设计 §15 已论证否决理由）。
- 首个 preflight slice 不接入公开路由、不实现热度标记、不添加生产探针路由、不修改 `wrangler.jsonc` 开关，也不部署或修改 Cloudflare/D1 资源。后续父任务已单独批准四个新增 scope 的暗部署路由接入；这不构成生产激活授权。

## Acceptance Criteria

- [x] A0. 默认关闭的缓存基础可独立测试：缺失、空值或含未知 scope 的 `PUBLIC_DATA_CACHE_SCOPES` 解析为全关闭；关闭时注入式存储接口没有 `match` / `put` 调用。
- [x] A1. 生产 hostname 探针证据已记录，且在启用任何 scope 之前完成。
- [x] A2. 缓存键测试证明地区、窗口、活动 ID、筛选、分页、排序、标签不串用，参数顺序不产生重复键。
- [x] A3. 状态机测试覆盖 fresh hit、miss、后台刷新、60 秒阻塞边界、stale-if-error、硬期限、损坏条目与 Cache API 故障；缓存写失败不改变原成功响应。
- [ ] A4. 隐私测试证明所有缓存值不含投稿联系、建议标签、驳回原因、审计或访客键；标记键与日志不含原始 IP 或 `visitorKey`。
- [ ] A5. 失效测试证明修改 `110101` 的活动会失效 `11`、`1101`、`110101` 三级的发现键与 3/7/30 三个热门窗口键，旧/新地区双侧覆盖。
- [ ] A6. 调用预算测试证明单次公开读取的 Cache API + D1 调用合计 ≤ 10，单次写后失效的 `delete()` ≤ 24。
- [ ] A7. 热度测试证明首次与跨日写入 D1、同日重复为 no-op、无效或已结束活动与 D1 失败不建立标记、标记命中时 SSR 省略统计 POST 且 IP/日期变化后恢复输出。
- [ ] A8. 启用前后按路由的 CPU time p50/p99 对比表明公开读取仍在 10 ms 预算内，`exceededCpu` 未上升。
- [ ] A9. 清空 `PUBLIC_DATA_CACHE_SCOPES` 后所有路由直接回源 D1 且响应合同不变；`VIEW_DEDUPE_CACHE_ENABLED` 关闭后统计恢复原有 POST 路径。
- [ ] A10. `pnpm test`、`pnpm lint`、`tsc --noEmit`、`pnpm build` 全部通过。

## Rollout And Rollback

1. 先部署默认关闭的纯缓存基础，生产环境不设置 `PUBLIC_DATA_CACHE_SCOPES`。
2. 达到激活阈值且真实 hostname 探针通过后，先 pilot `tags,sitemap`；观察一个完整正常流量周期。
3. 外部控制面按 `popularity -> homepage -> detail -> list` 每次只增加一个 scope；远程 D1 schema、CPU、错误和响应一致性任一门禁不满足时自动停止，候选失败时恢复上一稳定 Worker Version。
4. 热度标记按独立 Worker 请求阈值、独立开关和独立验收评审，不与公开 DTO scope 捆绑。

任一 scope 出现地区/状态串用、错误率上升、CPU p99 达到 10 ms、`exceededCpu` 增加或命中收益不足时，立即从 `PUBLIC_DATA_CACHE_SCOPES` 删除该 scope；全量回滚时清空变量。缓存没有事实写入权，回滚不需要 D1 迁移或数据恢复。
