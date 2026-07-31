# Implementation Plan

## 0. 启动前门禁

- [ ] 用户明确批准本次最终规划摘要后，才运行 `task.py start`。
- [ ] 记录工作区现有改动，保留并避开本任务之外的用户文件；不得覆盖当前 `pnpm-lock.yaml` 改动。
- [ ] 运行 `trellis-before-dev`，重新加载后端数据库、错误处理和相关前端规范。
- [ ] 记录部署前的 CPU time 基线：从 Workers Logs 按路由取首页、列表、详情、API 的 CPU p50/p99，与 10 ms 上限对照（design §0.2）。

### 0.1 缓存生产激活前置条件（子任务 B 的阻断项）

- [x] Worker 绑定自定义域名 `acg.hobr.site`（Workers 路由或 Custom Domain），`wrangler.jsonc` 记录该配置。
- [x] 在 `https://acg.hobr.site` 上部署临时探针路由：合成 GET 先 `cache.put()` 再 `cache.match()`，把命中/未命中写入响应头。
- [x] 记录探针输出作为证据（A25）。真实 hostname 返回 HTTP `204`、`X-Eventlist-Cache-Probe: hit`，`cf-ray: a23bbadd1ef49e1e-SIN`；本地 Miniflare 结果未作为依据。
- [x] 探针通过前保持空 scope；验证完成后先删除探针，再仅启用获批的 `tags,sitemap`。当前两个探针候选路径均返回 `404`。

### 0.2 分工

- **子任务 A `07-28-d1-query-write-optimization`（不依赖 Cache API，先做）**：第 1、2 节，以及第 3 节中除 Cache API 标记以外的部分（`recordEventView` 收口、`deleteExpiredEventVisitors`、`src/worker.ts` 自定义入口与 Cron）。第 8 节中对应的测试同批完成。
- **子任务 B `07-28-public-dto-cache-layer`**：默认关闭的纯缓存基础可在 §0.1 前交付；第 3 节的当日成功标记、第 4-7 节中的路由/Cache API 接入，以及对应集成测试仍依赖 §0.1 通过。
- 子任务 A 上线并观察一个正常流量周期后，再依据实测 `rows_read` / CPU 决定 B 的启动时机与范围。

## 1. 建立基线与查询优化

- [ ] 在新的临时 `--persist-to` 目录应用 `0001_init.sql` 和 `docs/dev/seed-public-site.sql`。
- [ ] 记录首页、热门、列表、详情、标签、sitemap 和访客写入的当前结果与查询计划。
- [ ] 用临时访客键验证首次 upsert、同日重复 upsert 和跨日 upsert 的 `changes()`；记录本地模拟器不提供生产 `rows_written` 明细，生产计费必须以 D1 meta/Dashboard 为准。
- [ ] 在 `src/lib/db/queries.ts` 去掉规范日期/时间列外层无意义的 `date()` / `time()` / `datetime()`，保留右侧中国本地时间函数。
- [ ] 更新 `test/homepage-discovery.test.ts` 等 SQL 合同测试，使其断言直接列比较和原有排序/限制。
- [ ] 新增查询计划测试或验证脚本，确认：
  - 热门窗口使用 `idx_event_visitors_recent`
  - 访客清理使用 `idx_event_visitors_recent`
  - sitemap 使用 `idx_events_status_updated` 且不再额外排序
  - 精确地区查询仍使用 `idx_events_public_division`
- [ ] 对种子数据比较改写前后的完整结果、排序和 3/7/30 日聚合，证明语义一致。

## 2. 收口数据库接口与管理写入

- [ ] 为 D1 binding 建立调用计数基线，区分 binding 调用、batch statements、`rows_read` 和 `rows_written`。
- [ ] 将 `getDB()` 改为只校验并同步返回 `runtimeEnv.DB`，删除运行时 `ensureFK()`；保留迁移中的外键声明，并增加 D1 外键约束集成测试。
- [ ] 按 `public-events`、`homepage`、`views`、`tags`、`admin-events`、`submissions` 拆分 `src/lib/db/queries.ts`；迁移期间只允许一个无逻辑 re-export 兼容入口，不引入 ORM 或通用 Repository。
- [ ] 建立显式 `PUBLIC_EVENT_COLUMNS` 和公开 DTO 映射；公开详情在 SQL 中直接限制 `published | offline`，首页、热门和列表不再使用 `events.*`。
- [ ] 保留首页发现/热门各自的 batch 和 `/events` 的标签/列表并行读取；用延迟测试证明没有为了减少调用把独立 loader 串行化。
- [ ] 新增 `transitionEventStatus()`：把期望旧状态和规范标签资格放入条件 UPDATE，并在同一 batch 返回当前状态/标签探针；保留 changed/already-target/conflict 与现有 HTTP 状态码。
- [ ] 用临时本地 D1 验证 batch 紧邻 statement 的 `changes()` 行为；只有验证可靠时才用它门控同批审计，否则 changed 后单独写审计，确保不产生错误审计。
- [ ] 将标签解析改为 `json_each()` 集合式插入和 `COALESCE(alias_of_id, id)` 规范化，删除逐标签 `findOrCreateTagIds()`。
- [ ] 重构编辑操作：一次读取旧状态/地区/标签快照，一个 batch 完成活动更新、标签 upsert、关系差异删除/插入和审计；返回 `MutationImpact`，不在路由提交后回读 D1。
- [ ] 重构标签归并：一次读取源/目标/受影响活动，一个 batch 完成关系变更、别名更新和审计；返回受影响活动 ID。
- [ ] 将单条管理员创建的逐标签 statements 收口为集合式标签插入和关系插入；保持 `nextEventId` 冲突重试与事件/关系/审计原子 batch。
- [ ] 保持批量创建现有的集合式标签和原子 batch，不因模块拆分增加额外逐条查询或审计调用。

## 3. 优化热度写入链路

- [ ] 新增 `src/lib/cache/view-dedupe.ts`，实现：
  - 中国本地日期与下一本地零点 TTL 计算
  - 基于事件级 `visitorKey` 的二次 SHA-256 标记摘要
  - 独立 `eventlist-view-dedupe-v1` Cache API namespace
  - 无 Cookie/Authorization 的合成 GET 键
  - `match` / `put` 失败安全降级
  - isolate 内同标记 Promise 合并和 `finally` 清理
- [ ] 新增 `VIEW_DEDUPE_CACHE_ENABLED` 解析；关闭时不读取或写入标记，保留直接 D1 统计路径。
- [ ] 重构 `recordEventView()`：
  - 删除每次访问执行的过期访客清理
  - 保留首次/跨日条件 upsert
  - 在同一 D1 batch 中验证当日访客行是否存在
  - 返回 `changed | already-current | ignored` 结果；前两者可写标记，`ignored` 覆盖无效/已结束活动并禁止假阳性标记
- [ ] 更新 `/api/events/[id]/view.ts`：标记命中直接 204；未命中时合并并发 D1 调用；只有 D1 确认后 best-effort 写标记。
- [ ] 更新 `/events/[id].astro`：已发布活动在 SSR 阶段只读当前 IP/活动/日期标记；命中时省略 `data-event-view-endpoint`，未命中或 Cache API 异常时保留现有后台 POST。
- [ ] 保持页面不等待统计写入；D1 或标记失败继续由客户端静默忽略，不改变正文、导航或状态提示。
- [ ] 新增 `deleteExpiredEventVisitors()`，使用 `last_seen_date < date('now', '+8 hours', '-29 days')` 和现有索引。
- [ ] 按 Astro 7 官方自定义入口方式新增 `src/worker.ts`：`fetch` 委托 `@astrojs/cloudflare/handler`，`scheduled()` 执行访客清理。
- [ ] 将 `wrangler.jsonc.main` 指向 `./src/worker.ts`，配置 `5 16 * * *` 每天中国时间 00:05 的 Cron；确认生成的 `dist/server/wrangler.json` 保留 D1、assets、vars 和 trigger。
- [ ] 为 Cron 失败定义聚合日志和人工维护命令；不得在日志中输出 IP、访客键或标记摘要。

## 4. 建立公开 DTO 和缓存核心

- [x] 为活动列表和详情新增逐字段公开投影，禁止对象展开和完整 `EventRecord` 序列化。
- [x] 新增 `src/lib/cache/public-data.ts`，实现：
  - 命名 Cache API namespace
  - 版本化、规范化合成键
  - `CachedEnvelope<T>` 解析和损坏条目降级
  - 新鲜/正常陈旧/故障陈旧状态机
  - 稳定抖动
  - `waitUntil()` 后台刷新
  - isolate 内 Promise 合并和 `finally` 清理
  - Cache API 读写异常不影响 D1 成功结果
- [x] 新增 `PUBLIC_DATA_CACHE_SCOPES` 解析；缺失、空值或未知 scope 默认绕过缓存。
- [x] 为 loader 返回统一的 `cacheState`，供 API 头、SSR 提示和采样日志使用。

### 4.1 默认关闭的 preflight slice

- [x] 复用现有公开 DTO 类型，建立先行版本 `eventlist-public-data-v1` 常量与版本化、固定字段顺序的合成 GET 键；请求不继承 Cookie、Authorization 或原始查询字符串。详情字段扩展随后将源码 namespace/schema 提升为 v2/2，当前生产 pilot 仍运行隔离部署的 v1。
- [x] 实现 `CachedEnvelope<T>` 创建/解析与 fresh、normal-stale、fault-stale、hard-expired 边界分类；损坏、版本错误或时间边界倒置的条目按 miss 处理。
- [x] 实现 `PUBLIC_DATA_CACHE_SCOPES` 严格解析：缺失、空值或任一未知 token 均 fail closed 为全关闭。
- [x] 建立注入式 `PublicDataCacheStore` 最小接口及异常安全 read/write helper；scope 关闭时不调用 `match` / `put`。
- [x] 增加 key 隔离、envelope、TTL 边界、损坏条目和默认关闭行为的聚焦单元测试。
- [x] 稳定抖动、读穿 loader、`waitUntil()`、同 isolate 并发回源合并及 `tags,sitemap` 路由接入已经完成；后续 Phase 2 已补齐其他公开路由与写后失效，生产仍仅启用这两个 scope。

### 4.2 2026-07-31 preflight 质量检查

- [x] Phase 2.2 全范围审查确认 `tags,sitemap` 已采用默认关闭的暗部署路由接入；scope 缺失或为空时不执行 `match` / `put`，没有生产 Cache API 副作用。
- [x] 详情键拒绝非正安全整数，避免非法 ID 静默碰撞；envelope 创建拒绝时间加法溢出，写入 helper 对非法或过期 envelope fail closed。
- [x] 聚焦缓存测试 20/20 通过；完整 `corepack pnpm test` 100/100 通过。
- [x] `corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 与 `git diff --check` 全部通过。
- [x] 并发提交 `3957138` 更新活动类型/规模显示值后，同步修正批量导入测试夹具；未回退该提交或修改批量导入业务逻辑。

## 5. 集成低基数高收益读取

- [x] 首页 SSR、`/api/homepage` 和 `/api/popularity` 复用相同的发现/热门缓存函数。
- [x] 保证首页仍先解析查询参数/IP/default 地区，再建立缓存键。
- [x] 为 top tags、1-24 字标签联想、详情和 sitemap 接入缓存。
- [x] 不缓存详情负结果；pending/rejected 继续立即 404，offline 继续显示历史提示。
- [x] 成功 JSON GET 增加短 `private, max-age=15`；错误响应 `no-store`。
- [x] JSON/sitemap 增加 `X-Eventlist-Cache`；故障陈旧增加对应 `Server-Timing` 标记。
- [x] SSR 故障陈旧只显示克制提示，不改变正常页面布局或加载交互。

## 6. 集成写后失效

- [x] 新增 best-effort 失效 helper；所有 delete promise 使用 `waitUntil()` 并吞掉缓存错误。
- [x] 公共投稿不触发公开失效。
- [x] 管理员创建/批量创建按 24 次预算失效已知地区首页/热门、top tags 和 sitemap；地区聚合优先，超预算固定键由 60 秒 TTL 收敛。
- [x] 编辑直接使用数据库业务操作返回的 `MutationImpact`，按预算失效详情、两侧地区首页/热门、top tags 和 sitemap；不得提交后再次读取旧地区或状态。
- [x] 审核通过、下线和重新发布使用状态操作返回的活动/地区/状态影响，按预算失效详情、地区聚合、top tags 和 sitemap。
- [x] 标签归并使用操作返回的受影响活动 ID 失效 top tags 和可识别详情；无法枚举的搜索/列表键由 60 秒上限保证。
- [x] 失效只在 D1 和审计成功后执行；失效失败不得改变 API 成功响应。

## 7. 集成受控活动列表缓存

- [x] 从解析后的 `PublishedEventFilters` 生成固定顺序键，写入实际默认 timing/sort/pageSize。
- [x] 仅准入第 1-3 页和合理长度字段；其他请求透明绕过缓存。
- [x] 页面改用 `PublicEventPage`，保持现有卡片、分页、筛选和空状态。
- [x] 不为了删除所有列表键引入 KV epoch、Cache API 枚举或额外 D1 版本查询。

## 8. 自动化测试

- [x] 新增缓存核心单元测试：fresh hit、miss、后台刷新、60 秒阻塞边界、stale-if-error、过硬期限、损坏条目、Cache API 失败。
- [x] 新增并发测试：同键一次 loader、不同键独立、失败后 in-flight Map 清理。
- [x] 新增键隔离测试：地区、窗口、活动 ID、筛选、分页、排序和标签不得碰撞；参数顺序不产生重复键。
- [x] 新增隐私测试：所有缓存 DTO 均不含投稿联系、建议标签、驳回原因、审计或访客键。
- [ ] 新增数据库接口合同测试：`getDB()` 不执行 statement；公开 SQL 不含 `events.*` 或私有列；模块兼容入口不含业务逻辑。
- [ ] 新增管理写入调用计数测试：状态变更符合最多 1-2 次、编辑固定 2 次、标签归并固定 2 次，且标签数量不会增加 binding 调用。
- [ ] 新增关系差异写入测试：标签不变时不删除/重建 `event_tags`，增删各一项时只改变对应关系；审计与编辑/归并事实写入同批回滚。
- [ ] 新增状态机回归测试：changed、already-target、wrong-status、missing-tag 和 not-found 的响应、审计数量与当前行为一致。
- [ ] 新增创建回归测试：单条与批量创建仍原子写入活动、规范标签关系和审计，大小写标签与 alias 继续归一到规范 ID。
- [ ] 新增路由源码/行为测试：POST、管理 API、投稿、鉴权响应均不调用公共缓存。
- [ ] 新增热度标记测试：同活动/IP/日期键稳定；活动、IP 或日期变化时键不同；键和日志不含原始 IP 或 `visitorKey`。
- [ ] 新增热度写入测试：首次和跨日记录、同日 no-op、无效/已结束活动不建立标记、D1 失败不建立标记、`cache.put` 失败不改变 D1 成功。
- [ ] 新增热度并发测试：同 isolate 合并；模拟跨 isolate 重复 batch 时主键与条件更新保持一行且当天日期正确。
- [ ] 更新详情访问测试，证明热度标记命中时 SSR 省略独立 POST；未命中、IP 变化、跨日和 Cache API 故障时仍输出 POST；offline/ended 不统计。
- [ ] 新增 Cron 测试：只删除 30 日窗口外数据、保留边界日期、直接比较索引列、失败不影响 `fetch` handler。
- [x] 新增写后失效测试，证明 D1 成功不因 delete、cache open 或 `waitUntil` 失败变成错误。
- [x] 新增地区前缀失效测试：修改 `110101` 的活动会失效 `11`、`1101`、`110101` 三级的发现键与 3/7/30 三个热门窗口键，旧/新地区双侧覆盖，重复地区与活动 ID 不产生冗余 delete。
- [x] 新增调用预算测试：单次公开读取的 Cache API + D1 调用合计 ≤ 10，单次写后失效的 `delete()` ≤ 24，且都不随标签数、活动数或地区层级增长。

## 9. 本地集成验证

```bash
cache_tmp=$(mktemp -d)
corepack pnpm exec wrangler d1 migrations apply DB --local --persist-to "$cache_tmp"
corepack pnpm exec wrangler d1 execute DB --local --persist-to "$cache_tmp" --file=docs/dev/seed-public-site.sql

corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
git diff --check
```

- [ ] 使用 `corepack pnpm exec astro dev --background` 启动本地服务。
- [ ] 连续请求首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags` 和 sitemap，确认第二次命中且正文一致。
- [ ] 对同一活动连续加载详情：第一次保留并成功执行 POST，标记建立后第二次 SSR 不再输出统计 endpoint；切换模拟 IP 或中国日期后重新输出 POST。
- [ ] 直接重复调用统计 POST，确认标记命中时无 D1；删除/绕过标记后同日 D1 upsert 为 no-op 并重建标记。
- [ ] 请求 `/cdn-cgi/handler/scheduled?format=json` 测试 Cron，确认过期行被清理、窗口内行保留且普通页面仍由 Astro handler 提供。
- [ ] 用不同地区、窗口、筛选、页码和活动 ID 验证没有串缓存。
- [ ] 在 scope 关闭时确认所有路由直接使用 D1 且响应合同不变。
- [ ] 注入 Cache API 失败确认回源；注入 D1 失败确认只在硬期限内使用故障陈旧缓存。
- [ ] 通过管理员创建、编辑、下线、重新发布和标签归并验证本地失效及最迟 60 秒可见边界。
- [ ] 通过 D1 result meta 比较标签未变化、单项增删和原有全量重写的 `rows_written`，并单独报告 binding 调用减少。
- [ ] 使用 `astro dev logs` 检查没有 Secret、原始 IP 或完整 D1 记录进入日志。
- [ ] 完成后运行 `astro dev stop`。

## 10. 发布和监控

- [x] 先以空 `PUBLIC_DATA_CACHE_SCOPES` 且关闭 `VIEW_DEDUPE_CACHE_ENABLED` 部署数据库接口收口、查询优化、自定义入口、Cron 和缓存代码。
- [ ] 记录部署前 D1 `rows_read` / `rows_written`、Worker 总请求、统计 POST 和错误基线；确认 D1 Free 写入行包含索引成本。
- [ ] 记录部署前后按路由的 CPU time p50/p99 与 `exceededCpu` 调用数；任一公开路由 p99 逼近 10 ms 时暂停后续 scope 启用（design §0.2）。
- [ ] 连续 3 个完整 24 小时窗口均满足以下至少一个对应门槛后才评审 pilot：公开 DTO 的 D1 `rows_read >= 500,000/日`，或热度标记的 Worker 请求 `>= 25,000/日` 且统计 POST 占比足以产生可测收益。可归因于 D1 的持续路由延迟/错误可提前触发评审，但必须记录证据。
- [x] 确认 §0.1 探针已在生产 hostname 通过，再进入下面任何 scope 启用步骤。
- [ ] 热度标记只在其独立 Worker 请求门槛通过后启用；比较统计 POST、标记命中率、D1 热度操作和 `rows_written`，确认热门榜仍在 60 秒内反映新访客。
- [x] 公开 DTO 先 pilot `tags,sitemap`；继续观察正常流量周期，`homepage,popularity` 不随本次 pilot 启用。
- [ ] 下一轮启用 `detail`；目标路由 CPU p99 必须低于 10 ms 且 `exceededCpu` 为 0。
- [ ] 只有列表重复请求能提供有意义命中率时才启用 `list`。
- [ ] 命中率低、错误上升或地区/状态错误时立即清空 scope；不需要数据库回滚。

### 10.1 自动扩大到其他 scope

- [x] 为 `popularity`、`homepage`、`detail`、`list` 分别完成缓存 loader、DTO guard、规范键、TTL、错误降级、响应状态和路由接入；不得只修改环境变量。
- [x] 首页 SSR 保持发现/热门 `Promise.allSettled()` 独立错误隔离；`/api/homepage` 保持全有或全无；`/api/popularity` 复用相同热门 loader。
- [x] 详情只缓存静态 `PublicEventDetail`，近 30 日热度继续独立读取；负结果不缓存，访问统计 POST 不因本序列改变。
- [x] 列表只准入规范化参数、合理长度字段和第 1-3 页；其他请求透明绕过。`/events` 的 top tags 复用现有 `tags` loader。
- [x] 建立 Worker 外部自动控制器，按 `popularity -> homepage -> detail -> list` 每次只增加一个 scope；生产 Worker 不保存 Workers Scripts 写令牌。当前控制器为 ACTIVE 的每小时 heartbeat `eventlist-cache-scope-auto-promotion`。
- [ ] 每次候选晋级前确认代码已提交、临时 probe 不存在、远程 D1 schema 与代码兼容、上一稳定版本 ID 可用且没有另一晋级任务运行。
- [ ] 候选证据必须包含版本/scope、观察窗口、请求/错误、CPU p50/p99、`exceededCpu`、HTTP 状态、`X-Eventlist-Cache`、响应哈希和 D1 投影比较；缺失或不明确即不晋级。
- [ ] CPU p99 >= 10 ms、`exceededCpu > 0`、响应不一致、错误率恶化或部署状态不明确时，自动恢复上一稳定 Worker Version 的 100% 流量并冻结后续晋级。
- [ ] 访问去重继续使用独立开关和独立验收，不随公开 DTO scope 自动开启。

### 2026-07-31 子任务 A 生产只读审计

- 子任务 A 已部署到 100% 版本 `cde5ebf4-5099-46b6-a9d8-a489b36c6f1a`。版本资源包含 `fetch` / `scheduled` handler、D1 与 assets bindings；`acg.hobr.site` 的 tail 样本落在同一版本，真实 hostname 已路由到该 Worker。
- D1 受控采样前 24 小时指标为 `rows_read=2569`、`rows_written=83`、`read_queries=587`、`write_queries=30`。当前读取量约为免费日额度的 0.05%，没有公开 DTO 缓存的容量紧迫性。
- 当前 7 次定向 CPU 样本 p50/p99（ms）：首页 15/63、首页 API 6/7、活动列表 126/193、详情 4/58、标签 API 2/7、sitemap 5/8。所有样本 outcome 为 `ok`，但首页、列表和详情已超过设计 §0.2 的 10 ms 门禁。
- 这不是上线前后对比：部署前同口径指标未留存，正常流量观察周期也尚未完成。不能据此勾选本节前 3 项。
- 子任务 B 保留且只交付默认关闭的 preflight 基础；公开 DTO 路由接入和生产激活延后。当前指标没有达到连续 3 日 `rows_read >= 500,000/日` 的 pilot 门槛，热度标记也必须等待独立的 Worker 请求/统计 POST 证据。
- `acg.hobr.site` 的 Worker 路由已由生产 tail 证明，`wrangler.jsonc` 也已记录 Custom Domain 并关闭 `workers_dev`；仓库仍不存在真实 hostname 的 `cache.put()` / `cache.match()` 探针证据。A25 仍未满足，`PUBLIC_DATA_CACHE_SCOPES` 必须保持缺失或为空，任何公开路由不得调用 Cache API。

### 2026-07-31 `tags,sitemap` 提前 pilot

- 站点负责人考虑网站刚上线且预期访问量会明显增长，明确批准不等待连续 3 个完整 24 小时用量门槛，立即提前 pilot；该例外只适用于 `tags,sitemap`，不扩展到首页、热门、详情、列表或访问去重。
- 真实 hostname 探针返回 HTTP `204`、`X-Eventlist-Cache-Probe: hit` 和 `cf-ray: a23bbadd1ef49e1e-SIN`。探针随后删除，生产路径复查为 `404`。
- 使用隔离目录 `/tmp/eventlist-cache-deploy.BOrWSw` 从 Git index tree `573179d7b4b63ebad74a8e5a75700fac58075b8f` 构建并部署，避免共享工作区内并发的活动详情字段改动进入生产。隔离快照通过 100/100 测试、lint、type-check、build、Wrangler types 和 deploy dry-run。
- 当前 100% 生产版本为 `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9`，deployment 为 `961d4f01-7e2e-4147-b6b2-650e18f110f0`，`PUBLIC_DATA_CACHE_SCOPES="tags,sitemap"`，`workers_dev=false`；SESSION KV、Images、D1、Assets 和 Secrets 均保留。
- 标签验证覆盖 `MISS -> HIT`、部署传播期一次瞬时 `BYPASS`、随后连续 `HIT`，并观察到正常 `STALE-REFRESH -> HIT` 生命周期。查询 `q=漫` 的响应 SHA-256 始终为 `b4127f678fa7b991e394686a711242b800feac165e071a260169b77f99ac252a`。
- sitemap 验证覆盖 `MISS -> HIT` 和后续重复 `HIT`；响应 SHA-256 始终为 `0708d18f950faf9b4e887a97e227212c6063cd9e1705ffe8d822cf157ded8767`。缓存前后正文逐字节一致。
- 路由定向 tail 样本均落在当前版本：标签与 sitemap 各返回 HTTP 200、`outcome=ok`、CPU 8 ms、无日志或异常。当前证据仍是短样本，不替代后续正常流量周期统计。
- 空 scope 回滚版本为 `282528a6-4f0f-4d2f-aa5b-2a4f31f20a03`。发生响应不一致、异常、CPU 超限或错误率上升时，将生产流量回滚到该版本；无需修改或恢复 D1 数据。
- 共享工作区已由并发的 `07-31-event-detail-admission-fields` 把缓存 namespace/schema 提升为 v2/2；其详情字段改动稳定后已删除探针源文件。下一次从共享工作区部署前仍须复核 v1 到 v2 的自然失效、确认探针没有重新出现并重跑全量质量门禁；不得回退并发任务的详情字段改动。

### 2026-07-31 Phase 2.2 失效审查与自动晋级状态

- 新增 bounded write-after-mutation 失效并接入管理员单条创建、批量创建、编辑、审核通过、驳回、下线、重新发布和标签归并；公共 pending 投稿不触发公开缓存失效。Cache API namespace 打开、`delete()` 和 `waitUntil()` 失败均不会改变已提交的 D1 事实或成功 API 响应。
- 地区失效优先展开旧/新省、市、精确地区键。当前 `tags,sitemap,popularity` 的最坏跨地区编辑为 18 个热门祖先键、2 个 top-tags 键和 1 个 sitemap 键，共 21 次 delete，低于 24 次硬上限。全 scope 同类编辑会产生 28 个候选，但前 24 个完整保留 A28 要求的所有旧/新地区首页与热门键；详情、top-tags 和 sitemap 的 4 个固定键在该最坏情况下由 60 秒正常 TTL 兜底。
- 详情页静态 DTO 可用而独立热度查询失败时，页面继续返回可用详情并把热度降级为 0，不再把热度故障误判为 404。
- 聚焦缓存/失效测试 37/37 通过，完整测试 129/129 通过；`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 和 `git diff --check` 全部通过。
- 探针源文件 `src/pages/eventlist-cache-probe-v1.ts` 在工作树和 Git index 中均不存在，构建产物也不包含探针路由；文档与回归测试中保留的探针字符串只是历史证据和缺失断言。
- 生产部署只读复核显示 deployment `dd3ac459-ade0-4523-adc1-66aa3e782c77` 已把稳定 Worker version `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9` 恢复到 100% 流量，稳定 scope 仍为 `tags,sitemap`。此前无说明的 version `0a7612c3-5aaf-4e8f-9187-ea7541cea9af` 不作为后续候选或回滚基线。
- 远程 D1 只读 `pragma_table_info('events')` 实时确认 `organizer`、`schedule_status`、`admission_method`、`price_range`、`admission_start_date` 和 `admission_start_time` 六列全部存在；本次查询 `changes=0`、`rows_written=0`。远程 schema 当前兼容，但自动化每次候选前仍须重新检查，不能复用本次快照。
- 缓存实现与检查证据已提交为 `e6b3e45` 和 `a28c064`，晋级检查开始时工作树干净。`/api/popularity?city=31&trend=7` 连续响应 HTTP 200，两个正文 SHA-256 均为 `14686e102e42cec920088d969feb11bf0f8d001d26400cd7832511a448825ebc`；D1 同口径 7 日查询确认本地和全国候选数均为 0，`rows_written=0`，与响应中的两个空数组一致。
- 本次仍未晋级：候选上传前的 Cloudflare deployment 状态查询连续返回 `522`、`522`、`525`，对应 Ray ID 为 `a23c89fd8fbf5cd5-SIN`、`a23c8adc8fb29e4a-SIN`、`a23c8c7cfcd809c2-SIN`。因此当前 deployment 状态和候选 CPU/error 证据不明确，控制器按 R31 fail closed；没有执行 `wrangler versions upload`、`wrangler versions deploy` 或 rollback，没有创建候选 version，也没有修改生产流量或 D1。
- 自动控制器保持 ACTIVE 并每小时重试。下一次只有在 deployment API 恢复、再次确认唯一稳定版本 100%、远程 schema 兼容且全部候选证据齐全后，才增加 `popularity`；后续 `homepage`、`detail`、`list` 仍逐 scope 独立验收。

### 2026-07-31 20:25 CST 自动晋级重试

- 晋级前工作树干净，`HEAD=a650967`，且包含已审查的缓存实现提交 `e6b3e45` 与检查记录提交 `a28c064`；临时 probe 在源文件、Git index 和现有 `dist` 构建产物中均不存在。
- 远程 D1 只读 `pragma_table_info('events')` 再次确认 `organizer`、`schedule_status`、`admission_method`、`price_range`、`admission_start_date` 和 `admission_start_time` 六列全部存在；查询 `changes=0`、`changed_db=false`、`rows_written=0`，本轮没有修改 D1。
- 第一项控制面门禁 `wrangler deployments status --json` 仍失败，Cloudflare API 返回 HTTP `525`，Ray ID `a23c95f39a5cdaa5-SIN`。因此无法确认当前是否仍为唯一稳定版本 100% 流量、是否存在并行 rollout，以及可用回滚版本；本轮按 fail-closed 停止。
- 未继续运行候选质量/HTTP/CPU 证据采集，未上传或部署候选，未改变 Worker 流量或 scope，未执行 rollback。稳定基线仍只沿用最后一次成功确认的 `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9` / `tags,sitemap` 作为待重新核验事实，不能视为本轮已确认状态。

### 2026-07-31 20:38 CST 自动晋级重试与回滚

- 重试开始时 `wrangler deployments status --json` 恢复成功，但发现一个此前未记录的版本 `f5ebe628-948a-40bd-aefa-b8d4a9c916cb` 于 `2026-07-31T12:35:06Z` 上传并已获得 100% 流量；其来源为 `version_upload`、没有 message，版本详情只显示 `PUBLIC_DATA_CACHE_SCOPES="tags,sitemap"`，没有本任务要求的候选健康证据。因此不能把它视为稳定版本或已审计候选。
- 由于该版本已经实际上线且证据缺失，按失败候选处理，使用已知稳定版本 `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9` 执行 `wrangler versions deploy --version-id ... --percentage 100`。回滚成功，deployment 为 `1ae78701-d097-4da4-9baf-ed521455e3a0`，message 为 `cache: restore verified tags/sitemap stable version after unexplained deployment`。
- 回滚后只读复核确认当前 deployment 只有 `5adefda0-0e8e-4c66-88ef-fcbee8aa28c9` 100% 流量；远程 D1 六个详情字段仍全部存在，`changes=0`、`changed_db=false`、`rows_written=0`。探针仍不在源文件、Git index 或构建产物中。
- 本机 Wrangler 日志 `wrangler-2026-07-31_12-34-46_046.log` 显示 `f5ebe628-948a-40bd-aefa-b8d4a9c916cb` 来自一次交互式 `wrangler deploy`（`sanitizedCommand=deploy`、无参数），不是本控制器的版本上传/晋级命令；该来源已查明，但仍没有可用于公开 scope 晋级的候选健康证据。
- 回滚后的真实 hostname `/api/popularity?city=31&trend=7` 返回 HTTP 200，正文 SHA-256 为 `14686e102e42cec920088d969feb11bf0f8d001d26400cd7832511a448825ebc`（73 bytes），与此前 D1 对照的空数组响应一致；当前 stable scope 不包含 `popularity`，故该请求没有 `X-Eventlist-Cache` 头是预期行为。
- 本轮没有启用 `popularity`，没有上传新的候选，没有修改 scope 或 D1。虽然已查明 `f5ebe628-948a-40bd-aefa-b8d4a9c916cb` 来自交互式部署，后续自动晋级仍保持暂停，须先重新完成全套候选门禁并明确恢复控制器的操作窗口。

## 11. 回滚点

- 查询语义回归：恢复列转换改写；没有迁移。
- 数据库接口回归：保留新模块兼容 re-export，逐个路由恢复旧操作函数；不得恢复每请求 `ensureFK()`，除非新的官方证据证明 D1 行为改变。
- 缓存状态机回归：删除或清空 `PUBLIC_DATA_CACHE_SCOPES`，严格解析器关闭全部 scope，所有 loader 直接回 D1；无需恢复 D1 数据。
- 热度标记回归：关闭 `VIEW_DEDUPE_CACHE_ENABLED`，详情恢复每次输出 POST，POST 直接执行 D1 当日条件 upsert。
- 自定义入口/Cron 回归：将 `wrangler.jsonc.main` 恢复为 `@astrojs/cloudflare/entrypoints/server`；热门查询仍正确，临时使用人工命令做过期清理。
- DTO 回归：恢复页面读取函数，但不得保留缓存中的完整私有记录。
- 写后失效回归：关闭缓存优先，不回滚已成功的 D1 写入。
- 不修改 `0001_init.sql`，除非执行阶段出现必须由 schema 解决且经过重新规划的证据。
