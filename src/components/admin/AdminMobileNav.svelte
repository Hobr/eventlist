<script lang="ts">
    import CheckCircle2 from "@lucide/svelte/icons/check-circle-2";
    import CircleOff from "@lucide/svelte/icons/circle-off";
    import Inbox from "@lucide/svelte/icons/inbox";
    import Menu from "@lucide/svelte/icons/menu";
    import Tags from "@lucide/svelte/icons/tags";
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
                class="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-subtle-foreground"
            >
                {#if item.kind === "pending"}
                    <Inbox class="size-4" aria-hidden="true" />
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

    <div class="mt-6 border-t border-border pt-5">
        <p class="text-xs font-semibold text-muted">当前管理员</p>
        <p class="mt-1 truncate text-sm font-semibold text-foreground">{adminLabel}</p>
    </div>
</SidePanel>
