# 管理后台审核(admin-review)

> 父任务:`06-29-acg-event-site`。依赖 `foundation-db` 的 schema 与访问层。可与 `public-site` 并行;消费 `public-site` 写入的 `pending` 记录。

## Goal

实现管理后台:Cloudflare Access 鉴权保护 `/admin/*`;对待审核投稿通过/驳回;对已发布活动编辑/下线/重新发布;标签归并。

## Background

- 依赖 `foundation-db` 的 D1 表与 `src/lib/db/` 访问层。
- 父决策:D-Admin(Cloudflare Access 保护 `/admin`,Worker 校验 `Cf-Access-Jwt-Assertion` JWT;降级方案 = 单管理员 env Token + Cookie)、D-Tags(归并同义标签)。
- 状态机见 `foundation-db/design.md`:`pending→published/rejected`;`published↔offline`。

## Requirements

### R1 鉴权
- R1.1 所有 `/admin/*` 路由(页面与 API)必须经过鉴权中间件,未授权返回 401/重定向。
- R1.2 主方案:校验 `Cf-Access-Jwt-Assertion` JWT(签名 + aud + exp),通过即放行。
- R1.3 降级方案:env `ADMIN_TOKEN` 校验 Cookie `admin_token`(值 = 常量时间比较),登录页 `/admin/login` 设置 Cookie。
- R1.4 方案开关由 env `AUTH_MODE` 决定(`access` | `token`),默认 `access`。

### R2 待审核队列
- R2.1 `/admin` 首页:待审核列表(`status='pending' ORDER BY created_at`),分页。
- R2.2 每条显示投稿全字段 + 来源链接(可跳转核验) + 联系方式(仅后台可见)。
- R2.3 操作:通过(→ `published`,设 `published_at`)、驳回(→ `rejected`,必填 `reject_reason`)。

### R3 已发布管理
- R3.1 `/admin/published`:已发布列表,可编辑、下线(→ `offline`)。
- R3.2 编辑页:可改全部字段(同投稿字段),保存更新 `updated_at`;可重新下线/重新发布。
- R3.3 `/admin/offline`:下线列表,可重新发布(→ `published`)。

### R4 标签归并
- R4.1 `/admin/tags`:标签列表(`alias_of_id IS NULL`),显示每个规范标签下的活动数。
- R4.2 归并操作:选源标签 B → 目标标签 A,事务:更新 `event_tags.tag_id` B→A,设 `tags.alias_of_id=B → A`,删除 B 的孤立 `event_tags` 重复行。

### R5 审计与防误
- R5.1 关键操作(通过/驳回/下线/重新发布/归并)写一条 `audit_logs`(可选,见 design.md 决策)。
- R5.2 危险操作(下线/归并)需二次确认(UI 二次点击;API 幂等)。

## Acceptance Criteria

- [ ] 未授权访问 `/admin/*` 被拒绝;Access JWT 校验通过后可访问(或 token 降级方案可登录)。
- [ ] 待审核列表可查看投稿全字段 + 联系方式;通过后活动在前台可见,驳回后不可见且附理由。
- [ ] 已发布活动可编辑保存、可下线;下线后前台显示下线提示;可重新发布。
- [ ] 标签归并后,前台按目标标签筛选能命中被归并的活动,源标签不再出现在高频下拉。
- [ ] `pnpm lint` / `pnpm build` 通过;本地 `wrangler dev` 跑通:投稿(pending)→ 通过 → 前台可见 → 下线 → 前台下线提示 → 归并标签。

## Out of Scope

- 前台公共页面(属 `public-site`)。
- 多管理员角色/权限分级(本期单角色 admin)。
- 操作通知/邮件(父 PRD 已排除)。

## Decisions

- **D-Audit**:MVP 落轻量 `audit_logs(id, action, target_id, meta, at)` 记录关键操作(approve/reject/edit/offline/republish/merge);查看页 `/admin/audit` 可后置,不阻塞 MVP。
- **D-Material**:后台同样遵循 **Material Design 3**(与前台一致),后台常用模式:数据表格(Material data table)、列表项、表单、确认对话框(Material dialog);不引入与前台冲突的第二套 UI 风格。

## Open Questions

- 无阻塞性问题。
