export const ADMIN_NAV_ITEMS = [
    { href: "/admin", label: "待审核", kind: "pending" },
    { href: "/admin/events/new", label: "增加活动", kind: "create" },
    { href: "/admin/published", label: "已发布", kind: "published" },
    { href: "/admin/offline", label: "已下线", kind: "offline" },
    { href: "/admin/tags", label: "标签归并", kind: "tags" }
] as const;

export function isAdminNavItemActive(currentPath: string, href: string) {
    if (href === "/admin") return currentPath === href;
    if (href === "/admin/events/new") return currentPath === href;
    if (
        href === "/admin/published" &&
        currentPath.startsWith("/admin/events/") &&
        currentPath !== "/admin/events/new"
    ) {
        return true;
    }
    return currentPath === href;
}
