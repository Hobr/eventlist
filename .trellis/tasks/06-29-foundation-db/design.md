# Design: D1 schema与维表种子(foundation-db)

> 本文件是全站数据库的权威契约。`public-site` 与 `admin-review` 子任务以此为准。

## 架构与边界

```
Astro(SSR, Cloudflare Worker)
  └── runtime.env.DB  (D1 binding, name: DB)
        └── src/lib/db/*  (共享访问层:连接、查询辅助、枚举常量)
migrations/
  0001_init.sql        (表 + 索引 + CHECK)
  0002_seed.sql        (维表种子数据)
```

- 本任务只产出 **schema + 迁移 + 种子 + 访问层骨架**,不含业务读写实现(业务查询由各子任务在 `src/lib/db/` 之上扩展)。
- 访问层 `src/lib/db/index.ts` 导出:`getDB(runtime)` 取绑定、`TYPES`/`SCALES`/`STATUS` 枚举常量对象、基础 `findAll`/`findOne` 占位。子任务按需追加查询函数。

## D1 绑定(wrangler.jsonc 追加)

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "eventlist-db", "database_id": "<创建后填入>", "migrations_dir": "migrations" }
]
```

创建命令:`wrangler d1 create eventlist-db`(记录 `database_id`)。

## 表结构(权威)

### cities

| 列         | 类型    | 约束                               |
| ---------- | ------- | ---------------------------------- |
| id         | INTEGER | PK AUTOINCREMENT                   |
| name       | TEXT    | NOT NULL UNIQUE                    |
| province   | TEXT    | NOT NULL                           |
| sort       | INTEGER | NOT NULL DEFAULT 0                 |
| created_at | TEXT    | NOT NULL DEFAULT (datetime('now')) |

### event_types

| 列         | 类型    | 约束                               |
| ---------- | ------- | ---------------------------------- |
| name       | TEXT    | PK(枚举键,英文/拼音短键)           |
| label      | TEXT    | NOT NULL(中文展示名)               |
| sort       | INTEGER | NOT NULL DEFAULT 0                 |
| created_at | TEXT    | NOT NULL DEFAULT (datetime('now')) |

> `name` 为机器键(如 `comic`、`doujin`),`events.type` 存此键;`label` 为中文展示。

### event_scales

| 列         | 类型    | 约束                               |
| ---------- | ------- | ---------------------------------- |
| name       | TEXT    | PK                                 |
| label      | TEXT    | NOT NULL                           |
| sort       | INTEGER | NOT NULL DEFAULT 0                 |
| created_at | TEXT    | NOT NULL DEFAULT (datetime('now')) |

### tags

| 列          | 类型    | 约束                                |
| ----------- | ------- | ----------------------------------- |
| id          | INTEGER | PK AUTOINCREMENT                    |
| name        | TEXT    | NOT NULL UNIQUE                     |
| alias_of_id | INTEGER | NULL, FK→tags.id ON DELETE SET NULL |
| created_at  | TEXT    | NOT NULL DEFAULT (datetime('now'))  |

> 归并:将 B 设为 `alias_of_id = A.id`,并把 `event_tags.tag_id` 由 B 更新为 A;查询标签时过滤 `alias_of_id IS NULL` 取规范标签。

### events

| 列                | 类型    | 约束                                                                                     |
| ----------------- | ------- | ---------------------------------------------------------------------------------------- |
| id                | INTEGER | PK AUTOINCREMENT                                                                         |
| title             | TEXT    | NOT NULL                                                                                 |
| type              | TEXT    | NOT NULL(须存在于 event_types.name)                                                      |
| scale             | TEXT    | NOT NULL(须存在于 event_scales.name)                                                     |
| city_id           | INTEGER | NOT NULL, FK→cities.id                                                                   |
| venue             | TEXT    | NOT NULL                                                                                 |
| address           | TEXT    | NULL                                                                                     |
| start_date        | TEXT    | NOT NULL(ISO 日期 YYYY-MM-DD)                                                            |
| end_date          | TEXT    | NOT NULL                                                                                 |
| cover_url         | TEXT    | NULL                                                                                     |
| description       | TEXT    | NULL                                                                                     |
| qq_group          | TEXT    | NULL(官方交流群链接/群号)                                                                |
| ticket_url        | TEXT    | NULL(购票地址)                                                                           |
| source_url        | TEXT    | NOT NULL(投稿来源链接)                                                                   |
| submitter_contact | TEXT    | NOT NULL(不公开展示)                                                                     |
| status            | TEXT    | NOT NULL DEFAULT 'pending', CHECK status IN ('pending','published','rejected','offline') |
| reject_reason     | TEXT    | NULL                                                                                     |
| created_at        | TEXT    | NOT NULL DEFAULT (datetime('now'))                                                       |
| updated_at        | TEXT    | NOT NULL DEFAULT (datetime('now'))                                                       |
| published_at      | TEXT    | NULL                                                                                     |

> 外键一致性:SQLite 默认外键关闭,迁移末尾 `PRAGMA foreign_keys = ON;` 并在访问层每次连接执行。

### event_tags

| 列       | 类型    | 约束                           |
| -------- | ------- | ------------------------------ |
| event_id | INTEGER | FK→events.id ON DELETE CASCADE |
| tag_id   | INTEGER | FK→tags.id ON DELETE CASCADE   |
|          |         | PRIMARY KEY(event_id, tag_id)  |

## 索引

- `idx_events_status_start` ON events(status, start_date)
- `idx_events_city_end` ON events(city_id, end_date)
- `idx_events_status_city_start` ON events(status, city_id, start_date)
- `idx_tags_name` ON tags(name)
- `idx_event_tags_tag` ON event_tags(tag_id)

## 状态机

```
pending ──approve──▶ published ──offline──▶ offline
pending ──reject───▶ rejected
offline ──republish▶ published
rejected(终态,可重新投稿)
```

## 种子数据规格

- `event_types` 8 行(键/标签/排序):
  comic 漫展 10 | doujin 同人展 20 | concert 演唱会 30 | stage 舞台剧·2.5次元 40 | dance 舞见·宅舞 50 | ipflash IP主题快闪 60 | online 线上活动 70 | other 其它 90
- `event_scales` 4 行:
  small 小型(地区级) 10 | mid 中型(省级) 20 | large 大型(全国级) 30 | mega 超大型(国际级) 40
- `cities` ≥ 50 行:4 直辖市 + 全部省会 + 苏州/无锡/宁波/厦门/青岛/大连/东莞/佛山/珠海/温州/洛阳/汕头 等重点城市;`sort` 按人口/活跃度排序,直辖市 10、省会 20、其它 30 起递增。
- `tags`:不预置。

## 访问层契约(`src/lib/db/`)

```ts
// src/lib/db/index.ts
export const STATUS = { PENDING:'pending', PUBLISHED:'published', REJECTED:'rejected', OFFLINE:'offline' } as const;
export const TYPES = { COMIC:'comic', DOUJIN:'doujin', ... } as const;
export const SCALES = { SMALL:'small', MID:'mid', LARGE:'large', MEGA:'mega' } as const;
export function getDB(runtime: Astro.ServerRuntime): D1Database;
export async function ensureFK(db: D1Database): Promise<void>; // PRAGMA foreign_keys=ON
```

> 类型名以 `wrangler types` 生成结果为准;`Astro.ServerRuntime` 取自 `@astrojs/cloudflare`。

## 兼容性与回滚

- 迁移按序号累加,不做破坏性 ALTER;如需改字段,新增迁移。
- 回滚:开发期可 `wrangler d1 execute --command "..."` 手动回退;生产期以新增迁移修正。
- 种子迁移使用 `INSERT OR IGNORE` 保证可重复执行。

## 风险与权衡

- **枚举键用英文短键** vs 直接存中文:选英文键避免编码/排序问题,展示靠维表 join 取 label。代价:前台列表需 join event_types 取 label(或访问层缓存维表)。
- **tags 归并用 alias_of_id** vs 单独 alias 表:单表自引用更简单,够用。
- **外键 PRAGMA**:SQLite 每连接需开启;访问层统一处理,子任务无需关心。
