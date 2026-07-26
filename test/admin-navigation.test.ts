import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from "../src/components/admin/navigation";

test("批量导入导航只在自身路由激活", () => {
    const activeItems = ADMIN_NAV_ITEMS.filter(({ href }) =>
        isAdminNavItemActive("/admin/events/bulk", href)
    );

    assert.deepEqual(
        activeItems.map(({ kind }) => kind),
        ["bulk"]
    );
});

test("单条创建与编辑路由保持原有激活规则", () => {
    assert.equal(isAdminNavItemActive("/admin/events/new", "/admin/events/new"), true);
    assert.equal(isAdminNavItemActive("/admin/events/new", "/admin/published"), false);
    assert.equal(isAdminNavItemActive("/admin/events/42/edit", "/admin/published"), true);
});
