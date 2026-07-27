# Implement：优化首页导航、活动展示与必填标注

## 0. 基线

- [ ] 确认任务状态为 `planning`，阅读 PRD、design、research 与前后端相关 spec。
- [ ] 检查工作区边界并记录基线测试状态。

## 1. 首页查询与展示

- [ ] 在 `listHomepageDiscovery()` 的 today 查询稳定排序后增加 `LIMIT 10`。
- [ ] 更新 `test/homepage-discovery.test.ts`，断言 today SQL 精确限制 10 条，同时保留日期、地区、排序和不按当前时间排除的合同。
- [ ] 删除 Hero 后的热门/今日锚点导航及未使用图标导入。
- [ ] 更新今日区说明文案，避免“全部活动”表述。
- [ ] 移除 CTA 容器多余顶边，仅保留列表或空状态的一条分隔线。
- [ ] 确认 CTA 仍为 `/events?city=<divisionCode>`。

## 2. 公共导航布局

- [ ] 将 `Layout.astro` 公共导航胶囊改为移动两列、桌面三列 grid。
- [ ] 桌面验证品牌左对齐、主导航几何居中、首页地区入口右对齐。
- [ ] 验证非首页无地区入口，移动端地区入口与菜单按钮同时可见。

## 3. 必填字段标注

- [ ] 为 `SelectField.svelte`、`DivisionPicker.svelte` 增加 opt-in `showRequiredIndicator`，地区组合控件只显示一次标注。
- [ ] 为公开投稿页的 9 个现有必填字段启用中文“必填”标注，选填字段保持无标注。
- [ ] 为 `AdminEventForm.astro` 增加默认关闭的 `showRequiredIndicators`，覆盖所有既有基础必填字段。
- [ ] 为 `TagInput.svelte` 增加 opt-in 标签标注；管理员新建页启用基础字段和规范标签标注。
- [ ] 确认管理员编辑页未启用页面级必填标注，表单字段名、required 属性与 API 行为不变。

## 4. Spec 同步

- [ ] 更新 `.trellis/spec/frontend/design-system.md`：删除直接锚点要求，记录桌面三段导航、今日最多 10 条、单分割线和 opt-in 必填标注合同。
- [ ] 更新 `.trellis/spec/backend/database-guidelines.md`：将 `HomepageDiscovery.today` 从无上限完整列表改为稳定排序的最多 10 条，并更新测试要求。

## 5. 自动化质量检查

- [ ] `corepack pnpm exec prettier --check .`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm exec tsc --noEmit`
- [ ] `corepack pnpm test`
- [ ] `corepack pnpm build`
- [ ] `git diff --check`
- [ ] 运行禁用依赖/符号扫描，确认没有引入新的 UI 运行时或改变表单/API 路径。

## 6. 浏览器验收

- [ ] 在约 390x844、768x1024、1440x1000 检查首页导航和内容，无横向溢出、遮挡或异常换行。
- [ ] 检查长地区名、地区 Drawer 打开/关闭、Escape 与焦点恢复。
- [ ] 检查有 10 条以上今日活动时首页只显示 10 条，CTA 保留当前地区并可进入活动目录。
- [ ] 检查今日有数据和空状态时，CTA 上方都只有一条分割线。
- [ ] 检查公开投稿页和管理员新建页所有必填标注；确认管理员编辑页未新增页面级标注。

## 7. 收尾

- [ ] 运行 Trellis check 并修复经源码确认的问题。
- [ ] 精确提交本任务文件，归档任务并记录会话。

## 回滚点

- 首页查询失败：回退 SQL `LIMIT 10`、测试与对应 spec。
- 导航布局失败：只回退 `Layout.astro` grid，不动地区选择器状态逻辑。
- 表单标注失败：回退 opt-in props 和页面传参，不影响验证或持久化。
