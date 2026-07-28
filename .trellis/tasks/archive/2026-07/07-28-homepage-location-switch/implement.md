# Implementation Plan

## Ordered Checklist

### Public Data And API

- [ ] 在 `src/lib/public/homepage.ts` 增加公开地区、今日行活动和完整首页快照类型及逐字段投影，复用现有主推荐/热门投影。
- [ ] 新增 `GET /api/homepage`，严格验证 `city`/`trend`，并行复用 `listHomepageDiscovery()` 与 `listHomepagePopularity()`，成功返回单一公开快照，失败返回稳定 400/500 JSON。
- [ ] 新增 `src/lib/public/homepage-client.ts`，实现响应运行时校验、地区+窗口缓存键、URL/history 元数据 helper 和跨岛事件常量/类型。
- [ ] 扩展 `test/public-homepage.test.ts`，断言今日/完整快照字段白名单、首页 API 校验和稳定错误；新增纯 helper 测试覆盖无效响应、URL 与 history state 合并。

### Location Picker And History

- [ ] 为 `SidePanel.svelte` 增加默认向后兼容的 bindable `open` prop，保持关闭后焦点恢复合同。
- [ ] 为 `CitySelector.svelte` 增加 `navigateOnChange`/`onchange` 受控模式；默认即时导航行为保持不变，首页实例只更新待应用值。
- [ ] 重构 `NavLocationPicker.svelte`：维护已生效/待应用地区、应用按钮、Spinner、错误与普通导航回退；成功前不改导航标签、URL 或 localStorage。
- [ ] 实现地区请求的 AbortController + 请求序号防竞态，并在卸载时清理。
- [ ] 实现主动应用 `pushState`、已保存地区恢复 `replaceState`、初始 history 元数据和 `popstate` 无刷新恢复；恢复失败回退普通导航。
- [ ] 更新 `division-preference.ts` 的纯偏好读写 helper 与现有测试，避免在异步成功前写入存储。

### Homepage Content Island

- [ ] 新增 `HomepageContent.svelte`，服务端渲染并统一拥有主推荐、热门、今日和地区快照；监听一次成功事件后原子替换数据。
- [ ] 调整 `FeaturedEventCarousel.svelte`，在地区/候选集合变化时重置索引和旧轮播状态，并维持高度、暂停、封面回退和可访问性合同。
- [ ] 调整 `HomepagePopularity.svelte`，响应父级地区 props，按 `city:window` 缓存，地区切换时中止旧请求，并同步 history 元数据。
- [ ] 从 `EventCard.astro` 提取 `variant="row"` 为共享 `EventRow.svelte`；新增 `HomepageToday.svelte` 复用它，保持现有标题、空状态、标签、封面、分割线和目录 CTA。
- [ ] 更新 `src/pages/index.astro`，继续服务端解析/查询并投影初始快照，使用一个 `HomepageContent client:load`，导航地区入口接收初始地区和窗口元数据。

### Specs And Verification

- [ ] 更新 `.trellis/spec/frontend/design-system.md`：地区侧栏应用行为、首页单一快照、跨岛事件、history/popstate、地区化热门缓存和共享 EventRow 合同。
- [ ] 更新 `.trellis/spec/backend/error-handling.md`：`GET /api/homepage` 参数、envelope、全有或全无失败和字段白名单。
- [ ] 如数据库规范需要引用首页快照聚合，更新 `.trellis/spec/backend/database-guidelines.md`，但不改变现有查询语义。
- [ ] 运行聚焦测试、完整质量门和响应式浏览器检查。

## Validation Commands

```bash
corepack pnpm test test/division-preference.test.ts
corepack pnpm test test/public-homepage.test.ts
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
git diff --check
```

按项目约定启动开发服务器：

```bash
corepack pnpm exec astro dev --background
corepack pnpm exec astro dev status
corepack pnpm exec astro dev logs
```

在 `390x844`、`768x1024` 和 `1440x900` 验证：

- 省、市、区县选择不触发请求或导航，应用按钮只在有效待应用值时工作；
- 应用地区期间旧内容和滚动位置保持，成功后导航标签、Hero、热门、今日和目录链接同步；
- 目标地区有零、单、多主推荐时轮播状态正确，旧索引/暂停/计时器不泄漏；
- 3/7/30 日切换在新地区请求正确 API，返回旧地区再切换时缓存不串用；
- 快速应用两个地区只提交最后一个；失败保留旧地区并提供可用回退链接；
- 主动地区切换产生 history entry，热门窗口不产生额外 entry，返回/前进无刷新恢复地区和窗口；
- URL 无 city 且存在已保存偏好时无刷新恢复；显式 URL city 仍优先；
- 侧栏成功后关闭并恢复触发器焦点，加载/错误有可访问状态；
- 页面没有横向溢出、重复分割线或内容跳动。

使用 curl/网络面板验证：

- `/api/homepage` 无效 `city`/`trend` 返回 400 JSON；
- 有效响应包含统一地区、主推荐、热门和今日快照；
- 响应不含 `submitter_contact`、`source_url`、`tag_suggestions`、`reject_reason`、`status`；
- 模拟 D1/运行时失败时返回稳定 500，不泄漏内部异常。

## Risky Files And Rollback Points

- `src/components/NavLocationPicker.svelte`：跨岛请求、历史和偏好提交的唯一所有者；不得在响应成功前修改已生效状态。
- `src/components/HomepageContent.svelte`：三个首页区块的原子快照边界；不得让子组件各自解析不同地区。
- `src/components/HomepagePopularity.svelte`：现有无刷新窗口功能不能因地区响应式 props 回归。
- `src/components/EventCard.astro` / `EventRow.svelte`：目录页和首页共享行变体，必须验证两处视觉及链接。
- `src/lib/public/homepage.ts` / `/api/homepage`：公开序列化边界，禁止完整记录对象展开。
- `history.state` helper：必须保留第三方/浏览器已有 state 字段，不得用裸对象覆盖。
- `popstate`：失败时必须恢复 URL/内容一致性，不能停留在旧内容配新 URL。

如果任一跨层检查失败，先回退最后一个独立边界，不使用 reset/checkout 覆盖任务外改动。

## Review Gates Before Activation

- PRD 明确局部更新、应用按钮、原子三模块切换、成功后 URL/偏好、history/popstate、失败回退和无 ClientRouter。
- 设计对公开 DTO、API、跨岛事件、EventRow 复用、热门缓存键和初始保存偏好恢复给出单一合同。
- `implement.jsonl` 与 `check.jsonl` 各含真实规范/研究条目。
- 用户明确批准本次最终规划摘要后，才运行 `task.py start`。
