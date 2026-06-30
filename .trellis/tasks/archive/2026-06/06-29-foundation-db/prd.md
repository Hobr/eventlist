# D1 schema与维表种子(foundation-db)

> 父任务:`06-29-acg-event-site`。本子任务为公共站与后台的契约源头,必须先完成。

## Goal

建立 Cloudflare D1 数据库、绑定、迁移机制,并落定全部表结构与维表种子数据,使 `public-site` 与 `admin-review` 子任务可直接基于此 schema 读写。

## Background

- 仓库已有 `wrangler.jsonc`;远端 D1 `eventlist-db` 已存在,本任务复用其 `database_id` 并补齐绑定与基础迁移。
- `admin-review` 已先行新增 `src/lib/db/*` 与 `migrations/0003_audit.sql`;本任务需在现有文件上合并,补 `0001_init.sql` 与 `0002_seed.sql`,不重写后台业务查询。
- 父 PRD 决策:D-Storage(D1)、D-Cities(城市维表)、D-Taxonomy(type/scale 固定枚举 + 维表可扩展)、D-Tags(tags 关系表 + 维表 + 归并)、D-Storage-Shape(枚举字符串 + tags 关系行)。
- 状态机:`pending`(待审核)→ `published`(已发布) / `rejected`(已驳回);`published` 可转 `offline`(下线)。

## Requirements

### R1 数据库与绑定

- R1.1 复用/创建 D1 数据库 `eventlist-db`,在 `wrangler.jsonc` 添加 `d1_databases` 绑定 `DB`,`generate-types` 可产出类型。
- R1.2 采用 `wrangler d1 migrations` 机制,迁移文件置于 `migrations/` 目录,可重复执行(`wrangler d1 migrations apply`)。

### R2 表结构

- R2.1 `cities(id PK, name, province, sort, created_at)` — 城市维表。
- R2.2 `event_types(name PK, label, sort, created_at)` — 活动类型维表(可扩展)。
- R2.3 `event_scales(name PK, label, sort, created_at)` — 规模维表(可扩展)。
- R2.4 `tags(id PK, name UNIQUE, alias_of_id NULLABLE FK→tags.id, created_at)` — 标签维表,`alias_of_id` 用于管理员归并同义标签。
- R2.5 `events(id PK, title, type, scale, city_id FK→cities.id, venue, address, start_date, end_date, cover_url, description, qq_group, ticket_url, source_url, submitter_contact, status, reject_reason, created_at, updated_at, published_at)` — 活动主表;`type`/`scale` 存枚举字符串(值须存在于维表);`status ∈ {pending,published,rejected,offline}`。
- R2.6 `event_tags(event_id FK→events.id, tag_id FK→tags.id, PRIMARY KEY(event_id,tag_id))` — 活动-标签关系。
- R2.7 关键索引:`events(status, start_date)`、`events(city_id, end_date)`、`events(status, city_id, start_date)`、`tags(name)`、`event_tags(tag_id)`。

### R3 种子数据

- R3.1 `event_types` 种子:漫展 / 同人展 / 演唱会 / 舞台剧·2.5次元 / 舞见·宅舞 / IP主题快闪 / 线上活动 / 其它(带 `label` 与 `sort`)。
- R3.2 `event_scales` 种子:小型(地区级) / 中型(省级) / 大型(全国级) / 超大型(国际级)。
- R3.3 `cities` 种子:覆盖 ACG 活跃的主要省辖市/地级市(初版 ≥ 50 条,含直辖市与省会及重点城市,带 `province` 与 `sort`)。
- R3.4 `tags` 种子:空(由投稿自动写入,不预置)。

### R4 可被引用

- R4.1 提供一个共享的查询辅助模块(如 `src/lib/db.ts` 或 `src/lib/db/`),封装 D1 绑定访问与基础查询,供其它子任务复用。
- R4.2 文档化 schema(本任务 `design.md` 即为权威契约),并在 `.trellis/spec/backend/` 落一份 DB 规约。

## Acceptance Criteria

- [ ] `wrangler d1 migrations apply` 成功,所有表与索引存在。
- [ ] 种子数据写入,`event_types` 8 条、`event_scales` 4 条、`cities` ≥ 50 条、`tags` 0 条。
- [ ] `wrangler types` 生成的类型包含 `DB` 绑定,`src/lib/db` 可在 Astro server 端正常访问 D1。
- [ ] 状态机枚举值在迁移 SQL 中以 CHECK 约束固化(`status` 仅允许四个值)。
- [ ] `design.md` 中的 schema 与迁移 SQL 完全一致(权威契约)。
- [ ] `.trellis/spec/backend/` 落地 DB 规约文档。

## Out of Scope

- 前台 UI、后台 UI(属其它子任务)。
- 投稿/审核业务逻辑(属其它子任务,本任务只提供 schema 与访问层)。
- GPS 坐标字段(父 PRD 已排除)。
- 用户账号表(父 PRD 已排除)。

## Open Questions

- 无阻塞性问题。
