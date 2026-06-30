# Implement: D1 schema与维表种子(foundation-db)

## 前置检查

- [ ] 确认 `wrangler.jsonc` 当前无 D1 绑定(`grep d1_databases` 无结果)。
- [ ] 确认 `migrations/` 目录不存在。

## 执行清单(顺序)

1. **创建 D1 数据库**
    - `wrangler d1 create eventlist-db` → 记录 `database_id`。
2. **绑定到 wrangler.jsonc**
    - 在 `wrangler.jsonc` 顶层追加 `d1_databases` 数组(见 design.md 配置),`database_id` 填入上一步值;`migrations_dir: "migrations"`。
3. **建迁移目录与初始迁移**
    - `mkdir -p migrations`。
    - 新建 `migrations/0001_init.sql`:按 design.md 建全部表 + 索引 + `CHECK(status IN ...)`;末尾 `PRAGMA foreign_keys = ON;`。
4. **种子迁移**
    - 新建 `migrations/0002_seed.sql`:用 `INSERT OR IGNORE` 写入 event_types(8)、event_scales(4)、cities(≥50)。cities 列表见 design.md 规格,可从一份 JSON/TS 常量生成 SQL,或直接手写 INSERT。
5. **应用迁移**
    - `wrangler d1 migrations apply eventlist-db --local`(本地)。
    - `wrangler d1 migrations apply eventlist-db --remote`(远程,首次部署时)。
6. **生成类型**
    - `pnpm generate-types`(即 `wrangler types`),确认 `worker-configuration.d.ts` 含 `DB: D1Database`。
7. **实现访问层骨架**
    - `src/lib/db/index.ts`:导出 `STATUS`/`TYPES`/`SCALES` 常量、`getDB(runtime)`、`ensureFK(db)`。
    - `src/lib/db/queries.ts`(占位):导出 `listCities(db)`、`listTypes(db)`、`listScales(db)`(维表读取,供前台下拉与后台用)。
8. **落 DB 规约文档**
    - 新建/更新 `.trellis/spec/backend/database-guidelines.md`:记录 D1 绑定名、迁移流程、外键 PRAGMA、枚举键约定、状态机、归并规则。

## 验证命令

- `pnpm generate-types` → 类型生成无报错。
- `pnpm lint` → 通过。
- `pnpm build` → 通过(无业务页也应能构建)。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM cities"` → ≥ 50。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM event_types"` → 8。
- `wrangler d1 execute eventlist-db --local --command "SELECT COUNT(*) FROM event_scales"` → 4。
- `wrangler d1 execute eventlist-db --local --command "PRAGMA foreign_keys"` → 1。

## 风险点与回滚

- 迁移 SQL 若中途失败:D1 迁移为事务性单文件,失败整体回滚;修正 SQL 后 `--local` 重试。
- `database_id` 误填:修正 `wrangler.jsonc` 即可,不影响已建库。
- 回滚点:本任务不涉及线上数据,失败可 `wrangler d1 execute --command "DROP TABLE ..."` 重跑迁移。

## 完成判定(对照 prd 验收)

- [ ] 迁移成功,表/索引/种子齐全。
- [ ] 类型与访问层可用。
- [ ] DB 规约文档落地。
- [ ] 通知进入 `public-site` 与 `admin-review`(两者可并行启动)。
