# 最终验收记录

## 浏览器

- `1440x1000`：`/`、`/events`、`/events/28`、`/submit`、`/404`、`/admin/login` 均无页面级水平溢出、可见文字裁切或应用控制台错误。
- `768x1024`：相同入口均无水平溢出、断点重叠或可见图片失败；首页与目录的桌面导航、媒体和筛选布局正常。
- `390x844`：相同入口均无水平溢出或可见文字裁切；长活动标题、地区三级选择、详情 facts、投稿表单和 404 操作均正确折叠。
- 移动主导航可展开为单一 Drawer；`Escape` 关闭后实测 `aria-expanded=false`、无 open dialog，焦点返回“打开主导航”按钮。
- 远程封面加载失败时保留本地 `event-fallback.webp`；首屏与详情媒体尺寸稳定。

## 自动检查

- `corepack pnpm exec prettier --check .`：通过。
- `corepack pnpm lint`：通过。
- `corepack pnpm exec tsc --noEmit`：通过。
- `corepack pnpm test`：14/14 通过。
- `corepack pnpm build`：通过，`/404.html` 成功预渲染。
- `git diff --check`：通过。
- 禁止库、旧 Material token、`initFlowbite()`、`ease-in-out`、`100vh`、独立 `h-screen`、紫蓝渐变、任意 z-index、死 `href="#"` 和模板文案搜索无有效命中；`Inter` 仅作为 `IntersectionObserver` 的子串出现。

## 范围

- 任务 diff 限于前端表现层、Geist 字体依赖、Trellis 任务/规范与本地 pnpm store ignore。
- `flake.lock` 的工作区变化不属于本任务，提交时排除。
