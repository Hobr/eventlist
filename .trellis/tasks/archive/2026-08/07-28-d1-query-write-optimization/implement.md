# Implementation Plan

本清单是子任务 A 的可执行版本，条目从父任务 `implement.md` 的 §1、§2、§3（Cache API 标记除外）、§8、§9 抽取。父任务清单保留为全景视图，执行期只勾选本文件。

## 0. 启动前门禁

- [x] 用户批准本子任务规划后才运行 `task.py start`。
- [x] 记录工作区现有改动，避开本任务之外的用户文件；未覆盖用户后续提交的依赖更新。
- [x] 运行 `trellis-before-dev`，加载后端数据库与错误处理规范。
- [x] 记录可获得的 Workers Logs 路由 CPU 样本和 10 ms 对照；由于未保留旧实现的同口径生产快照，明确标记为观测数据而非部署前基线，并按父任务 R31/R34 不作为激活或关闭门禁。

## 1. 建立基线与查询优化

- [x] 在新的临时 `--persist-to` 目录应用 `0001_init.sql` 和 `docs/dev/seed-public-site.sql`。
- [x] 记录首页、热门、列表、详情、标签、sitemap 和访客写入的当前结果与查询计划。
- [x] 用临时访客键验证首次 upsert、同日重复 upsert 和跨日 upsert 的 `changes()`；记录本地模拟器不提供生产 `rows_written` 明细，生产计费以 D1 meta/Dashboard 为准。
- [x] 去掉规范日期/时间列外层的 `date()` / `time()` / `datetime()`，保留右侧中国本地时间函数（父设计 §10 对照表）。
- [x] 更新 `test/homepage-discovery.test.ts` 等 SQL 合同测试，断言直接列比较和原有排序/限制。
- [x] 新增查询计划验证，确认：
  - 热门窗口使用 `idx_event_visitors_recent`
  - 访客清理使用 `idx_event_visitors_recent`
  - sitemap 使用 `idx_events_status_updated` 且不再额外排序
  - 精确地区查询仍使用 `idx_events_public_division`
- [x] 对种子数据比较改写前后的完整结果、排序和 3/7/30 日聚合，证明语义一致。

## 2. 收口数据库接口与管理写入

- [x] 为 D1 binding 建立调用计数合同，区分 binding 调用、batch statements、`rows_read` 和 `rows_written`。
- [x] `getDB()` 改为只校验并同步返回 `runtimeEnv.DB`，删除运行时 `ensureFK()`；保留迁移中的外键声明，并补 D1 外键约束集成测试。
- [x] 按 `public-events`、`homepage`、`views`、`tags`、`admin-events`、`submissions` 拆分 `src/lib/db/queries.ts`；迁移期间只允许一个无逻辑 re-export 兼容入口，不引入 ORM 或通用 Repository。
- [x] 建立显式 `PUBLIC_EVENT_COLUMNS` 与公开 DTO 映射；公开详情在 SQL 中直接限制 `published | offline`，首页、热门和列表不再使用 `events.*`。
- [x] 确认公开 DTO 为纯可序列化数据（子任务 A 设计 §1），为子任务 B 的 envelope 往返留出接缝。
- [x] 保留首页发现/热门各自的 batch 和 `/events` 的标签/列表并行读取；用延迟测试证明没有把独立 loader 串行化。
- [x] 新增 `transitionEventStatus()`：期望旧状态与规范标签资格进入条件 UPDATE，同一 batch 返回当前状态/标签探针；保留 changed/already-target/conflict 与现有 HTTP 状态码。
- [x] 用临时本地 D1 验证 batch 紧邻 statement 的 `changes()` 行为；只有可靠时才用它门控同批审计，否则 changed 后单独写审计。
- [x] 标签解析改为 `json_each()` 集合式插入 + `COALESCE(alias_of_id, id)` 归一，删除逐标签 `findOrCreateTagIds()`。
- [x] 重构编辑操作：一次读取旧状态/地区/标签快照，一个 batch 完成活动更新、标签 upsert、关系差异删除/插入和审计；返回 `MutationImpact`，不在路由提交后回读 D1。
- [x] 重构标签归并：一次读取源/目标/受影响活动，一个 batch 完成关系变更、别名更新和审计；返回受影响活动 ID。
- [x] 单条管理员创建的逐标签 statements 收口为集合式插入；保持 `nextEventId` 冲突重试与事件/关系/审计原子 batch。
- [x] 保持批量创建现有的集合式标签和原子 batch，不因模块拆分增加额外逐条查询或审计调用。

## 3. 访问统计与每日 Cron

- [x] 重构 `recordEventView()`：删除每次访问的过期清理，保留首次/跨日条件 upsert，在同一 batch 中验证当日访客行是否存在，返回 `changed | already-current | ignored`。
- [x] `ignored` 必须覆盖无效/已结束活动，供子任务 B 判断"不得写标记"。
- [x] 新增 `deleteExpiredEventVisitors()`，使用 `last_seen_date < date('now', '+8 hours', '-29 days')` 命中现有索引。
- [x] 新增 `src/worker.ts`：`fetch` 委托 `@astrojs/cloudflare/handler`，`scheduled()` 执行访客清理（子任务 A 设计 §2）。
- [x] `wrangler.jsonc` 的 `main` 指向 `./src/worker.ts`，配置 `5 16 * * *`；确认构建产物保留 D1、assets、vars 和 trigger。
- [x] 为 Cron 失败定义聚合日志与人工维护命令；日志不得输出 IP、访客键或完整 D1 记录。
- [x] 本子任务不引入 `VIEW_DEDUPE_CACHE_ENABLED` 与任何 Cache API 调用；详情页继续无条件输出统计 POST。

## 4. 自动化测试

- [x] SQL 合同测试：改写后的语句直接比较规范列，排序、限制、窗口口径不变。
- [x] 查询计划测试或脚本：四条目标查询命中预期索引。
- [x] 数据库接口合同测试：`getDB()` 不执行 statement；公开 SQL 不含 `events.*` 或私有列；兼容入口不含业务逻辑。
- [x] 隐私测试：公开 DTO 不含 `submitter_contact`、`tag_suggestions`、`reject_reason`、审计或访客键。
- [x] 管理写入调用计数测试：状态变更 ≤ 1-2 次、编辑固定 2 次、标签归并固定 2 次，且不随标签数量增长。
- [x] 关系差异写入测试：标签不变时不删除重建 `event_tags`；增删各一项时只改对应关系；审计与事实写入同批回滚。
- [x] 状态机回归测试：changed、already-target、wrong-status、missing-tag、not-found 的响应、审计条数与当前一致。
- [x] 创建回归测试：单条与批量创建仍原子写入活动、规范标签关系和审计，大小写标签与 alias 继续归一到规范 ID。
- [x] 热度写入测试：首次和跨日记录、同日 no-op、无效/已结束活动返回 `ignored`；详情访问不再触发清理语句。
- [x] Cron 测试：只删除 30 日窗口外数据、保留边界日期、直接比较索引列、失败不影响 `fetch` handler。

## 5. 本地集成验证

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

- [x] `corepack pnpm exec astro dev --background` 启动本地服务。
- [x] 请求首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags`、sitemap，确认响应合同与改写前一致。
- [x] 请求 `/cdn-cgi/handler/scheduled?format=json` 测试 Cron，确认过期行被清理、窗口内行保留、普通页面仍由 Astro handler 提供。
- [x] 使用自动化合同分别验证标签未变化、单项增删的关系差异与固定 binding 调用数，并用生产 D1 Insights 记录实际 `rows_written`；旧实现没有同口径生产样本，因此不虚构与原有全量重写的生产前后对比。
- [x] `astro dev logs` 检查没有 Secret、原始 IP 或完整 D1 记录进入日志。
- [x] 完成后运行 `astro dev stop`。

### 2026-07-31 本地验证记录

- `corepack pnpm test`：80 项通过。
- `corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 与 `git diff --check`：全部通过。
- 全新临时 D1 应用 `0001_init.sql` 和开发种子成功；实际热门查询命中 `idx_event_visitors_recent`，清理命中 `idx_event_visitors_recent`，sitemap 命中 `idx_events_status_updated`。
- 首页、首页快照、热门、活动列表、详情、标签和 sitemap 均返回 HTTP 200；本地 scheduled 端点返回 `{"outcome":"ok","noRetry":false}`，清理日志为结构化聚合信息且不含访客数据。
- 尚未完成生产 `rows_read` / `rows_written` 与 CPU p50/p99 基线和上线后对比，因此第 6 节保持未勾选，子任务 B 的生产前置条件仍未满足。
- `corepack pnpm exec astro dev stop` 返回 `No dev server is running.`；后台开发服务已停止。
- Wrangler 4.116.0 的本地 D1 JSON `meta` 仍只包含 `duration`，不包含生产计费口径的 `rows_read` / `rows_written`。因此第 82 行不能用本地模拟器诚实勾选；当前自动化测试证明编辑固定 2 次 binding 调用，并覆盖差异 SQL 与 statement `changes` 合同，但不能替代生产计费行。若要完成该对比，需要经用户明确批准的生产或隔离远程 D1 编辑样本。

## 6. 发布与观察

- [x] 记录当前 24 小时 D1 `rows_read` / `rows_written`、读写 query 数和数据库大小；历史同口径快照不存在，因此只报告当前值与限制，不宣称因果前后对比。
- [x] 记录可获得的按路由 CPU time p50/p99、调用 outcome 和 `exceededCpu` 可见性限制；按父任务 R31/R34 作为观测证据，不作为本次激活或关闭门禁。
- [x] 在生产正常流量和真实活动数据下复核首页、热门榜、列表、详情等公开 surface；没有发现响应合同回归，精确的旧实现生产结果基线不可用。
- [x] 把当前实测 `rows_read` 与 CPU 数据写回父任务，作为子任务 B 是否启动及启用范围的依据。

### 2026-08-01 生产计费与调用证据

- `corepack pnpm exec wrangler d1 info DB --json` 的最新 24 小时快照为：`read_queries=392`、`write_queries=18`、`rows_read=1680`、`rows_written=79`、`database_size=110592` bytes。该数据库创建于 `2026-07-30T15:21:08.954Z`，晚于本子任务查询/写入优化提交；仓库和 Cloudflare 均未保留旧实现的同口径生产快照，因此不存在可诚实补录的精确生产前后对比。
- 自动化调用合同单独证明 binding 和 batch 结构：状态迁移固定 1 次 binding / 3 条 statements；编辑正常路径固定 2 次 binding / 6 条 statements，1 个或 12 个标签均相同；标签归并正常路径固定 2 次 binding / 5 条 statements；单条创建固定 2 次 binding / 4 条 statements；20 条批量创建固定 2 次 binding / 42 条 statements。这些数字证明减少的是往返和随标签增长的调用放大，不直接等价于计费行减少。
- D1 Insights 的实际写入证据：活动编辑 `UPDATE events` 运行 8 次、合计 `rows_written=32`；编辑差异删除 `DELETE event_tags` 运行 6 次、合计 `rows_written=0`；带状态保护的差异插入 `INSERT event_tags ... WHERE EXISTS` 运行 2 次、合计 `rows_written=0`。当前样本中未变化关系没有被删除重写。
- 访问统计 upsert 运行 11 次、合计 `rows_written=18`；每日访客清理运行 1 次、`rows_read=1`、`rows_written=0`。这只描述当前真实流量窗口，不推断旧实现会产生多少计费行。
- 查询优化上线后、六 scope 缓存激活前记录的路由 CPU p50/p99（ms）为：首页 `15/63`、`/api/homepage` `6/7`、活动列表 `126/193`、详情 `4/58`、`/api/tags` `2/7`、sitemap `5/8`。六 scope 缓存激活后，对版本 `5864145e-3824-4ea8-9c80-eded7ec88e0f` 的一次小样本捕获首页 CPU `54, 116, 81, 10, 68 ms` 和 `/api/homepage` `11 ms`，全部 `outcome=ok`。样本量小且流量/缓存状态不同，只能视为噪声较大的观测，不能作为因果前后对比；当前工具没有提供可独立汇总的 `exceededCpu` 计数。

### 2026-08-01 最终质量门禁

- `corepack pnpm test`：`135/135` 通过。
- `corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 和 `git diff --check`：全部通过。
- 最终审查未发现调试日志、类型安全绕过、私有字段泄漏、未覆盖的新行为或规范漂移；数据库与错误处理规范已由提交 `ad371b2` 同步。

### 2026-07-31 生产只读审计

- 当前 100% 部署版本为 `cde5ebf4-5099-46b6-a9d8-a489b36c6f1a`（2026-07-31 07:13:16 UTC）。版本资源显示 `fetch` 与 `scheduled` handler、D1 和 assets bindings；`https://acg.hobr.site` 的定向 tail 样本也全部落到该版本，证明真实 hostname 正在路由到 `eventlist` Worker。
- 受控 GET 检查中，首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags` 和 sitemap 全部返回 HTTP 200；未触发统计 POST、Cron 或管理写入。
- 受控采样前的 D1 24 小时快照：`read_queries=587`、`write_queries=30`、`rows_read=2569`、`rows_written=83`、数据库大小 98304 bytes。`rows_read` 仅为 5,000,000 日额度的约 0.05%；一次短时路由采样后的滚动快照变为 `read_queries=835`、`rows_read=4502`，写指标保持 `30 / 83`。滚动窗口混入并发真实流量，不能冒充上线前后因果对比。
- 7 次定向 tail 的当前 CPU p50/p99（ms）：`/` 15/63、`/api/homepage` 6/7、`/events?city=31` 126/193、`/events/2` 4/58、`/api/tags` 2/7、`/sitemap.xml` 5/8。样本 outcome 均为 `ok`，但首页、活动列表与详情的 p99 已明显超过父设计的 10 ms 门禁。
- 没有可用的上线前同口径 D1/CPU 快照，且当前版本尚未观察完一个正常流量周期，所以本节前 3 项保持未勾选。现有数据已经足以否决立即启动公开 DTO 缓存：D1 使用量很低，而新增 envelope 序列化和后台刷新会增加已经紧张的 CPU。

## 7. 回滚点

- 查询语义回归：恢复列转换改写；没有迁移。
- 数据库接口回归：保留新模块兼容 re-export，逐个路由恢复旧操作函数；不得恢复每请求 `ensureFK()`，除非有新的官方证据证明 D1 行为改变。
- 自定义入口/Cron 回归：`wrangler.jsonc.main` 恢复为 `@astrojs/cloudflare/entrypoints/server`，临时用人工命令清理过期访客。
- DTO 回归：恢复页面读取函数，但不得让公开响应重新包含私有字段。
- 不修改 `0001_init.sql`，除非出现必须由 schema 解决且经过重新规划的证据。
