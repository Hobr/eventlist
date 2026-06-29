# 前台站点(public-site)

> 父任务:`06-29-acg-event-site`。依赖 `foundation-db` 的 schema 与访问层。可与 `admin-review` 并行。

## Goal

实现面向访客的公共站点:首页(定位 + 本地活动 + 筛选)、活动列表、活动详情、活动投稿表单。投稿写入 `pending` 队列,不在前台公开。

## Background

- 依赖 `foundation-db` 的 D1 表(`events`/`cities`/`event_types`/`event_scales`/`tags`/`event_tags`)与 `src/lib/db/` 访问层。
- 技术栈:Astro SSR(Cloudflare adapter)+ Svelte 交互组件 + sitemap + **Material Design 3 视觉规范**。
- 父决策:D-Location(IP 定位/手动切换/localStorage)、D-Tags(高频下拉 + 模糊搜索)、D-AntiAbuse(Turnstile + Rate Limiting + 来源链接必填 + pending 默认不公开)、D-Auth(投稿免登录)。

## Requirements

### R1 首页与定位
- R1.1 首页服务端优先用 `request.cf.city`/`request.cf.region` 映射 `cities` 标准城市;映射失败则用默认城市(可配,如北京)。
- R1.2 客户端可手动切换城市,选择写入 localStorage,后续访问以此为准;提供城市选择器(下拉,源自 `cities`)。
- R1.3 首页展示选中城市的近期活动(`status='published' AND city_id=? AND end_date>=today ORDER BY start_date LIMIT N`)。

### R2 筛选与列表
- R2.1 活动列表页支持筛选:城市、时间范围(起/止)、类型、规模、标签(高频下拉 + 文本模糊匹配)。
- R2.2 仅返回 `status='published'` 且 `end_date>=today`(默认),可按开始时间正序/倒序。
- R2.3 列表项展示:标题、类型 label、城市名、起止日期、规模 label、封面、标签(前 N 个)。
- R2.4 分页或"加载更多"(MVP 用分页,每页 20)。

### R3 活动详情
- R3.1 路由 `/events/[id]`(或 slug,本期用 id)。仅 `published`/`offline`(下线)状态可见;`offline` 显示已下线提示但仍可访问旧页(SEO 友好),`pending`/`rejected` 返回 404。
- R3.2 展示全部字段:标题、类型/规模 label、城市、地点、地址、起止日期、封面、描述、标签、官方交流群、购票地址、来源链接。
- R3.3 SEO:sitemap 收录 published 详情;详情页加 JSON-LD(`Event` schema)。

### R4 投稿表单
- R4.1 路由 `/submit`:字段 = 标题、类型(下拉)、规模(下拉)、城市(下拉)、地点、地址、起止日期、封面 URL、描述、标签(自由文本多值)、官方交流群、购票地址、来源链接(必填)、联系方式(必填,不公开)、Turnstile token。
- R4.2 提交到 `POST /api/submit`(同站 API):服务端校验必填/类型合法/城市合法/Turnstile token;写入 `events(status='pending')` + 同步写入 `event_tags`(新标签自动入 `tags`)。
- R4.3 成功后展示成功页(告知进入审核),失败返回校验错误。
- R4.4 Rate Limiting 由 Cloudflare 原生配置(在 `wrangler.jsonc` 或 Dashboard,针对 `/api/submit`)。

### R5 SEO 与性能
- R5.1 sitemap 含首页、列表页、published 详情页。
- R5.2 列表/详情 SSR,交互部分(城市切换、筛选、表单)用 Svelte island。
- R5.3 列表查询走索引(见 foundation-db design.md)。

## Acceptance Criteria

- [ ] 访客首次打开首页自动定位城市并显示该城市近期 published 活动;可手动切换城市并记忆。
- [ ] 列表页可按城市/时间/类型/规模/标签筛选,标签支持模糊搜索,仅返回 published 且未结束活动。
- [ ] 详情页展示完整字段 + 官方交流群 + 购票地址 + 来源链接;`pending`/`rejected` 返回 404,`offline` 显示下线提示。
- [ ] 投稿表单提交成功后写入 `pending` 队列且前台不可见;缺来源链接/联系方式/Turnstile 校验失败时拒绝。
- [ ] sitemap 含 published 详情页;详情页有 JSON-LD `Event`。
- [ ] `pnpm build` 与 `pnpm lint` 通过;本地 `wrangler dev` 可跑通首页→列表→详情→投稿闭环(用测试数据)。

## Out of Scope

- 后台审核 UI(属 `admin-review`)。
- 用户账号、社交功能(父 PRD 已排除)。
- GPS 距离检索(父 PRD 已排除)。
- 推送/订阅(父 PRD 已排除)。

## Decisions

- **D-Cover**:封面图用**外部 URL 字段**(投稿者填封面图链接),MVP 不引入 R2 上传;详情页 `<img onerror>` 回退占位图。
- **D-Material**:前台遵循 **Material Design 3**:配色(scheme)、排印(Roboto/系统字体回退)、卡片/按钮/表单/导航按 Material 3 组件规范;动效遵循 Material motion tokens。组件优先复用/薄封装,避免重 UI 框架拖累 Workers 体积。

## Open Questions

- 无阻塞性问题。
