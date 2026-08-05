# 活动分类导航单页实施计划

## Implementation

- [x] 在 `src/lib/db/public-taxonomy.ts` 定义公开分类 DTO，并实现仅聚合全部 `published` 活动的查询与稳定排序。
- [x] 在 `src/lib/cache/public-data.ts` 增加 `event-taxonomy` payload/key 和规范化缓存 URL。
- [x] 在 `src/lib/cache/public-routes.ts` 增加严格 DTO guard 与 `loadCachedPublicEventTaxonomy()`，复用 `tags` scope 和 TTL。
- [x] 新增 `src/pages/categories.astro`，实现加载、错误、全空、分区展示和带 `status=all` 的筛选链接。
- [x] 更新 `src/layouts/Layout.astro` 与 `src/components/PublicMobileNav.svelte`，加入桌面和移动“分类”导航项。
- [x] 更新 `src/pages/sitemap.xml.ts`，加入 `/categories`。

## Tests

- [x] 使用真实 SQLite/D1 测试夹具验证：已结束的 `published` 活动计入；`pending/rejected/offline` 不计入；标签别名不展示；计数、排序和空分类过滤正确。
- [x] 扩展公开缓存测试，覆盖 `event-taxonomy` 键、DTO guard、`tags` scope、固定 Cache-Tag、TTL、缓存故障回源和 stale-if-error。
- [x] 增加页面契约检查，覆盖 `status=all` 链接、桌面/移动导航和 sitemap 静态项。

## Validation

- [x] `corepack pnpm test`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm exec tsc --noEmit`
- [x] `corepack pnpm build`
- [x] `corepack pnpm exec wrangler types --check`
- [x] `git diff --check`
- [x] 使用本地 Astro 服务对页面、筛选 URL、导航当前态和 sitemap 做 HTTP 检查；响应式布局通过稳定网格和现有移动导航契约覆盖。

## Spec And Finish

- [x] 更新 `.trellis/spec/backend/public-data-cache.md`，记录 `event-taxonomy` 资源复用 `tags` scope 的缓存契约。
- [x] 更新 `.trellis/spec/backend/database-guidelines.md`，记录公开分类聚合的状态和规范标签口径。
- [x] 更新 `.trellis/spec/frontend/design-system.md`，把公开导航契约更新为包含“分类”。
- [ ] 完成最终 Trellis 检查、提交并归档任务。

## Risk And Rollback Points

- 缓存 DTO guard 或键不匹配会造成持续回源；先通过缓存单测再接入页面。
- 导航增加第四项可能在窄桌面宽度拥挤；视觉检查不通过时优先收紧间距，不隐藏入口。
- 查询计数口径必须和 `status=all` 目标列表一致；任何测试差异都应回滚到查询层修正，不在页面层补偿。
