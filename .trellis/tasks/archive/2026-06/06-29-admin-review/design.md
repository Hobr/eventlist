# Design: 管理后台审核(admin-review)

## 路由与渲染

| 路由 | 方法 | 说明 |
|---|---|---|
| `/admin` | GET | 待审核列表(默认) |
| `/admin/published` | GET | 已发布列表 |
| `/admin/offline` | GET | 下线列表 |
| `/admin/events/[id]/edit` | GET | 编辑页 |
| `/admin/tags` | GET | 标签管理/归并 |
| `/admin/login` | GET/POST | 仅 token 降级方案用 |
| `/api/admin/events/[id]/approve` | POST | pending→published |
| `/api/admin/events/[id]/reject` | POST | pending→rejected(带 reason) |
| `/api/admin/events/[id]` | PATCH | 编辑字段 |
| `/api/admin/events/[id]/offline` | POST | published→offline |
| `/api/admin/events/[id]/republish` | POST | offline→published |
| `/api/admin/tags/merge` | POST | {from, to} 归并 |

> 所有 `/admin` 页面路由与 `/api/admin` API 路由均经鉴权中间件。

## 鉴权中间件

`src/middleware.ts`(Astro middleware):
```
AUTH_MODE = env.AUTH_MODE ?? 'access'
adminPath = path === '/admin' || path.startsWith('/admin/')
adminApiPath = path === '/api/admin' || path.startsWith('/api/admin/')
if adminPath or adminApiPath:
  if AUTH_MODE === 'access':
    jwt = headers['Cf-Access-Jwt-Assertion']
    verify AccessJWT(jwt) via Access public keys (jwks), check iss, aud, exp
    fail → 401 (API) or 302 → /admin/login?... (page)
  else (token):
    cookie admin_token === env.ADMIN_TOKEN (constant-time) ?
    fail → 401 (API) or 302 → /admin/login (page)
  pass → next
```
Access JWT 校验:从 `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` 取 JWK 公钥,验证 RS256;`iss` 为 `https://<team>.cloudflareaccess.com`, `aud` 从 env `ACCESS_AUD` 取。实现可用 `jose` 的 `createRemoteJWKSet`/`jwtVerify` 或等价 Web Crypto,并缓存 JWKS。降级 token 方案:`/admin/login` 表单提交 token,Set-Cookie `admin_token; HttpOnly; Secure; SameSite=Strict`。

## 状态迁移 API

```
approve:  UPDATE events SET status='published', published_at=datetime('now'), updated_at=datetime('now') WHERE id=? AND status='pending'
reject:   UPDATE events SET status='rejected', reject_reason=?, updated_at=datetime('now') WHERE id=? AND status='pending'
offline:  UPDATE events SET status='offline', updated_at=datetime('now') WHERE id=? AND status='published'
republish:UPDATE events SET status='published', updated_at=datetime('now') WHERE id=? AND status='offline'
edit(PATCH): UPDATE events SET ... WHERE id=? (校验 type/scale/city 合法, 更新 updated_at, 同步 event_tags 事务)
```
所有 API 返回 JSON `{ok:true}` 或 `{ok:false,error}`。状态迁移只有在更新命中 1 行时才写审计;如果活动已处于目标状态,重复提交返回 `{ok:true}` 且不重复写审计;其它状态不匹配返回 409。

编辑保存同样按“先确认 event 存在 → 规范化/创建标签 → D1 batch 更新 events、删除旧 event_tags、插入新 event_tags”的顺序执行;只有实际更新成功才写 edit 审计。

## 标签归并(事务)

用 D1 `db.batch([...])` 提交下列语句;D1 batch 是一个 SQL transaction,任一语句失败会中止并回滚整批。

```sql
-- 删除归并后会产生重复的 (event_id, tag_id) 行
DELETE FROM event_tags WHERE tag_id=:from
  AND event_id IN (SELECT event_id FROM event_tags WHERE tag_id=:to);
UPDATE event_tags SET tag_id=:to WHERE tag_id=:from;
UPDATE tags SET alias_of_id=:to WHERE id=:from;
```
接口需校验 `from != to`,且目标标签 `alias_of_id IS NULL`;前台取规范标签:`WHERE alias_of_id IS NULL`。
若源标签已经 `alias_of_id=to`,重复归并返回 `{ok:true}` 且不重复写审计;源/目标缺失或非规范标签返回 409。

## 审计日志(轻量,必做)

表 `audit_logs(id, action, target_id, meta TEXT, at TEXT)`(本任务迁移新增 `0003_audit.sql`)。关键操作实际变更成功后写一行:`action` ∈ {approve,reject,edit,offline,republish,merge},`meta` 存 JSON(如 reject_reason、merge from/to)。状态迁移与标签归并的幂等重试不重复写审计。后台可加 `/admin/audit` 查看页(可后置,不阻塞 MVP)。

## 组件结构(src,本任务新增)

> 视觉规范见 `.trellis/spec/frontend/design-system.md`(Material Design 3)。复用前台 `src/components/ui/` 的 Button/TextField/Chip/Dialog/Snackbar;后台额外使用 Material data table、navigation drawer/rail、top app bar 模式。不引入第二套 UI 风格。

```
src/
  middleware.ts
  pages/
    admin/
      _AdminLayout.astro     (Material top app bar + navigation drawer/rail)
      index.astro            (pending 列表,Material data table)
      published.astro
      offline.astro
      events/[id]/edit.astro (Material form + chips)
      tags.astro             (标签列表 + 归并 Material dialog 二次确认)
      login.astro            (仅 token 模式,Material form)
    api/
      admin/
        events/[id]/approve.ts
        events/[id]/reject.ts
        events/[id]/index.ts   (PATCH edit)
        events/[id]/offline.ts
        events/[id]/republish.ts
        tags/merge.ts
  lib/
    auth/
      access.ts              (AccessJWT verify)
      token.ts               (降级 token 校验)
    db/queries.ts 扩展       (listByStatus, updateStatus, editEvent, mergeTags, insertAudit)
```
## 环境变量

- `AUTH_MODE`(access|token,默认 access)
- `ACCESS_TEAM`(如 `yourteam`),用于 JWKS URL 与 issuer
- `ACCESS_AUD`(Access JWT aud)
- `ADMIN_TOKEN`(降级方案)
- `TURNSTILE_*`(本任务不需要,前台用)

## 兼容性与回滚

- 鉴权中间件是 Astro 全局 middleware,需确保只拦 `/admin`/`/admin/*` 与 `/api/admin`/`/api/admin/*`,不影响前台路由或 `/admin-login` 这类相似路径。
- 新增迁移 `0003_audit.sql` 需在 `foundation-db` 已应用基础上叠加。
- 回滚:删除 `/admin/*` 与中间件即恢复无后台状态;审计表可 DROP。

## 风险与权衡

- **Access JWT 本地难测**:开发期可设 `AUTH_MODE=token` 用 token 方案本地联调;生产切 `access`。
- **编辑同步 event_tags**:以"全量替换"实现(删旧 event_tags 再插新),事务包裹,简单可靠。
- **归并不可逆**:UI 二次确认 + 仅显示 `alias_of_id IS NULL` 标签可选为目标;归并后源标签隐藏但记录保留(可审计)。
- **审计表**:MVP 落库但不强制做查看页;这样保留运营追责证据,又不扩大后台 UI 范围。
