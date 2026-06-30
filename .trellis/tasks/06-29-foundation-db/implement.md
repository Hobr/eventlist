# Implement: D1 schema与维表种子(foundation-db)

## 前置检查

- [x] 确认 `wrangler.jsonc` 启动时无 D1 绑定,实现中已添加 `DB`。
- [x] 确认 `migrations/` 已有 `0003_audit.sql`,实现中保留并补齐 `0001_init.sql` / `0002_seed.sql`。

## 执行清单(顺序)

1. **创建 D1 数据库**
    - [x] `wrangler d1 list` 确认远端 `eventlist-db` 已存在,复用 `database_id=b11ea70c-4597-4049-a650-718cfbc5b04f`。
2. **绑定到 wrangler.jsonc**
    - [x] 在 `wrangler.jsonc` 顶层追加 `d1_databases` 数组(见 design.md 配置),`database_id` 填入上一步值;`migrations_dir: "migrations"`。
3. **建迁移目录与初始迁移**
    - [x] 新建 `migrations/0001_init.sql`:按 design.md 建全部表 + 索引 + `CHECK(status IN ...)` + 日期 CHECK + FK。
4. **种子迁移**
    - [x] 新建 `migrations/0002_seed.sql`:用 `INSERT OR IGNORE` 写入 event_types(8)、event_scales(4)、cities(72)。
5. **应用迁移**
    - [x] `wrangler d1 migrations apply eventlist-db --local`(本地)。
    - [x] `wrangler d1 migrations apply eventlist-db --remote`(远程首次 setup)。
6. **生成类型**
    - [x] `corepack pnpm generate-types`(即 `wrangler types`),确认 `worker-configuration.d.ts` 含 `DB: D1Database`。
7. **实现访问层骨架**
    - [x] `src/lib/db/index.ts`:导出 `STATUS`/`TYPES`/`SCALES` 常量、`await getDB(runtimeEnv)`、`ensureFK(db)`。
    - [x] `src/lib/db/queries.ts` 已由 admin-review 扩展,包含 `listCities(db)`、`listTypes(db)`、`listScales(db)`。
8. **落 DB 规约文档**
    - [x] 更新 `.trellis/spec/backend/database-guidelines.md`:记录 D1 绑定名、迁移流程、外键 PRAGMA、枚举键约定、状态机、归并规则。

## 验证命令

- `corepack pnpm generate-types` → 通过,`DB: D1Database` 已生成。
- `corepack pnpm exec tsc --noEmit` → 通过。
- `corepack pnpm lint` → 通过。
- `corepack pnpm build` → 通过。
- `wrangler d1 migrations apply eventlist-db --local` → `0001_init.sql` / `0002_seed.sql` / `0003_audit.sql` 均 ✅。
- `wrangler d1 migrations apply eventlist-db --remote` → `0001_init.sql` / `0002_seed.sql` / `0003_audit.sql` 均 ✅。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM cities"` → 72。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM event_types"` → 8。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM event_scales"` → 4。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM tags"` → 0。
- `wrangler d1 execute eventlist-db --local --command "PRAGMA foreign_keys"` → 1。
- 远端计数: event_types 8 / event_scales 4 / cities 72 / tags 0;`wrangler d1 migrations list eventlist-db --remote` → No migrations to apply.

## 风险点与回滚

- 迁移 SQL 若中途失败:D1 迁移为事务性单文件,失败整体回滚;修正 SQL 后 `--local` 重试。
- `database_id` 误填:修正 `wrangler.jsonc` 即可,不影响已建库。
- 回滚点:本任务不涉及线上数据,失败可 `wrangler d1 execute --command "DROP TABLE ..."` 重跑迁移。

## 完成判定(对照 prd 验收)

- [x] 迁移成功,表/索引/种子齐全。
- [x] 类型与访问层可用。
- [x] DB 规约文档落地。
- [x] 通知进入 `public-site` 与 `admin-review`(两者可并行启动)。
