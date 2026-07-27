# Design：优化首页地区与本地活动流

## 1. 边界

本任务只调整公开首页、公开导航中的首页专属插槽和内部 D1 查询帮助函数。活动目录查询参数、热门统计、后台和持久化 schema 保持不变。

```text
resolveSelectedDivision()
          |
          +--> compact nav location picker --> CitySelector --> /?city=...
          |
          +--> listHomepageDiscovery(db, divisionCode)
          |        |--> featured: today .. +14 days and not ended, limit 1
          |        `--> today: all published events active on China-local today
          |
          `--> listHomepagePopularity(db, divisionCode, window)
```

## 2. 导航地区入口

- `Layout.astro` 增加可选的 `nav-control` 命名 slot，并在品牌与页面导航之间渲染；其他页面未提供 slot 时 DOM 和行为保持现状。
- 新增一个公开地区入口 Svelte 组件，使用紧凑 trigger + 共享 `SidePanel`。Trigger 显示地图图标和当前地区短标签，抽屉内容复用 `CitySelector`。
- 首页把当前 `selectedDivisionCode`、当前地区标签和来源说明传给该组件；选择后仍由 `CitySelector` 写入 `eventlist.divisionCode` 并导航到首页查询 URL。
- 移动端 trigger 允许只显示最末级地区名，完整路径保留在 accessible name 和抽屉标题中；稳定宽度与 `truncate` 防止挤压菜单按钮。
- 公开导航品牌链接删除圆形标志，但保留站名和桌面口号。管理布局不改。

## 3. 首页查询合同

- 用 `HomepageDiscovery` 替代只服务首页的 `HomepageNearby` 合同：
  - `featured: EventRecord | null`
  - `today: EventRecord[]`
- `listHomepageDiscovery()` 使用一次 `db.batch()`：
  - 主推荐限定当前尚未结束，且 `date(start_date) >= today`、`<= today + 14 days`，保持规模、日期、真实封面优先的稳定排序并 `LIMIT 1`。这允许今天正在举行的活动成为首屏推荐。
  - 今日列表限定已发布、当前地区、`date(start_date) <= today` 和 `date(end_date) >= today`，不套用 `EVENT_ENDED_CLAUSE`，不设置 `LIMIT`。
- 主推荐与今日列表采用不同职责：前者突出一个当前可参与的重点活动，后者保证今日活动完整性。因此主推荐若属于今天，仍保留在今日列表中，不做跨区域去重。
- 今日列表按跨日活动优先、同日已知开始时间、规模和 id 稳定排序；缺少时间不影响是否展示。
- `listHomepagePopularity()` 保持原合同和查询不变。

## 4. 首页结构

- Hero 继续使用 `discovery.featured`；无可用推荐时显示现有本地位图和空状态。
- 删除大型 CitySelector 区块、旧 nearby 变量、日期分组格式化和“附近活动”section。
- Hero 下的锚点改为 `#popular` 与 `#today`。
- 热门模块先渲染，保持现有 segmented control 和双列排行。
- 今日模块使用 `EventCard variant="row"` 连续渲染所有结果；列表尾部 CTA 使用仅含 `city` 的 `eventsHref()`。

## 5. 错误与空状态

- 地区无法解析：地区入口显示“选择地区”，今日区域显示无法确定地区；热门保留现有错误状态。
- 今日查询失败：热门数据仍可显示，今日区域显示独立错误，不让一个查询失败吞掉另一个查询结果。
- 今日为空：显示当前地区今天暂无活动，并保留进入本地活动目录的 CTA。
- 主推荐为空：使用 `event-fallback.webp` 和进入目录操作，不从今日列表复制一项填充。

## 6. 响应式与无障碍

- nav slot、品牌、桌面导航和移动菜单使用稳定 flex shrink 规则；390px 下地区 trigger 与菜单按钮同时可见。
- 地区 trigger 有 `aria-haspopup="dialog"`、完整地区 accessible name、可见 focus；Drawer 继续支持 Escape 与焦点恢复。
- 今日列表保持稳定媒体比例，长中文标题换行，不使用横向滚动作为默认布局。

## 7. 回滚

- 导航入口出现断点问题时，可单独回退 `nav-control` slot 与新组件，临时恢复首页内紧凑地区行。
- 今日查询出现数据问题时，可回退 `HomepageDiscovery` 为旧 `HomepageNearby`，热门模块不受影响。
- 整体回滚不涉及 schema、迁移、API 或后台数据。
