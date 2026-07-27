<script lang="ts">
    import {
        BarsOutline as Menu,
        CheckCircleOutline as CheckCircle2,
        CloseCircleOutline as CircleOff,
        FileCsvOutline as FileSpreadsheet,
        InboxOutline as Inbox,
        PlusOutline as Plus,
        TagOutline as Tags
    } from "flowbite-svelte-icons";
    import SidePanel from "../ui/side-panel.svelte";
    import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from "./navigation";

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
        {#each ADMIN_NAV_ITEMS as item (item.href)}
            <a
                href={item.href}
                aria-current={isAdminNavItemActive(currentPath, item.href) ? "page" : undefined}
                class="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-[transform,background-color,color] duration-300 ease-motion hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.99] aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-subtle-foreground"
            >
                {#if item.kind === "pending"}
                    <Inbox class="size-4" aria-hidden="true" />
                {:else if item.kind === "create"}
                    <Plus class="size-4" aria-hidden="true" />
                {:else if item.kind === "bulk"}
                    <FileSpreadsheet class="size-4" aria-hidden="true" />
                {:else if item.kind === "published"}
                    <CheckCircle2 class="size-4" aria-hidden="true" />
                {:else if item.kind === "offline"}
                    <CircleOff class="size-4" aria-hidden="true" />
                {:else}
                    <Tags class="size-4" aria-hidden="true" />
                {/if}
                {item.label}
            </a>
        {/each}
    </nav>

    <div class="mt-6 border-t border-border/80 pt-5">
        <p class="text-xs font-semibold text-muted">当前管理员</p>
        <p class="mt-1 truncate text-sm font-semibold text-foreground">{adminLabel}</p>
    </div>
</SidePanel>
