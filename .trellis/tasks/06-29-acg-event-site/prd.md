# ACG活动消息网站

## Goal

构建一个面向中国用户的 ACG 类活动消息网站(民间爱好者运营,非官方),让用户能够查询即将在中国举办的 ACG 活动(漫展、同人展、演唱会、舞台剧、IP 主题快闪等)并查看详情。任何人都可以快速投稿活动,管理员在后台审核后发布。网站无社交功能。

## Background

- 运营方为非官方民间爱好者,需低成本运营,优先使用 Cloudflare 全栈技术。
- 已有脚手架:Astro 7 + `@astrojs/cloudflare` adapter + `@astrojs/svelte` + `@astrojs/sitemap`,`wrangler.jsonc` 已配置 Workers 入口(`@astrojs/cloudflare/entrypoints/server`),但尚未绑定任何 D1/KV/R2/Queues。
- `src/{pages,components,layouts,assets}` 为空,属全新项目。
- `.trellis/spec/{backend,frontend,guides}` 为模板骨架,需要在实现期间填充。

## Confirmed Facts

- 前端框架:Astro(SSR via Cloudflare adapter),交互组件用 Svelte。
- 前端视觉语言:**Material Design**(遵循 Material Design 3 规范,使用 Material 3 配色/排印/高度/动效;Svelte 组件库或自实现按实际选型,见各子任务 design.md)。
- 部署:Cloudflare Workers + Pages assets。
- 无社交功能:不做评论、点赞、关注、用户主页、私信等。
- 活动属性字段:城市、时间(开始/结束)、地点、类型、规模、相关作品标签。
- 活动详情页内容:基础信息 + 官方交流群链接 + 购票地址链接。
- 首页:根据用户定位显示最近本地活动 + 支持筛选。
- 投稿流程:所有人可快速投稿 → 管理员后台审核 → 发布。
- 语言:面向中国用户,内容以中文为主。

## Task Map(父任务持需求与集成验收,不做实现目标)

```
06-29-acg-event-site (parent)
├── foundation-db   — D1 schema/migrations + 维表(cities/types/scales/tags)种子数据
├── public-site     — 前台:首页定位+筛选、活动列表、活动详情、投稿表单
└── admin-review    — 后台:Cloudflare Access 鉴权 + 待审核列表/通过/驳回/编辑/下线/标签归并
```

依赖顺序(写进各子任务 `implement.md`):
1. `foundation-db` 先行(其它子任务依赖 schema);
2. `public-site` 与 `admin-review` 在 schema 定稿后**可并行**(投稿写入 `pending` 是公共站职责,审核消费 `pending` 是后台职责,接口契约就是 D1 表)。

## Decisions

- **D-Auth**:公共投稿**不需要登录**;投稿表单要求留联系方式(QQ 或邮箱)+ Cloudflare Turnstile 防机器人,提交即进待审核队列。
- **D-Admin**:管理后台用 **Cloudflare Access(Zero Trust)** 保护 `/admin` 路由,管理员经邮箱/GitHub SSO 登录;Worker 侧仅校验 `Cf-Access-Jwt-Assertion` JWT。不自建账号密码系统。(若 Access 免费档不可用,降级为单管理员环境变量 Token + Cookie 极简方案。)
- **D-Storage**:数据存 **Cloudflare D1**(SQLite),支持多条件筛选/时间范围/排序;不用 KV。
- **D-Location**:活动按**城市离散字段**组织(`city` + `province`),不存坐标、不做 GPS 距离检索。首页"本地活动"逻辑:优先读 Worker `request.cf.city` 映射标准城市名 → 读不到或用户手动切换时用 localStorage 存的城市 → `WHERE city=? AND end_date>=today ORDER BY start_date LIMIT N`。
- **D-Cities**:单独建 `cities(id, name, province, sort)` 维表,统一筛选下拉与 IP 城市映射,避免脏数据。
- **D-Taxonomy**:活动 `type`/`scale` 用**固定枚举(单选)**,管理员可在维表扩展,投稿者只能选现有项。
  - `type` 初版:漫展 / 同人展 / 演唱会 / 舞台剧·2.5次元 / 舞见·宅舞 / IP主题快闪 / 线上活动 / 其它
  - `scale` 初版:小型(地区级) / 中型(省级) / 大型(全国级) / 超大型(国际级)
- **D-Tags**:相关作品标签 `tags` 为**自由文本多值**,拆成独立 `event_tags(event_id, tag)` 关系表;首次出现的标签自动入 `tags` 维表,管理员可在审核时归并同义标签;首页筛选下拉只展示高频标签(Top N),搜索框支持任意标签模糊匹配。
- **D-Storage-Shape**:`type`/`scale` 入库为枚举字符串;`tags` 入库为关系表行。
- **D-AntiAbuse**:投稿防滥用分层叠加:
  1. Cloudflare Turnstile 人机校验(Worker 侧校验 token);
  2. Cloudflare 原生 Rate Limiting(针对 `/submit` 路由,例如同 IP 10 分钟 ≤ 3 次);
  3. 投稿必填来源链接(官方公告/微博/B站动态),联系方式必填但**不公开展示**;
  4. 审核态默认不公开(所有投稿先进 `pending` 队列,不直接污染前台)。
  不做 IP 黑名单库、账号封禁、关键词过滤(无账号体系/Workers 无状态维护成本高/误杀高)。

## Requirements

### R1 公共浏览
- R1.1 首页按用户定位展示最近本地活动(可手动切换城市)。
- R1.2 提供活动筛选(城市、时间范围、类型、规模、相关作品标签等)。
- R1.3 活动详情页展示全部属性字段 + 官方交流群 + 购票地址等信息。
- R1.4 列表/详情均 SEO 友好(sitemap、结构化数据)。

### R2 投稿
- R2.1 任意访客可提交活动投稿表单(含 R1 字段 + 联系方式 + 来源链接)。
- R2.2 投稿进入待审核队列,审核通过后才在站点可见。

### R3 管理后台
- R3.1 管理员可查看待审核投稿,审核通过/驳回(附驳回理由)。
- R3.2 管理员可编辑/下线已发布活动。
- R3.3 后台仅授权人员可访问。

### R4 数据与存储
- R4.1 活动数据持久化存储,支持按城市/时间/类型/标签检索。
- R4.2 待审核与已发布状态分离。

## Acceptance Criteria(父任务集成验收)

- [ ] `foundation-db` 子任务完成:D1 schema 已迁移,维表种子数据就位,可被其它子任务引用。
- [ ] `public-site` 子任务完成:首页定位+筛选、活动列表、活动详情、投稿表单均可用,投稿写入 `pending`。
- [ ] `admin-review` 子任务完成:Cloudflare Access 鉴权生效,待审核通过/驳回/编辑/下线/标签归并均可用。
- [ ] 端到端闭环:投稿 → 后台审核通过 → 前台可见;后台驳回 → 前台不可见;后台下线 → 前台不再可见。
- [ ] 访客可在首页看到按定位推荐的本城市近期活动,并可手动切换城市。
- [ ] 访客可按城市/时间/类型/标签筛选活动列表。
- [ ] 访客可打开活动详情页看到完整信息(含官方交流群、购票地址)。
- [ ] 后台仅授权人员可访问,普通访客无法进入审核界面。
- [ ] 部署到 Cloudflare,站点可正常访问且核心链路无运行时错误。

## Out of Scope

- 用户账号体系、社交功能(评论/点赞/关注/私信/用户主页)。
- 在线支付、票务交易(仅展示外部购票链接)。
- 活动主办方自助管理后台(本期仅管理员统一审核)。
- 多语言(本期仅中文)。
- 推送通知/邮件订阅。
- GPS 距离检索/附近城市(本期仅按城市离散字段)。

## Open Questions

- 无阻塞性问题。子任务规划中如出现新问题,回写到此或子任务 prd。
