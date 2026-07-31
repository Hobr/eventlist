# 技术设计

## 1. 边界与现状

本任务横跨 D1 schema、公开投稿、管理员新增/编辑、CSV 批量导入、公共详情查询、时间/状态格式化和活动详情页。它保持一个集成任务，因为任何单层交付都不能独立产生可用功能。

远程 `eventlist-db` 已于 2026-07-30 应用旧版 `0001_init.sql` 且包含开发数据。用户确认网站仍处于开发阶段并允许数据库重构，因此继续遵循 `.trellis/spec/backend/database-guidelines.md` 的单基线合同：直接更新 `0001_init.sql`，不新增增量迁移。远程库若要使用新 schema，后续必须显式重建；本任务不会自动执行该破坏性操作。

当前工作区另有未提交的公开 DTO 缓存实现。新增的静态活动字段可以进入 `PublicEventDetail`，但动态热度不能被详情缓存长期冻结。

## 2. 数据模型

更新 `migrations/0001_init.sql`，在 `events` 中直接定义六个 nullable 列：

| 列 | 合同 |
| --- | --- |
| `organizer` | `TEXT NULL`；trim 后 1-200 字符，可表达多个主办方 |
| `schedule_status` | `TEXT NULL`；仅允许 `postponed / cancelled`，`NULL` 表示正常 |
| `admission_method` | `TEXT NULL`；代码仅允许 `ticket / reservation / walk_in / invitation / other` |
| `price_range` | `TEXT NULL`；trim 后 1-120 字符 |
| `admission_start_date` | `TEXT NULL`；规范 `YYYY-MM-DD` |
| `admission_start_time` | `TEXT NULL`；规范 `HH:MM`，且只能在日期存在时填写 |

新建活动允许六列为 `NULL`；不读取或迁移旧库行。`src/lib/events/options.ts` 是入场方式与异常状态代码、中文标签、类型守卫和标签函数的唯一应用层来源；SQL `CHECK` 与该目录保持同一代码集合。

本地验证始终使用全新持久化目录应用更新后的唯一基线。远程开发库切换时直接删除并重建同名 D1、应用新 `0001`、重新生成所需开发样例，最后部署代码；不导出或重导旧开发数据。该远程重建不属于本任务自动执行范围。应用回滚需要同时恢复旧基线并重建开发库，不能假设旧代码可读取重构后的 schema。

## 3. 写入链路

`EventBaseInput` 增加六个 nullable 字段，统一贯穿三条入口：

1. 公开投稿：`submit.astro -> parseSubmissionForm() -> insertSubmission()`。
2. 管理员新增/编辑：`AdminEventForm -> parseEventForm() -> createPublishedEvent()/editEvent()`。
3. 批量导入：CSV -> `validateAdminEventInput() -> createBulkPublishedEvents()`。

校验规则：

- 入场方式和异常状态只能取共享目录中的稳定代码；正常状态归一化为 `NULL`。
- `organizer` trim 后为空转 `NULL`，最大 200 字符。
- `price_range` trim 后为空转 `NULL`，最大 120 字符。
- 入场开始日期使用现有规范日期校验；时间复用 `normalizeOptionalTime()`。
- 仅填写时间而没有日期时返回字段级 400/CSV 记录错误。
- 所有 INSERT/UPDATE 及批量语句显式绑定新列，不依赖列默认顺序。

新版 CSV 增加“主办方、活动异常状态、入场方式、票价区间、开始购票/预约/申请日期、开始购票/预约/申请时间”；异常状态和入场方式接受稳定代码或中文标签。生成模板和解析器只支持新版固定表头，并继续要求精确顺序和列数；旧版 17 列 CSV 返回表头错误。

## 4. 读取与动态数据

`PublicEventDetail` 和显式公共列投影增加六个静态字段。列表卡片 DTO 不增加这些字段。

近 30 日热度由 `src/lib/db/views.ts` 的独立聚合查询返回一个非负整数：

- 条件为 `last_seen_date BETWEEN date('now', '+8 hours', '-29 days') AND date('now', '+8 hours')`。
- 查询仅对 `published/offline` 活动返回计数，不返回或序列化 `visitor_key`。
- 详情页并行读取活动详情和热度；热度为 0 仍渲染。
- 当前页面的异步 view beacon 可能在下一次加载才反映到数字中，这是允许的最终一致行为。

热度不进入 `PublicEventDetail` 和 `PublicDataCachePayloads["event-detail"]`，避免后续详情缓存将动态计数冻结。若实现时缓存分支已变化，必须保持“静态详情可缓存、热度直接聚合”的边界；静态 DTO shape 变更直接提升缓存 schema/namespace 并更新严格 validator，不解析旧 envelope。

## 5. 展示规则

### 5.1 链接去重

`getEventDetailOptionalContent()` 分别保留 `ticketUrl` 与 `sourceUrl`：

- 对 trim 后的两个 http(s) URL 通过 `new URL(value).toString()` 做规范化比较。
- 规范化结果一致时只返回购票入口。
- 不一致时返回两个入口，页面用两个独立条件渲染，不再使用 ternary 二选一。
- 查询参数、路径或 fragment 不同均视为不同链接，不主动移除追踪参数。

JSON-LD 继续只把购票地址放入 `offers`，不把来源链接伪装成 organizer 或 offer。

### 5.2 状态和时间

新增纯函数按北京时间计算用户状态并接受可注入的 `now` 以便测试：

- `offline` 始终为“已下线”。
- `schedule_status = cancelled` 为“已取消”。
- `schedule_status = postponed` 为“已延期”。
- 开始日期尚未来到，或开始日的已知开始时间尚未来到：`未开始`。
- 结束日期已过去，或结束日的已知结束时间已到：`已结束`。
- 其他已发布活动：`进行中`；日期型活动在整个结束日保持进行中。

`updated_at` 是 SQLite UTC `YYYY-MM-DD HH:MM:SS`，按北京时间格式化为清晰中文日期时间。入场开始日期按本地日期显示；可选时间存在时追加到分钟。

### 5.3 页面结构

- 在现有详情事实区域增加稳定的信息行/区块，显示用户状态、最后更新时间、近 30 日热度。
- 在现有参加活动侧栏或活动信息区显示可选的主办方、入场方式、票价区间、开始购票/预约/申请时间。
- 六个新数据库字段分别 trim/规范化；值缺失时不渲染其 `<dt>/<dd>`，全部缺失时不产生空容器。
- 异常状态通过主状态位置显示；具体说明继续渲染现有活动描述，不增加公告容器或字段。
- `organizer` 存在时，JSON-LD 增加 `Organization` 的 `organizer.name`；不存在时省略整个 organizer。
- 保留已下线历史提示、可访问性语义、移动端换行和现有视觉 token。

## 6. 重建边界与缓存

- 仓库只保留更新后的 `0001`；本地空库只记录一条迁移。
- 数据库文件、现有开发数据、旧 CSV、旧 DTO 和旧缓存均不兼容、不迁移。
- 待审核/拒绝访问控制、活动描述公告方式及匿名热度隐私边界属于当前产品规则，重构后继续成立。
- 当前工作区的缓存代码属于用户已有改动；实现前重新读取并合并，不覆盖或回退。
- 如果缓存 schema 已经可写入 `event-detail`，静态 DTO shape 变更必须提升 schema/namespace 并拒绝旧 envelope；动态热度始终不缓存。

## 7. 风险与回滚

- 最大部署风险是把读取新列的代码部署到仍记录旧 `0001` 的远程库；通过显式重建门禁规避。
- CSV 新字段会改变模板；旧文件按约定不兼容，解析时明确报表头错误。
- 状态边界容易出现北京时间和无时间值错误；使用可注入时钟覆盖开始/结束日边界。
- 热度聚合增加一次详情读取；保持 `idx_event_visitors_recent` 可用并用查询计划/真实 SQLite 测试确认。
- 远程重建是破坏性操作，必须在用户另行明确授权后执行；按本任务约定不导出旧开发数据，本任务只提供重建命令和核验清单。
