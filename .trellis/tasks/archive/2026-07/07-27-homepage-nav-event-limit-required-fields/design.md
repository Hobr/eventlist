# Design：优化首页导航、活动展示与必填标注

## 1. 边界

本任务分为三个实现面：公共导航布局、首页发现展示、表单标签。数据层只修改首页 today 查询上限；表单解析、API、数据库 schema 和热门统计保持不变。

```text
Layout.astro
  ├─ left: brand
  ├─ center: public nav
  └─ right: homepage location slot + mobile menu

listHomepageDiscovery()
  ├─ featured: today .. +14 days, not ended, limit 1
  └─ today: active on China-local today, stable order, limit 10

submit.astro / admin new
  └─ visible "必填" markers aligned with existing validators
```

## 2. 公共导航布局

- 将 `Layout.astro` 的导航胶囊从两端 flex 改为响应式 grid。
- 移动端使用 `minmax(0,1fr) auto`：品牌占可收缩主列，右侧容纳首页地区入口和移动菜单。
- `sm` 以上使用 `minmax(0,1fr) auto minmax(0,1fr)`：品牌位于左列，主导航固定在中列，`nav-control` 位于右列并 `justify-self-end`。
- `nav-control` 仍是可选 slot；非首页右列保持纯布局占位，不渲染空控件。
- 保持现有最大宽度、高度、胶囊背景、active 样式和焦点行为。

## 3. 首页结构与分割线

- 删除 `src/pages/index.astro` 中 Hero 后的页内 `<nav>`，同时删除 `CalendarClock` 和 `Flame` 导入。
- 热门 section 直接承接 Hero 后的正常纵向间距，不新增替代快捷入口。
- 今日有数据时，最后一条 `EventCard variant="row"` 的底边承担列表与 CTA 的分隔；空状态已有 `border-y`，其底边承担同一职责。
- CTA 容器移除 `border-t`，保留 `mt-8` 和适当上内边距，避免双线但维持呼吸空间。

## 4. 今日查询上限

- 在 `listHomepageDiscovery()` 的 today SQL 稳定排序之后增加固定 `LIMIT 10`。
- 限制在 D1 查询层完成，避免传输和渲染无用行。
- `HomepageDiscovery` 类型不变；调用方继续渲染 `discovery.today`。
- 更新今日区说明文案为“最多展示 10 场”语义；CTA 仍由无附加筛选的 `eventsHref()` 生成。
- 更新查询测试：从断言“不含 LIMIT”改为精确断言 today SQL 含 `LIMIT 10`，并继续覆盖日期条件、无当前时刻结束过滤和主推荐不去重。

## 5. 必填标注

- 可见标注统一使用短文本“必填”，采用小号 `text-danger`，与字段名同行；不能只显示裸 `*`。
- 普通 Astro `<label>` 在字段名后直接渲染标注，原生 `required` 属性保持不变。
- `SelectField.svelte` 增加独立的 `showRequiredIndicator` prop。它只控制标签展示，不改变 `required` 表单语义。
- `DivisionPicker.svelte` 增加同名 prop，在组合控件顶层“地区”标签显示一次；内部省/市/区县选择器不重复显示三次。
- `AdminEventForm.astro` 增加 `showRequiredIndicators` prop，默认 `false`；`/admin/events/new` 传入 `true`，编辑页保持当前外观。
- `TagInput.svelte` 增加独立的 `showRequiredIndicator` prop。管理员新建时标注规范标签必填，但不伪造无效的 hidden-input 原生校验；服务端仍是标签必填的最终合同。
- 公开投稿页为所有 9 个既有必填字段启用标注；选填字段不标注。

## 6. 兼容性与风险

- 导航三列布局可能被长站名或长地区名挤压；保留品牌和地区 trigger 的 `min-w-0`、`truncate` 与稳定最大宽度，并在 390/768/1440 三档验证。
- 自动根据 `required` 显示标注会扩大共享组件影响面，因此标注使用独立 opt-in prop；筛选器、地区筛选和管理员编辑页不受影响。
- 今日 `LIMIT 10` 改变已记录的“完整今日列表”规范，必须同步前后端 Trellis spec，避免未来实现恢复无上限查询。
- 不改变表单解析和 API，因此回滚仅需恢复布局、标签标记和 SQL 上限，不涉及数据迁移。

## 7. 回滚

- 导航断点失败：单独恢复 `Layout.astro` 的 flex 排列，不影响地区组件行为。
- 今日上限或顺序异常：移除 today SQL 的 `LIMIT 10` 并恢复对应测试/规范。
- 必填标注出现范围漂移：撤回 opt-in props 与页面传参，服务端验证不受影响。
