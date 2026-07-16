# 技术设计：品牌、地区、标签与自动夜间模式

## 1. 范围与边界

本任务以一个集成改动完成，不拆分子任务。六项需求共享公共布局、表单、活动查询和后台审核链路，分开实施会产生临时不一致状态：例如投稿改成自由文本后，发布门禁和后台规范标签编辑必须同时上线。

本次不扩充香港、澳门、台湾的详细行政区划；保留 `src/lib/divisions.ts` 中现有占位数据。

## 2. 品牌统一

### 2.1 公共站点

- `src/layouts/Layout.astro` 删除字母 `E` Logo 节点及装饰块。
- 定义并复用站点名“野活网”，更新默认标题、组合标题、页眉和页脚。
- 保留副标题“ACG 活动日历”、主导航结构、favicon 和现有路由。

### 2.2 后台与登录

- `src/layouts/AdminLayout.astro` 和 `src/pages/admin/login.astro` 更新可见品牌、页面标题和描述。
- `docs/dev/seed-public-site.sql` 中的 `Eventlist Dev` 是开发样例活动名称，不作为界面品牌文案处理，避免无关数据迁移。

## 3. 地区选择

### 3.1 直辖市树形归一化

`cn-division` 将北京、天津、上海表示为单一市级节点，但重庆拆成“重庆市”和“县”两个节点。若只自动选第一个节点，重庆部分县会消失。

在 `src/lib/divisions.ts` 构造 `DivisionTree` 时使用依赖已导出的 `MUNICIPALITY_CODES`：

- 普通省份保持现有城市数组。
- 四个直辖市生成一个用于选择器的市级节点，名称等于省级名称。
- 该节点合并原始全部市级节点下的区/县。
- 虚拟市级节点使用省级前缀代码，筛选时仍通过现有 `division_code LIKE '<province>%` 契约覆盖整个直辖市。
- 末级区/县继续保存原始六位代码；详情展示和投稿校验不变。

### 3.2 自动选择与状态清理

`DivisionPicker.svelte` 在省份改变后：

- 始终清空旧区/县。
- 若新省份是归一化后的直辖市，自动选择唯一市级节点。
- 普通省份保持市级未选择。
- 清空省份时同步清空市和区/县，并触发一次 `onchange`。

### 3.3 文案

三级控件统一使用简短标签“省”“市”“区/县”，占位和“全部”选项统一使用“区/县”写法。外层分组标签仍显示“浏览地区”或“地区”，因此可访问上下文不会丢失。

## 4. 标签数据模型与审核流

### 4.1 数据模型

网站尚未部署，因此不保留增量 migration 链。`migrations/0001_init.sql` 直接包含最终 schema、审计表、索引和类型/规模种子。

字段含义：投稿者提供的非规范自由文本，仅供管理员审核参考；不得参与公共标签展示或筛选。

`start_time` / `end_time` 保存活动所在地的本地 24 小时时间 `HH:MM`。两列均可为空，并通过 migration CHECK 与应用层解析拒绝无效时间。

现有 `tags` 和 `event_tags` 继续作为唯一规范标签真相源。旧数据无需回填：历史活动已有 `event_tags`，历史记录的 `tag_suggestions` 可为空。

### 4.2 类型与表单契约

- `SubmissionInput` 不再等同于 `AdminEventInput`。
- `SubmissionInput` 使用 `tag_suggestions: string | null`，不携带 `tags`。
- 公共投稿表单将标签 chips/自动补全替换为普通自由文本输入或 textarea，字段名为 `tag_suggestions`。
- 投稿解析限制自由文本长度，兼容读取旧字段 `tags` 作为回退，避免旧页面短暂缓存导致请求失败。
- `insertSubmission()` 只写 `events.tag_suggestions`，不调用 `findOrCreateTagIds()`，因此投稿不会创建规范标签。

### 4.3 后台整理

- `EVENT_SELECT` 返回 `tag_suggestions`，待审核列表明确显示“投稿标签建议”。
- 待审核活动增加“编辑/整理”入口。
- 编辑页显示只读投稿建议，并用 `TagInput.svelte` 管理规范标签。
- 编辑页服务端加载全部 canonical tags 并传给 `TagInput`，输入已有名称时复用标签，输入新名称时由现有 `findOrCreateTag()` 创建 canonical tag。
- 保存待审核活动允许暂时没有规范标签；保存已发布或已下线活动时至少需要一个规范标签，避免正式活动被编辑成零标签。

### 4.4 发布门禁

新增共享查询 `hasCanonicalEventTag(db, eventId)`，只统计 `alias_of_id IS NULL` 的关联标签。

- `/approve`：零规范标签返回 409 和中文提示，不改变状态、不写 audit。
- `/republish`：应用相同门禁。
- 前端根据 `event.tags` 提供即时禁用和提示，但服务端门禁是最终保证。

### 4.5 筛选语义

`listPublishedEvents()` 的标签条件从 `LIKE '%query%'` 改为规范标签名精确相等。`searchTags()` 仍保留模糊搜索，用于给用户寻找可选标签；选择或提交到活动列表的 `tag` 查询参数代表一个完整规范标签。

## 5. 自动夜间模式

项目已有完整浅色/深色 token 和 `prefers-color-scheme: dark`，本任务不增加 `.dark` class、按钮或 localStorage。

- 在公共布局、后台布局和独立登录页补充 `<meta name="color-scheme" content="light dark">`，让原生表单和浏览器控件明确跟随系统模式。
- 审计新增/修改组件只使用语义 Tailwind tokens。
- `EventCard.astro` 的封面图白字与黑色遮罩属于媒体对比层，不随主题切换，保留现状。
- 通过浏览器分别模拟浅色与深色系统模式，检查公共首页、活动列表、投稿页、后台登录和可访问后台页面。

## 6. 可选开始与结束时间

### 6.1 数据契约

- `EventRecord`、`AdminEventInput` 和 `SubmissionInput` 增加 `start_time: string | null`、`end_time: string | null`。
- 开始、结束日期继续必填；两个时间字段可以独立为空。
- 时间采用活动当地的 `HH:MM` 壁钟时间，不在数据库或表单层进行 UTC 换算。
- 同日且两个时间都存在时验证 `end_time >= start_time`；跨日活动不比较纯时间值。

### 6.2 共享时间工具

新增 `src/lib/events/datetime.ts`，集中负责：

- 规范化与校验可选 `HH:MM`，供公共投稿和后台编辑共同调用。
- 校验日期与时间组合顺序，避免两套表单规则漂移。
- 生成统一的公开/后台日期时间文案。
- 为 JSON-LD 组合 ISO 8601 日期时间；有时间时使用 `YYYY-MM-DDTHH:MM:00+08:00`，无时间时保留 `YYYY-MM-DD`。

### 6.3 表单与展示

- 投稿页和后台编辑页在开始/结束日期旁增加 `type="time"`，均不设置 `required`。
- `insertSubmission()` 和 `editEvent()` 持久化两个字段。
- `EventCard.astro`、活动详情、后台活动表统一使用共享格式化函数。
- 单日两端都有时间：`2026-07-16 10:00–18:00`。
- 只有开始时间：`2026-07-16 10:00 开始`；只有结束时间：`2026-07-16 18:00 结束`。
- 跨日活动在各自日期旁展示已知时间；未知端不补默认值。
- 活动列表筛选、过期判断和默认排序仍只使用日期，保持现有行为与 URL 契约。

## 7. 数据库基线重建

- 仅保留 `0001_init.sql`，删除原 `0002_seed.sql`、`0003_audit.sql` 和 `0004_event_metadata.sql`。
- 建表顺序为维度表、标签、活动、活动标签关系、审计日志；最后创建索引并写入类型/规模种子。
- 所有表使用 SQLite `STRICT`，让 D1 在数据库边界拒绝错误存储类型。
- `tags.name` 使用 `COLLATE NOCASE UNIQUE`，并限制为 trim 后的 1–24 字符；禁止标签自指 alias。
- `events` 直接包含 `tag_suggestions`、`start_time`、`end_time`，并约束日期规范、时间格式、日期顺序、状态集合和建议文本最大长度。
- 索引围绕真实查询建立：公开未结束活动、地区前缀、后台状态队列、sitemap 更新时间、标签反向关联和审计时间/动作。
- 地区仍由 `division_code` 保存和解析；不创建代码未读取的 `cities` 表。
- 使用独立临时 `--persist-to` 目录从空库应用 migration，避免旧本地 migration 记录掩盖问题。

## 8. 兼容性与回滚

- 站点未部署，无生产数据迁移或 down migration 负担；部署目标必须从空数据库应用新的单文件基线。
- 若 schema 设计需要回滚，直接修改 `0001_init.sql` 并重新创建未部署数据库。
- 旧待审核活动已有关联规范标签的继续正常审核；没有建议文本不影响后台编辑。
- 品牌和选择器改动不改变路由、查询参数名或活动末级行政代码。
- 历史活动的时间列为空，页面继续显示原日期文案；无需数据回填。

## 9. 风险控制

- 重庆区/县遗漏：通过合并所有原始市级节点的 counties 避免。
- 投稿污染标签库：通过类型拆分与 `insertSubmission()` 去除标签创建路径避免。
- 仅前端阻止零标签发布：审批和重新发布 API 必须独立查询并拒绝。
- 已发布活动被编辑成零标签：`editEvent()` 根据当前状态拒绝。
- 标签筛选误命中：公开筛选改为精确 canonical name。
- 深色模式局部失效：检查硬编码颜色；仅允许媒体遮罩等与主题无关的颜色。
- 公共与后台时间校验不一致：使用共享解析/校验函数。
- 单端时间被错误补全：数据与展示均保留 `null`，不推断未知时间。
- JSON-LD 时间语义错误：仅在明确有时间时组合本地 `+08:00` ISO 字符串。
- 合并 migration 后旧本地状态误报成功：必须在独立空持久化目录执行并查询 schema/种子/约束。
