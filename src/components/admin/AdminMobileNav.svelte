<script lang="ts">
    import Menu from "phosphor-svelte/lib/List";
    import SidePanel from "../ui/side-panel.svelte";
    import AdminNavList from "./AdminNavList.svelte";

    interface Props {
        currentPath: string;
        title: string;
        adminLabel: string;
    }

    let { currentPath, title, adminLabel }: Props = $props();
</script>

<SidePanel
    title="管理导航"
    description={title}
    triggerClass="admin-menu-trigger"
    contentClass="admin-menu-panel"
>
    {#snippet trigger()}
        <Menu size={17} aria-hidden="true" />
        菜单
    {/snippet}

    <nav class="admin-mobile-nav" aria-label="移动端管理导航">
        <AdminNavList {currentPath} variant="mobile" />
    </nav>

    <div class="admin-mobile-identity">
        <p>当前管理员</p>
        <strong>{adminLabel}</strong>
    </div>
</SidePanel>
