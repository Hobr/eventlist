# Implement: 管理后台审核(admin-review)

## 前置依赖

- [ ] `foundation-db` 已完成(schema + 访问层 + 类型)。
- [ ] D1 有 pending 测试数据(可由 `public-site` 投稿产生,或手动 `INSERT ... status='pending'`)。

## 执行清单(顺序)

1. **鉴权层**
    - 如采用 `jose`,先加依赖;否则用 Workers Web Crypto 实现 RS256 JWT 校验。
    - `src/lib/auth/access.ts`:`verifyAccessJWT(jwt, env)`(取 JWKS、验签、iss、aud、exp;缓存 JWKS)。
    - `src/lib/auth/token.ts`:`verifyTokenCookie(cookie, env)`(常量时间比较)。
    - `src/middleware.ts`:按 `AUTH_MODE` 精确拦 `/admin`/`/admin/*` 与 `/api/admin`/`/api/admin/*`;失败 API→401,页面→302 `/admin/login`;确认 `/admin-login` 不被误拦。
2. **登录页(token 模式)**
    - `src/pages/admin/login.astro`:表单提交 token → Set-Cookie → 跳 `/admin`。Access 模式下此页仅作占位/提示"请通过 Cloudflare Access 登录"。
3. **后台布局与列表**
    - `src/pages/admin/_AdminLayout.astro`:侧栏(待审核/已发布/已下线/标签)。
    - `index.astro`(pending)、`published.astro`、`offline.astro`:调 `listByStatus(status)` 渲染表格 + 操作按钮。
4. **状态迁移 API**
    - `approve.ts` / `reject.ts` / `offline.ts` / `republish.ts`:SQL 见 design.md;成功更新 1 行后写审计;已处于目标状态的重复提交返回成功但不重复写审计。
    - 前端按钮 → fetch 对应 API → 成功后刷新列表;危险操作二次确认。
5. **编辑页与 API**
    - `events/[id]/edit.astro`:加载 `getEvent` → 表单(同投稿字段,复用组件或简化版)→ `PATCH /api/admin/events/[id]`。
    - `index.ts`(PATCH):校验 → 确认 event 存在 → 规范化/创建标签 → D1 `batch()` 更新 events + 全量替换 event_tags → 写审计。
6. **标签归并**
    - `tags.astro`:列出 `alias_of_id IS NULL` 标签 + 活动数;归并 UI(选 from→to)。
    - `tags/merge.ts`:校验 `from != to` 且源/目标为规范标签;D1 `batch()` 事务(见 design.md);成功后写审计;源已归并到目标时返回成功且不重复写审计。
7. **审计**
    - 新增 `migrations/0003_audit.sql` 建 `audit_logs`;`insertAudit(db, action, targetId, meta)`;可选 `/admin/audit` 查看页(可后置)。
8. **Cloudflare Access 配置(生产)**
    - 在 Zero Trust 创建 Application 保护 `域名/admin/*`;记录 `aud` 填 `ACCESS_AUD`。

## 验证命令

- `pnpm generate-types` → 通过。
- `pnpm lint` / `pnpm build` → 通过。
- 本地 `wrangler dev`(`AUTH_MODE=token`,设 `ADMIN_TOKEN`)手动验证:
    - 未带 cookie 访问 `/admin` → 跳转 login;登录后可访问。
    - 未带 cookie 调 `/api/admin/...` → 401;访问 `/admin-login` 不被 admin 中间件拦截。
    - pending 列表 → 通过 → 该活动在前台(`/events/[id]`)可见。
    - pending → 驳回(填理由)→ 前台 404,后台可见 rejected。
    - published → 下线 → 前台显示下线提示 → 重新发布 → 前台恢复。
    - 编辑保存生效;event_tags 同步。
    - 标签归并后前台按目标标签筛选命中被归并活动;源标签不出现在下拉。
    - approve/reject/edit/offline/republish/merge 实际变更成功后 `audit_logs` 均新增对应记录;状态迁移和标签归并重复提交不重复新增审计。
- (生产前)切 `AUTH_MODE=access`,验证 Access JWT 校验通过。

## 风险点与回滚

- Access JWT 本地难测 → 开发用 token 模式;上线前在预览环境测 access 模式。
- 中间件误拦前台 → 单测 `startsWith('/admin')` 边界;`/admin` 恰好匹配、`/admin-login` 不应匹配(用 `/admin/` 或精确前缀)。
- 回滚点:按路由删除文件;移除 middleware 中的 admin 分支。

## 完成判定(对照 prd 验收)

- [ ] 鉴权、待审核通过/驳回、已发布编辑/下线/重新发布、标签归并全部可用。
- [ ] 关键操作写入 `audit_logs`;审计查看页如未做,在后续任务中记录。
- [ ] lint/build 通过;本地闭环(投稿→审核→发布→下线→归并)跑通。
- [ ] 与父任务集成验收对齐(端到端闭环)。
