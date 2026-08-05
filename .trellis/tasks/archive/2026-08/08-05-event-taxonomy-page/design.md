# 活动分类导航单页技术设计

## Architecture

本功能沿用现有 Astro SSR、D1 公开 DTO 和 Cache API 读穿缓存结构，不新增 API 路由或客户端状态。

数据流：

```text
D1 published events
  -> listPublicEventTaxonomy()
  -> PublicEventTaxonomy DTO
  -> loadCachedPublicEventTaxonomy() [tags scope]
  -> /categories Astro page
  -> /events?status=all&<facet>=<value>
```

## Data Contract

新增 `src/lib/db/public-taxonomy.ts`，导出：

- `PublicTaxonomySummary = { name: string; event_count: number }`
- `PublicEventTaxonomy = { tags: PublicTaxonomySummary[]; types: PublicTaxonomySummary[]; scales: PublicTaxonomySummary[] }`
- `listPublicEventTaxonomy(db) -> Promise<PublicEventTaxonomy>`

查询只读取 `events.status = published`：

- 类型按 `events.type` 聚合。
- 规模按 `events.scale` 聚合。
- 标签通过 `event_tags` 与 `tags` 聚合，并要求 `tags.alias_of_id IS NULL`。
- 已结束活动继续计入；其他事件状态全部排除。
- 类型和规模结果按 `EVENT_TYPES`、`EVENT_SCALES` 的配置顺序投影，只保留计数大于 0 的已知代码。
- 标签按活动数量降序、名称升序排列。

类型和规模的中文标签仍由 `src/lib/events/options.ts` 在渲染层提供，缓存 DTO 不复制易漂移的展示文案。

## Cache Contract

在现有公开数据缓存中增加无参数资源键 `event-taxonomy`，复用 `tags` scope、`eventlist-tags` Cache-Tag 和标准 `30m / 48h` TTL：

- D1 仍是唯一事实来源。
- 缓存 payload 只包含名称和非零活动计数。
- DTO guard 校验精确字段、已知类型/规模代码、非空标签、正安全整数计数和无重复项目。
- 现有管理员事件/标签变更已经清理 `tags` scope，因此无需新增失效类型或生产配置 token。

## Page And Navigation

- 新增 `src/pages/categories.astro`，使用 `Layout.astro` SSR 渲染三个语义化区段。
- 页面采用无嵌套卡片的响应式网格；每个分类项是完整可聚焦链接，显示名称与活动数量。
- 使用 `URLSearchParams` 生成链接，统一写入 `status=all`，并分别写入 `tag`、`type` 或 `scale`。
- 桌面 `Layout.astro` 与移动 `PublicMobileNav.svelte` 增加“分类”入口和同一图标语义。
- `src/pages/sitemap.xml.ts` 的静态 URL 增加 `/categories`。

## Error And Empty States

- D1 与缓存同时不可用时，页面显示明确错误提示，不把故障伪装成“没有分类”。
- 成功返回但没有任何符合条件的活动时，页面显示一个统一空状态；三个空区段不分别占位。
- 某个区段为空而其他区段有数据时，仅省略该区段。

## Compatibility And Rollback

- 不改变 `/events` 的参数解析或默认时间范围。
- 新页面只依赖现有稳定查询参数，回滚时可独立移除页面、导航、缓存资源和查询模块。
- 不修改 D1 schema 或迁移文件。
