# Implement: 前台站点(public-site)

## 前置依赖

- [ ] `foundation-db` 已完成(迁移应用、访问层可用、类型生成)。
- [ ] D1 有测试数据:可用 `wrangler d1 execute --local --command "INSERT INTO events ..."` 写入若干 published/pending 样本(或写一份 `seed-dev.sql` 临时脚本)。

## 执行清单(顺序)

0. **M3 设计 token 与基础样式**(先于任何页面)
    - 建 `src/styles/tokens.css`(Material 3 color/type/elevation/shape/motion tokens,light + dark)、`base.css`;在 `Base.astro` 引入并应用主题。
    - 建 `src/components/ui/` 薄封装(Button/TextField/Chip/Dialog/Snackbar/Card)供全站复用。
1. **环境与配置**
    - 在 `wrangler.jsonc` `vars` 加 `DEFAULT_CITY_ID`、`TURNSTILE_SITE_KEY`;`wrangler secret put TURNSTILE_SECRET_KEY`。
    - 配置 Rate Limiting(见 design.md,核对 wrangler 当前语法)。
2. **lib 层**
    - `src/lib/geo.ts`:`normalizeCity(raw)`(去"市"/"City"/大小写)、`matchCity(db, raw)`(查 cities)。
    - `src/lib/turnstile.ts`:`verifyTurnstile(token, ip)`。
    - `src/lib/db/queries.ts` 扩展:`listPublishedEvents(filters)`、`getEvent(id)`、`insertSubmission(payload)`(事务含 tags)、`searchTags(q)`、`topTags(n)`、`listCities`/`listTypes`/`listScales`。
3. **布局与公共组件**
    - `src/layouts/Base.astro`:head/meta/JSON-LD 槽。
    - `CitySelector.svelte`、`Turnstile.svelte`。
4. **首页**
    - `src/pages/index.astro`:server 端定位 → 查近期活动 → 渲染卡片 + 城市选择器。
5. **列表页**
    - `src/pages/events/index.astro`:解析查询参数 → `listPublishedEvents` → 卡片列表 + `FilterBar.svelte` + 分页。
    - `FilterBar.svelte`:城市/类型/规模下拉(来自维表)、日期范围、标签(下拉 topTags + 文本模糊 `/api/tags`),提交跳转带参数。
6. **详情页**
    - `src/pages/events/[id].astro`:查 `getEvent`,pending/rejected → `Astro.response.status=404` + 404 模板;offline → 下线横幅;published → 全字段 + JSON-LD(`src/lib/seo.ts`)。
7. **投稿表单与接口**
    - `src/pages/submit.astro`:表单 + `Turnstile.svelte` + `TagInput.svelte`。
    - `src/pages/api/submit.ts`:校验 → Turnstile → 事务写入 → JSON 返回。
    - `src/pages/api/cities.ts`、`src/pages/api/tags.ts`:GET 返回 JSON。
8. **sitemap**
    - 配置 `@astrojs/sitemap`(可能需自定义 endpoint 查 published id 列表注入),确认详情页被收录。

## 验证命令

- `pnpm generate-types` → 类型含 DB。
- `pnpm lint` → 通过。
- `pnpm build` → 通过。
- 本地 `wrangler dev` 或 `astro dev` 手动验证:
    - 首页定位/切换城市显示活动。
    - 列表筛选各维度生效;标签模糊搜索生效。
    - 详情页字段完整;pending 访问 404;offline 显示下线提示。
    - 投稿提交成功写入 pending(`SELECT status FROM events ORDER BY id DESC LIMIT 1` → pending);缺来源/联系方式/Turnstile 失败时被拒。
    - `/sitemap.xml` 含 published 详情 URL。

## 风险点与回滚

- Turnstile 本地测试:可用 Cloudflare 提供的测试密钥(`1x0000000000000000000000000000000` 总通过)。
- Rate Limiting 语法若 wrangler 版本不支持:改用 Dashboard 配置,不阻塞开发。
- 回滚点:按路由粒度删除文件即可回退单页。

## 完成判定(对照 prd 验收)

- [ ] 首页定位+切换、列表筛选、详情可见性、投稿闭环、SEO 全部满足。
- [ ] lint/build 通过,本地闭环跑通。
- [ ] 与 `admin-review` 联调前,确保投稿写入 `pending`(后台子任务的输入)。
