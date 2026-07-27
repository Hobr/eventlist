# 更新全站品牌文案为同频点

## Goal

将网站面向访客和管理员展示的品牌名称统一为“同频点”，并统一使用 Slogan
“从同屏到同点, 让兴趣同频”，避免公共站点、后台和页面元数据继续出现旧品牌。

## Background

- 当前公共布局、管理布局和管理登录页仍使用旧品牌“野活网”。
- 公共页头还使用“ACG 活动日历”作为品牌副标题，页脚使用旧文案“按城市发现，按兴趣出发”。
- README 已包含“同频点”和新 Slogan。
- “ACG 活动目录”“活动列表”等文字用于描述网站内容或功能，不属于旧品牌名称。

## Requirements

- 公共站点的默认页面标题、组合页面标题、页头品牌和页脚品牌必须使用“同频点”。
- 公共页头的品牌副标题和页脚 Slogan 必须使用“从同屏到同点, 让兴趣同频”。
- 公共布局的默认 meta description 必须反映新品牌 Slogan。
- 管理后台布局与登录页的页面标题、meta description 和可见品牌名称必须使用“同频点”。
- 保留 ACG 活动目录、页面名称、导航名称和业务说明等非品牌文案。
- 不覆盖当前工作区内与本任务无关的 Flowbite 迁移及其他用户改动。

## Acceptance Criteria

- [x] 公共首页页头和页脚均显示“同频点”。
- [x] 公共页头和页脚均显示完整 Slogan“从同屏到同点, 让兴趣同频”。
- [x] 公共页面 `<title>` 使用“同频点”作为站点品牌后缀，默认 description 使用新 Slogan。
- [x] 管理后台及管理员登录页的可见品牌、`<title>` 和 description 均使用“同频点”。
- [x] 产品代码中不再出现“野活网”或旧 Slogan“按城市发现，按兴趣出发”。
- [ ] 项目 lint 与 build 检查通过。

## Validation

- `corepack pnpm exec prettier --check ...`：通过。
- `corepack pnpm test`：通过，4 个测试全部成功。
- `corepack pnpm build`：通过。
- HTTP 验证：首页和管理登录页正确输出新品牌与元数据，旧文案为 0。
- `corepack pnpm lint`：Prettier 通过；ESLint 在加载项目配置前失败。当前 TypeScript
  7.0.2 不受 `typescript-eslint` 8.65.0 支持，Node 22.23.1 与 Node 24.18.0 下均可复现。

## Out of Scope

- 不修改活动数据、业务术语、导航结构或页面功能。
- 不修改 GitHub 仓库地址、包名、路由、数据库名称或部署配置。
- 不重新设计 favicon 或其他视觉资产。
