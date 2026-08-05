<script lang="ts">
    import { SidebarGroup, SidebarItem } from "flowbite-svelte";
    import {
        CheckCircleOutline as CircleCheck,
        CloseCircleOutline as CircleOff,
        FileCsvOutline as FileSpreadsheet,
        InboxOutline as Inbox,
        PlusOutline as Plus,
        TagOutline as Tags
    } from "flowbite-svelte-icons";
    import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from "./navigation";

    interface Props {
        currentPath: string;
        variant?: "desktop" | "mobile";
    }

    let { currentPath, variant = "desktop" }: Props = $props();

    const linkClass = $derived(
        variant === "desktop"
            ? "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-[transform,background-color,color] duration-300 ease-motion focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.99]"
            : "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-[transform,background-color,color] duration-300 ease-motion focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.99]"
    );
    const activeClass = $derived(
        variant === "desktop"
            ? "bg-primary-subtle text-primary-subtle-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
            : "bg-primary-subtle text-primary-subtle-foreground"
    );
    const nonActiveClass = "text-muted-foreground hover:bg-surface-subtle hover:text-foreground";
</script>

<SidebarGroup class="flex flex-col gap-1">
    {#each ADMIN_NAV_ITEMS as item (item.href)}
        <SidebarItem
            href={item.href}
            label={item.label}
            active={isAdminNavItemActive(currentPath, item.href)}
            aClass={linkClass}
            {activeClass}
            {nonActiveClass}
            spanClass="m-0"
        >
            {#snippet icon()}
                {#if item.kind === "pending"}
                    <Inbox class="size-4" aria-hidden="true" />
                {:else if item.kind === "create"}
                    <Plus class="size-4" aria-hidden="true" />
                {:else if item.kind === "bulk"}
                    <FileSpreadsheet class="size-4" aria-hidden="true" />
                {:else if item.kind === "published"}
                    <CircleCheck class="size-4" aria-hidden="true" />
                {:else if item.kind === "offline"}
                    <CircleOff class="size-4" aria-hidden="true" />
                {:else}
                    <Tags class="size-4" aria-hidden="true" />
                {/if}
            {/snippet}
        </SidebarItem>
    {/each}
</SidebarGroup>
