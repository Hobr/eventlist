# Implementation Plan

本清单是子任务 A 的可执行版本，条目从父任务 `implement.md` 的 §1、§2、§3（Cache API 标记除外）、§8、§9 抽取。父任务清单保留为全景视图，执行期只勾选本文件。

## 0. 启动前门禁

- [ ] 用户批准本子任务规划后才运行 `task.py start`。
- [ ] 记录工作区现有改动，避开本任务之外的用户文件；不得覆盖当前 `pnpm-lock.yaml` 改动。
- [ ] 运行 `trellis-before-dev`，加载后端数据库与错误处理规范。
- [ ] 记录 CPU time 基线：Workers Logs 中首页、列表、详情、API 的 CPU p50/p99，与 10 ms 上限对照（父设计 §0.2）。该基线同时是子任务 B 的判断依据。

## 1. 建立基线与查询优化

- [ ] 在新的临时 `--persist-to` 目录应用 `0001_init.sql` 和 `docs/dev/seed-public-site.sql`。
- [ ] 记录首页、热门、列表、详情、标签、sitemap 和访客写入的当前结果与查询计划。
- [ ] 用临时访客键验证首次 upsert、同日重复 upsert 和跨日 upsert 的 `changes()`；记录本地模拟器不提供生产 `rows_written` 明细，生产计费以 D1 meta/Dashboard 为准。
- [ ] 去掉规范日期/时间列外层的 `date()` / `time()` / `datetime()`，保留右侧中国本地时间函数（父设计 §10 对照表）。
- [ ] 更新 `test/homepage-discovery.test.ts` 等 SQL 合同测试，断言直接列比较和原有排序/限制。
- [ ] 新增查询计划验证，确认：
  - 热门窗口使用 `idx_event_visitors_recent`
  - 访客清理使用 `idx_event_visitors_recent`
  - sitemap 使用 `idx_events_status_updated` 且不再额外排序
  - 精确地区查询仍使用 `idx_events_public_division`
- [ ] 对种子数据比较改写前后的完整结果、排序和 3/7/30 日聚合，证明语义一致。

## 2. 收口数据库接口与管理写入

- [ ] 为 D1 binding 建立调用计数基线，区分 binding 调用、batch statements、`rows_read` 和 `rows_written`。
- [ ] `getDB()` 改为只校验并同步返回 `runtimeEnv.DB`，删除运行时 `ensureFK()`；保留迁移中的外键声明，并补 D1 外键约束集成测试。
- [ ] 按 `public-events`、`homepage`、`views`、`tags`、`admin-events`、`submissions` 拆分 `src/lib/db/queries.ts`；迁移期间只允许一个无逻辑 re-export 兼容入口，不引入 ORM 或通用 Repository。
- [ ] 建立显式 `PUBLIC_EVENT_COLUMNS` 与公开 DTO 映射；公开详情在 SQL 中直接限制 `published | offline`，首页、热门和列表不再使用 `events.*`。
- [ ] 确认公开 DTO 为纯可序列化数据（子任务 A 设计 §1），为子任务 B 的 envelope 往返留出接缝。
- [ ] 保留首页发现/热门各自的 batch 和 `/events` 的标签/列表并行读取；用延迟测试证明没有把独立 loader 串行化。
- [ ] 新增 `transitionEventStatus()`：期望旧状态与规范标签资格进入条件 UPDATE，同一 batch 返回当前状态/标签探针；保留 changed/already-target/conflict 与现有 HTTP 状态码。
- [ ] 用临时本地 D1 验证 batch 紧邻 statement 的 `changes()` 行为；只有可靠时才用它门控同批审计，否则 changed 后单独写审计。
- [ ] 标签解析改为 `json_each()` 集合式插入 + `COALESCE(alias_of_id, id)` 归一，删除逐标签 `findOrCreateTagIds()`。
- [ ] 重构编辑操作：一次读取旧状态/地区/标签快照，一个 batch 完成活动更新、标签 upsert、关系差异删除/插入和审计；返回 `MutationImpact`，不在路由提交后回读 D1。
- [ ] 重构标签归并：一次读取源/目标/受影响活动，一个 batch 完成关系变更、别名更新和审计；返回受影响活动 ID。
- [ ] 单条管理员创建的逐标签 statements 收口为集合式插入；保持 `nextEventId` 冲突重试与事件/关系/审计原子 batch。
- [ ] 保持批量创建现有的集合式标签和原子 batch，不因模块拆分增加额外逐条查询或审计调用。

## 3. 访问统计与每日 Cron

- [ ] 重构 `recordEventView()`：删除每次访问的过期清理，保留首次/跨日条件 upsert，在同一 batch 中验证当日访客行是否存在，返回 `changed | already-current | ignored`。
- [ ] `ignored` 必须覆盖无效/已结束活动，供子任务 B 判断"不得写标记"。
- [ ] 新增 `deleteExpiredEventVisitors()`，使用 `last_seen_date < date('now', '+8 hours', '-29 days')` 命中现有索引。
- [ ] 新增 `src/worker.ts`：`fetch` 委托 `@astrojs/cloudflare/handler`，`scheduled()` 执行访客清理（子任务 A 设计 §2）。
- [ ] `wrangler.jsonc` 的 `main` 指向 `./src/worker.ts`，配置 `5 16 * * *`；确认构建产物保留 D1、assets、vars 和 trigger。
- [ ] 为 Cron 失败定义聚合日志与人工维护命令；日志不得输出 IP、访客键或完整 D1 记录。
- [ ] 本子任务不引入 `VIEW_DEDUPE_CACHE_ENABLED` 与任何 Cache API 调用；详情页继续无条件输出统计 POST。

## 4. 自动化测试

- [ ] SQL 合同测试：改写后的语句直接比较规范列，排序、限制、窗口口径不变。
- [ ] 查询计划测试或脚本：四条目标查询命中预期索引。
- [ ] 数据库接口合同测试：`getDB()` 不执行 statement；公开 SQL 不含 `events.*` 或私有列；兼容入口不含业务逻辑。
- [ ] 隐私测试：公开 DTO 不含 `submitter_contact`、`tag_suggestions`、`reject_reason`、审计或访客键。
- [ ] 管理写入调用计数测试：状态变更 ≤ 1-2 次、编辑固定 2 次、标签归并固定 2 次，且不随标签数量增长。
- [ ] 关系差异写入测试：标签不变时不删除重建 `event_tags`；增删各一项时只改对应关系；审计与事实写入同批回滚。
- [ ] 状态机回归测试：changed、already-target、wrong-status、missing-tag、not-found 的响应、审计条数与当前一致。
- [ ] 创建回归测试：单条与批量创建仍原子写入活动、规范标签关系和审计，大小写标签与 alias 继续归一到规范 ID。
- [ ] 热度写入测试：首次和跨日记录、同日 no-op、无效/已结束活动返回 `ignored`；详情访问不再触发清理语句。
- [ ] Cron 测试：只删除 30 日窗口外数据、保留边界日期、直接比较索引列、失败不影响 `fetch` handler。

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

- [ ] `corepack pnpm exec astro dev --background` 启动本地服务。
- [ ] 请求首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags`、sitemap，确认响应合同与改写前一致。
- [ ] 请求 `/cdn-cgi/handler/scheduled?format=json` 测试 Cron，确认过期行被清理、窗口内行保留、普通页面仍由 Astro handler 提供。
- [ ] 通过 D1 result meta 比较标签未变化、单项增删与原有全量重写的 `rows_written`，并单独报告 binding 调用减少。
- [ ] `astro dev logs` 检查没有 Secret、原始 IP 或完整 D1 记录进入日志。
- [ ] 完成后运行 `astro dev stop`。

## 6. 发布与观察

- [ ] 部署后记录 D1 `rows_read` / `rows_written`、Worker 总请求、统计 POST 和错误的前后对比。
- [ ] 记录按路由的 CPU time p50/p99 与 `exceededCpu` 计数，与 §0 基线对比。
- [ ] 观察一个正常流量周期，确认热门榜、首页、列表、详情结果与改写前一致。
- [ ] 把实测 `rows_read` 与 CPU 数据写回父任务，作为子任务 B 是否启动及启用范围的依据。

## 7. 回滚点

- 查询语义回归：恢复列转换改写；没有迁移。
- 数据库接口回归：保留新模块兼容 re-export，逐个路由恢复旧操作函数；不得恢复每请求 `ensureFK()`，除非有新的官方证据证明 D1 行为改变。
- 自定义入口/Cron 回归：`wrangler.jsonc.main` 恢复为 `@astrojs/cloudflare/entrypoints/server`，临时用人工命令清理过期访客。
- DTO 回归：恢复页面读取函数，但不得让公开响应重新包含私有字段。
- 不修改 `0001_init.sql`，除非出现必须由 schema 解决且经过重新规划的证据。
