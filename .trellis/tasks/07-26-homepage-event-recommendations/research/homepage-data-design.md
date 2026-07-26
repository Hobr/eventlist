# 首页推荐数据方案研究

## 研究问题

现有 Astro + Cloudflare D1 应用如何支持数量受控、按日期组织的首页推荐，以及近 3/7/30 日独立 IP 热度排行，同时不虚构活动时间、不存储原始 IP，也不引入新的分析服务？

## 仓库证据

- `src/pages/index.astro` 当前为一个地区获取 8 场尚未结束的活动，使用 `sort: "start_asc"`，把第一场带封面的活动作为主推荐，再展示 4 场紧凑活动。
- `src/lib/db/queries.ts` 对开始日期相同的活动使用事件 ID 排序；其中没有主推荐、日期分组、访问记录或热度查询。
- `src/lib/events/datetime.ts` 定义日期必填、时间分别可空；只显示日期已经是受支持的公共行为。
- `migrations/0001_init.sql` 是部署前唯一的 D1 基线。数据库使用 SQLite `STRICT` 表、预处理语句、明确约束和索引。
- `.trellis/spec/backend/database-guidelines.md` 要求使用中国本地日期、用 `db.batch()` 处理多语句操作，并在首次生产部署前将修改合并回 `0001_init.sql`。
- `src/pages/events/[id].astro` 负责服务端渲染的公开活动查询，但目前没有访问写入副作用。
- `src/pages/api/submit.ts` 已读取 `CF-Connecting-IP`，但只把它传给 Turnstile；当前应用代码没有存储该请求头。
- `src/components/CitySelector.svelte` 根据 `action` 属性构造 URL，否则会丢弃无关查询字段，因此首页需要在 `action` 中包含当前热度窗口。
- 仓库没有自动化测试框架。目前验证依靠 D1 迁移和测试数据命令、TypeScript、lint/build 门禁，以及直接路由和视觉检查。

## 平台适配结论

D1 是合适的数据所有者，因为输出需要关联已发布活动、精确区分本地和全国范围、支持滑动日历窗口，并提供确定的 SQL 排序。Analytics Engine 会引入第二个数据面，也不会简化精确的单活动去重。KV 则会产生围绕 D1 活动目录的缓存失效问题。

方案只使用 D1 预处理语句和 Workers 运行时提供的 Web Crypto，不依赖特定付费方案的 D1 功能、只读副本或长时间会话。

## 匿名访问合同建议

1. 活动详情页成功渲染并在浏览器执行后，向同源 `POST /api/events/:id/view` 发送后台请求。不执行页面 JavaScript 的爬虫和预取不会计数。
2. 路由只接受安全的正整数活动 ID 和同源浏览器请求。它读取 `CF-Connecting-IP`，但绝不记录原始值，也不把它传入 D1。
3. Web Crypto 使用名为 `VIEW_HASH_SECRET` 的部署密钥，根据 `event_id + IP` 计算 HMAC-SHA-256 键。输入包含活动 ID，使数据库内不同活动的访客键无法相互关联。
4. D1 为每个 `(event_id, visitor_key)` 存储一行中国本地 `last_seen_date`。同一天内的重复访问不会重复刷新。
5. 同一批请求会顺便删除超出 30 日保留窗口的数据；排行不需要更旧的标识符。
6. 热度查询统计 `last_seen_date` 位于所选 3、7 或 30 个自然日内的访客键。主键保证每场活动按访客唯一。
7. 缺少 IP 或密钥时不计数，但绝不阻塞详情页。统计请求返回可由直接检查发现的运行错误状态。

## 建议的数据表

```sql
CREATE TABLE event_visitors (
    event_id INTEGER NOT NULL,
    visitor_key TEXT NOT NULL CHECK (length(visitor_key) = 64),
    last_seen_date TEXT NOT NULL CHECK (
        date(last_seen_date) IS NOT NULL
        AND last_seen_date = date(last_seen_date)
    ),
    PRIMARY KEY (event_id, visitor_key),
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX idx_event_visitors_recent
    ON event_visitors(last_seen_date, event_id);
```

活动级 HMAC 键是伪匿名标识，并非密码学意义上的完全匿名，因此仍需坚持 30 日保留边界。

## 首页查询形态

- 主推荐：当前地区、已发布且尚未结束、从今天到未来第 14 天开始；依次按规模降序、开始日期升序、是否有封面降序和 ID 排序。
- 正在进行：当前地区、今天以前开始、今天或以后结束，并且根据现有中国本地时间规则仍未结束；最多 4 场。
- 日期分组：当前地区、今天或以后开始；使用窗口函数选择最近 3 个不同开始日期，提供每个日期的总数，并返回最多 5 个候选，以便移除主推荐后再取 4 场。
- 同日顺序：规模降序，然后活动 ID 升序。可选时间和封面不参与排序。
- 热度：先按所选窗口聚合 `event_visitors`，再关联已发布且尚未结束的活动；依次按独立访客数降序、规模降序、开始日期升序和 ID 排序；本地和全国语句通过一次 D1 批处理执行。

## 活动目录 URL 缺口

现有 `from` 和 `to` 筛选无法准确表达“开始日期正好是这一天”或“在这一天处于活动期”的跨日活动。新增明确的 `starts=YYYY-MM-DD` 和 `active=YYYY-MM-DD` 查询合同，在 `FilterBar` 中保留它们并显示可移除标签。现有筛选语义保持不变。

## 验证影响

- 扩展开发种子数据或使用任务专用测试数据，覆盖同日、缺失时间、正在进行、大量活动和访问记录。
- 在新的临时持久化目录中应用改写后的基线；现有本地迁移记录可能掩盖数据库结构错误。
- 通过 D1 查询和直接路由检查验证表约束、主键去重、保留期限、本地/全国排行、窗口边界、已结束活动排除和确定性同分排序。
- 将构建、lint 和类型门禁与移动端、平板和桌面浏览器检查结合；项目按约定不引入 Playwright。

## 已查阅资料

- `.trellis/spec/backend/database-guidelines.md`
- `.trellis/spec/backend/error-handling.md`
- `.trellis/spec/frontend/design-system.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
- `.trellis/spec/guides/code-reuse-thinking-guide.md`
- Cloudflare 技能参考：`references/d1/README.md`、`api.md`、`patterns.md` 和 `gotchas.md`
