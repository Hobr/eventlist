# Implement：优化首页地区与本地活动流

## 0. 基线

- [ ] 确认任务仍在 `planning`，阅读 PRD、design、前端 design-system 和 research 证据。
- [ ] 检查干净工作区并运行 TypeScript、测试和构建基线。

## 1. 查询合同

- [ ] 在 `src/lib/db/queries.ts` 用 `HomepageDiscovery` 替代首页专属 `HomepageNearby` 类型。
- [ ] 实现 `listHomepageDiscovery()` 的 today-through-14-days featured + unbounded today 两条 batch 查询，复用地区匹配和稳定事件选择字段。
- [ ] 主推荐保留 `NOT EVENT_ENDED_CLAUSE`，允许今天尚未结束的活动入选；今日列表不排除该活动，也不套用当前时刻结束判断。
- [ ] 确认 today 查询不使用当前时刻结束判断，且不改变 `listPublishedEvents()` 与 `listHomepagePopularity()`。
- [ ] 运行 TypeScript 与测试。

## 2. 导航地区入口

- [ ] 新增紧凑公开地区入口组件，复用 `SidePanel`、`CitySelector` 和 Flowbite 地图图标。
- [ ] 在 `Layout.astro` 增加可选 `nav-control` slot，并删除公开站名前圆形“同”标志。
- [ ] 确认移动端 390px 下站名、地区入口和菜单按钮不会互相挤压；其他公开页面不渲染地区入口。
- [ ] 验证选择地区仍写入原 storage key、导航到 `/?city=...`，Escape 后焦点恢复。

## 3. 首页信息架构

- [ ] 将首页数据改为 `listHomepageDiscovery()` + 原热门查询的独立容错加载。
- [ ] 删除大型地区块、旧附近日期分组及其未使用 import/变量。
- [ ] 保留 hero，且主推荐从今天起 14 天内当前尚未结束的活动中选择；更新锚点为热门/今日。
- [ ] 将热门模块移到今日模块之前，保持本地/全国与 `3 / 7 / 30` 合同。
- [ ] 渲染全部今日本地活动、错误/空状态，以及仅带 `city` 的底部目录 CTA。

## 4. 质量检查

- [ ] `corepack pnpm exec prettier --check .`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm exec tsc --noEmit`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm build`
- [ ] `git diff --check`
- [ ] 确认 diff 不包含 API、schema、迁移、后台或活动目录合同变化。

## 5. 浏览器验收

- [ ] 在约 390x844、768x1024、1440x1000 检查首页，无页面级水平溢出、文字遮挡或布局跳动。
- [ ] 检查地区 Drawer 打开/关闭、Escape、焦点恢复、长地区名、亮暗模式与减少动效。
- [ ] 用有今日活动和无今日活动的地区检查列表、空状态与底部 CTA URL。
- [ ] 检查热门时间范围切换继续保留当前 `city` 并定位 `#popular`。

## 6. 收尾

- [ ] 运行 Trellis check，修复经源码确认的问题。
- [ ] 判断并同步 `.trellis/spec/frontend/design-system.md` 中过时的首页结构约定。
- [ ] 提交、归档任务并记录会话。

## 回滚点

- 查询批次失败：回退 `HomepageDiscovery`，热门查询保持不动。
- 导航断点失败：回退 nav slot 与紧凑入口，不影响首页查询。
- 首页结构失败：保留新查询与地区入口，单独回退 section 顺序和列表标记。
