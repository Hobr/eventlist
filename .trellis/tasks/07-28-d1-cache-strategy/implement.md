# Implementation Plan

## 0. 启动前门禁

- [ ] 用户明确批准本次最终规划摘要后，才运行 `task.py start`。
- [ ] 记录工作区现有改动，保留并避开本任务之外的用户文件；不得覆盖当前 `pnpm-lock.yaml` 改动。
- [ ] 运行 `trellis-before-dev`，重新加载后端数据库、错误处理和相关前端规范。
- [ ] 记录部署前的 CPU time 基线：从 Workers Logs 按路由取首页、列表、详情、API 的 CPU p50/p99，与 10 ms 上限对照（design §0.2）。

### 0.1 缓存层前置条件（子任务 B 的阻断项）

- [ ] Worker 绑定自定义域名 `acg.hobr.site`（Workers 路由或 Custom Domain），`wrangler.jsonc` 记录该配置。
- [ ] 在 `https://acg.hobr.site` 上部署临时探针路由：合成 GET 先 `cache.put()` 再 `cache.match()`，把命中/未命中写入响应头。
- [ ] 记录探针输出作为证据（A25）。本地 `astro dev` 的 Miniflare 结果不能替代该验证。
- [ ] 探针未通过前，`PUBLIC_DATA_CACHE_SCOPES` 保持为空，子任务 B 不进入实现。

### 0.2 分工

- **子任务 A `07-28-d1-query-write-optimization`（不依赖 Cache API，先做）**：第 1、2 节，以及第 3 节中除 Cache API 标记以外的部分（`recordEventView` 收口、`deleteExpiredEventVisitors`、`src/worker.ts` 自定义入口与 Cron）。第 8 节中对应的测试同批完成。
- **子任务 B `07-28-public-dto-cache-layer`（依赖 §0.1 通过）**：第 3 节的当日成功标记、第 4-7 节、以及第 8 节中缓存相关测试。
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

- [ ] 为活动列表和详情新增逐字段公开投影，禁止对象展开和完整 `EventRecord` 序列化。
- [ ] 新增 `src/lib/cache/public-data.ts`，实现：
  - 命名 Cache API namespace
  - 版本化、规范化合成键
  - `CachedEnvelope<T>` 解析和损坏条目降级
  - 新鲜/正常陈旧/故障陈旧状态机
  - 稳定抖动
  - `waitUntil()` 后台刷新
  - isolate 内 Promise 合并和 `finally` 清理
  - Cache API 读写异常不影响 D1 成功结果
- [ ] 新增 `PUBLIC_DATA_CACHE_SCOPES` 解析；缺失、空值或未知 scope 默认绕过缓存。
- [ ] 为 loader 返回统一的 `cacheState`，供 API 头、SSR 提示和采样日志使用。

## 5. 集成低基数高收益读取

- [ ] 首页 SSR、`/api/homepage` 和 `/api/popularity` 复用相同的发现/热门缓存函数。
- [ ] 保证首页仍先解析查询参数/IP/default 地区，再建立缓存键。
- [ ] 为 top tags、1-24 字标签联想、详情和 sitemap 接入缓存。
- [ ] 不缓存详情负结果；pending/rejected 继续立即 404，offline 继续显示历史提示。
- [ ] 成功 JSON GET 增加短 `private, max-age=15`；错误响应 `no-store`。
- [ ] JSON/sitemap 增加 `X-Eventlist-Cache`；故障陈旧增加对应 `Server-Timing` 标记。
- [ ] SSR 故障陈旧只显示克制提示，不改变正常页面布局或加载交互。

## 6. 集成写后失效

- [ ] 新增 best-effort 失效 helper；所有 delete promise 使用 `waitUntil()` 并吞掉缓存错误。
- [ ] 公共投稿不触发公开失效。
- [ ] 管理员创建/批量创建失效已知地区首页/热门、top tags 和 sitemap。
- [ ] 编辑直接使用数据库业务操作返回的 `MutationImpact`，失效详情、两侧地区首页/热门、top tags 和 sitemap；不得提交后再次读取旧地区或状态。
- [ ] 审核通过、下线和重新发布使用状态操作返回的活动/地区/状态影响，失效详情、地区聚合和 sitemap。
- [ ] 标签归并使用操作返回的受影响活动 ID 失效 top tags 和可识别详情；无法枚举的搜索/列表键由 60 秒上限保证。
- [ ] 失效只在 D1 和审计成功后执行；失效失败不得改变 API 成功响应。

## 7. 集成受控活动列表缓存

- [ ] 从解析后的 `PublishedEventFilters` 生成固定顺序键，写入实际默认 timing/sort/pageSize。
- [ ] 仅准入第 1-3 页和合理长度字段；其他请求透明绕过缓存。
- [ ] 页面改用 `PublicEventPage`，保持现有卡片、分页、筛选和空状态。
- [ ] 不为了删除所有列表键引入 KV epoch、Cache API 枚举或额外 D1 版本查询。

## 8. 自动化测试

- [ ] 新增缓存核心单元测试：fresh hit、miss、后台刷新、60 秒阻塞边界、stale-if-error、过硬期限、损坏条目、Cache API 失败。
- [ ] 新增并发测试：同键一次 loader、不同键独立、失败后 in-flight Map 清理。
- [ ] 新增键隔离测试：地区、窗口、活动 ID、筛选、分页、排序和标签不得碰撞；参数顺序不产生重复键。
- [ ] 新增隐私测试：所有缓存 DTO 均不含投稿联系、建议标签、驳回原因、审计或访客键。
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
- [ ] 新增写后失效测试，证明 D1 成功不因 delete 失败变成错误。
- [ ] 新增地区前缀失效测试：修改 `110101` 的活动会失效 `11`、`1101`、`110101` 三级的发现键与 3/7/30 三个热门窗口键，旧/新地区双侧覆盖，直辖市重复码去重后不产生冗余 delete。
- [ ] 新增调用预算测试：单次公开读取的 Cache API + D1 调用合计 ≤ 10，单次写后失效的 `delete()` ≤ 24，且都不随标签数、活动数或地区层级增长。

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

- [ ] 先以空 `PUBLIC_DATA_CACHE_SCOPES` 且关闭 `VIEW_DEDUPE_CACHE_ENABLED` 部署数据库接口收口、查询优化、自定义入口、Cron 和缓存代码。
- [ ] 记录部署前 D1 `rows_read` / `rows_written`、Worker 总请求、统计 POST 和错误基线；确认 D1 Free 写入行包含索引成本。
- [ ] 记录部署前后按路由的 CPU time p50/p99 与 `exceededCpu` 调用数；任一公开路由 p99 逼近 10 ms 时暂停后续 scope 启用（design §0.2）。
- [ ] 确认 §0.1 探针已在生产 hostname 通过，再进入下面任何 scope 启用步骤。
- [ ] 先启用热度标记，比较统计 POST、标记命中率、D1 热度操作和 `rows_written`；确认热门榜仍在 60 秒内反映新访客。
- [ ] 再启用 `homepage,popularity,tags,sitemap`，观察至少一个正常流量周期。
- [ ] 下一轮启用 `detail`。
- [ ] 只有列表重复请求能提供有意义命中率时才启用 `list`。
- [ ] 命中率低、错误上升或地区/状态错误时立即清空 scope；不需要数据库回滚。

## 11. 回滚点

- 查询语义回归：恢复列转换改写；没有迁移。
- 数据库接口回归：保留新模块兼容 re-export，逐个路由恢复旧操作函数；不得恢复每请求 `ensureFK()`，除非新的官方证据证明 D1 行为改变。
- 缓存状态机回归：清空 `PUBLIC_DATA_CACHE_SCOPES`，所有 loader 直接回 D1。
- 热度标记回归：关闭 `VIEW_DEDUPE_CACHE_ENABLED`，详情恢复每次输出 POST，POST 直接执行 D1 当日条件 upsert。
- 自定义入口/Cron 回归：将 `wrangler.jsonc.main` 恢复为 `@astrojs/cloudflare/entrypoints/server`；热门查询仍正确，临时使用人工命令做过期清理。
- DTO 回归：恢复页面读取函数，但不得保留缓存中的完整私有记录。
- 写后失效回归：关闭缓存优先，不回滚已成功的 D1 写入。
- 不修改 `0001_init.sql`，除非执行阶段出现必须由 schema 解决且经过重新规划的证据。
