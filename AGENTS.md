# AGENTS.md

本文件适用于当前仓库及其所有子目录。后续代理在本项目中工作时，优先遵守这里的约定。

## 项目定位

- 本项目是面向中国 ACG 活动的半可信目录网站。
- 核心体验是类似 seatview 的活动浏览、筛选和详情页。
- 公开筛选条件应默认覆盖 `地点`、`时间`、`类型`、`活动IP`。
- 活动详情应默认保留 `活动名称`、`地点`、`官方交流qq群号`、`购票地址` 等字段。
- 热度值定义为活动页面访问次数，且同一 IP 对同一活动只计 1 次；热门活动窗口关注近 3 日、7 日、30 日内尚未结束的活动。

## 技术栈

- Astro + React + Tailwind CSS。
- Cloudflare Pages/Workers 运行时，`@astrojs/cloudflare` 适配。
- D1 作为权威数据源，Drizzle 管理 schema 和查询。
- KV 用于匿名提交限流，R2 用于封面图对象存储。
- Cloudflare Turnstile 用于匿名提交校验，Cloudflare Access 用于生产后台保护。

## 常用命令

```bash
pnpm install
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm seed > /tmp/eventlist-seed.sql
pnpm wrangler d1 execute eventlist-db --local --file=/tmp/eventlist-seed.sql
pnpm dev
```

变更后按影响范围选择检查：

```bash
pnpm lint
pnpm test
pnpm build
pnpm cf-typegen
```

## 开发约定

- 修改前先理解现有实现、规划文档和测试；避免无关重构。
- 用户提出窄范围需求时，只处理该范围，不主动扩大功能边界。
- 文档本地化时保留 frontmatter、路径、标识符、表名、命令和其他机器可读结构。
- 前端改动要保持信息密度、可扫描性和移动端可用性，不做营销页式首屏。
- 涉及 D1/KV/R2/Access/Turnstile 的改动，要同步检查本地开发路径和生产配置路径。
- 不提交真实 secret、Cloudflare 资源真实 id、`.dev.vars` 或本地生成的临时文件。

## Commit 约定

- 要及时 Commit：每完成一个清晰、可验证的小步骤，并通过相关检查后，就创建一次语义明确的提交。
- 不要把多个无关主题堆到同一个提交里。
- 提交前先查看 `git status` 和差异，确认没有误带用户已有改动。
- 未经用户明确要求，不要 push 或创建 PR。
- 提交前必须通过 `pnpm lint` 和 `pnpm test`，确保代码质量和功能正确。
