<script lang="ts">
    import { BarsOutline as Menu } from "flowbite-svelte-icons";
    import SidePanel from "../ui/side-panel.svelte";
    import AdminNavList from "./AdminNavList.svelte";

    interface Props {
        currentPath: string;
        title: string;
        adminLabel: string;
    }

    let { currentPath, title, adminLabel }: Props = $props();
</script>

<SidePanel title="管理导航" description={title} triggerClass="h-9 px-3" contentClass="max-w-xs">
    {#snippet trigger()}
        <Menu class="size-4" aria-hidden="true" />
        菜单
    {/snippet}

    <nav class="flex flex-col gap-1" aria-label="移动端管理导航">
        <AdminNavList {currentPath} variant="mobile" />
    </nav>

    <div class="mt-6 border-t border-border/80 pt-5">
        <p class="text-xs font-semibold text-muted">当前管理员</p>
        <p class="mt-1 truncate text-sm font-semibold text-foreground">{adminLabel}</p>
    </div>
</SidePanel>
