# 首页活动推荐实现计划

## 前置条件

- 重新检查 `git status`，保留共享工作区中无关的 `07-26-admin-bulk-create-events` 任务和规范索引改动。
- 编辑 `0001_init.sql` 前确认它仍是尚未部署的基线。如果已有生产迁移历史，返回规划阶段设计追加迁移。
- 修改产品代码前，读取 `implement.jsonl` 中配置的规范和研究材料。

## 实现清单

1. **数据库结构与运行时合同**
   - 在 `migrations/0001_init.sql` 中添加 `event_visitors`、相关约束、外键和近期日期索引。
   - 在本地运行时环境类型中加入 `VIEW_HASH_SECRET`，但不在 `wrangler.jsonc` 中写入值。
   - 在现有部署文档中说明密钥配置、轮换/重置行为和匿名数据 30 日保留合同。

2. **热度领域逻辑与持久化**
   - 在 `src/lib/events/` 下添加唯一一份共享的 `PopularityWindow` 解析器和活动级 HMAC 帮助函数。
   - 在 D1 查询所有者中添加有类型的访问记录和热度查询函数，使用预处理语句和 `db.batch()`。
   - 集中定义规模排序和中国本地日期表达式，避免主推荐、日期分组和热度查询产生规则漂移。

3. **访问采集接口**
   - 新增 `POST /api/events/[id]/view`，校验正整数 ID、同源请求、IP 和密钥。
   - 确保原始请求头在进入数据库代码前完成哈希，且绝不写入日志或序列化输出。
   - 在详情页添加非可视统计信标，只为有效公开活动执行，且不能阻塞页面渲染。

4. **活动目录精确日期链接**
   - 为 `PublishedEventFilters` 和 `listPublishedEvents` 增加 `starts` 与 `active` 日期筛选。
   - 在 `/events` 解析新字段，在 `FilterBar` 中保留并显示可移除条件，同时保持现有 `from`/`to` 行为不变。

5. **首页数据查询**
   - 实现当前地区、未来 14 天范围内的确定性紧凑主推荐选择。
   - 实现数量受控的正在进行结果，以及最近 3 个开始日期的分组；每个日期提供总数和最多 5 个候选。
   - 在页面编排中移除主推荐 ID，并把每个实际渲染分组限制为 4 场。
   - 实现共用时间窗口、各最多 5 场的本地和全国热度查询。

6. **首页界面**
   - 解析 `trend`，切换城市时保留它，切换热度窗口时保留 `city`。
   - 将过大的主推荐改为尺寸受控的紧凑布局，并显示可见推荐理由。
   - 渲染页内跳转、可选的正在进行行、自然日期分组、精确目录链接和当前地区完整目录入口。
   - 渲染 3/7/30 日控制、本地/全国榜单，以及明确的冷启动和查询错误状态。
   - 只在现有变体仍保持清晰时复用或扩展 `EventCard`；名次、数量和日期分组业务标记不能进入通用 `ui/` 组件。

7. **测试数据与回归覆盖**
   - 扩展开发数据或增加任务专用 SQL 数据，覆盖超过 100 场匹配活动、相同开始日期、空时间、正在进行的跨日活动、主推荐有/无封面同分、本地/全国访问、重复访客键和已结束活动。
   - 在新的临时持久化目录中验证完整基线。
   - 断言精确日期筛选、数量上限、总数、去重、3/7/30 日边界、确定性排序和原始 IP 不落库。

8. **质量与视觉验证**
   - 运行 `corepack pnpm lint`；如果遇到已知 TypeScript/ESLint 加载器上游问题，将其与应用错误分开记录。
   - 运行 `corepack pnpm exec tsc --noEmit`。
   - 运行 `corepack pnpm build`。
   - 使用 `corepack pnpm exec astro dev --background` 启动服务器，并通过 `astro dev status/logs/stop` 管理生命周期。
   - 使用应用内浏览器在约 390x844、768x1024、1440x1000 下检查首页、目录和详情页。验证无水平溢出、控件尺寸稳定、页内跳转焦点、缺失时间文案、冷启动状态和明暗配色。
   - 直接查询临时/本地 D1，并使用受控的 `CF-Connecting-IP` 值请求访问接口，验证计数结果。

9. **最终审查与回滚准备**
   - 根据 PRD 验收标准和前后端规范审查完整差异。
   - 确认没有修改无关的后台任务或规范索引改动。
   - 格式化后重新运行生产构建。
   - 如果热度统计不稳定，移除信标/接口并隐藏热度展示，同时保留附近发现；不得执行破坏性的远程数据库回滚。

## 验证命令

```bash
tmp_dir=$(mktemp -d)
corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp_dir"
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm exec astro dev --background
corepack pnpm exec astro dev status
corepack pnpm exec astro dev logs
corepack pnpm exec astro dev stop
```

D1 数据库结构/查询断言和 HTTP 探测应在相关文件创建后，使用明确的任务测试数据路径和受控请求头；普通验证不得连接远程数据库。

## 高风险文件与回滚点

- `migrations/0001_init.sql`：只有在基线尚未部署时才能安全改写。
- `src/lib/db/queries.ts`：首页、目录、详情、投稿和后台流程共同使用；必须回归检查所有现有公开查询。
- `src/components/FilterBar.svelte`：增加 `starts` 和 `active` 时必须保留每个既有 URL 字段。
- `src/pages/events/[id].astro`：统计信标必须与详情渲染和 SEO 输出相互独立。
- `src/pages/index.astro` 和 `EventCard.astro`：视觉修改必须保留空状态/错误状态，不能再次撑大首屏。
