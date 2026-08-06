<script lang="ts">
    import CircleCheck from "phosphor-svelte/lib/CheckCircle";
    import FileSpreadsheet from "phosphor-svelte/lib/FileCsv";
    import Plus from "phosphor-svelte/lib/Plus";
    import Tags from "phosphor-svelte/lib/Tag";
    import Inbox from "phosphor-svelte/lib/Tray";
    import CircleOff from "phosphor-svelte/lib/XCircle";
    import { ADMIN_NAV_ITEMS, isAdminNavItemActive } from "./navigation";

    interface Props {
        currentPath: string;
        variant?: "desktop" | "mobile";
    }
    let { currentPath, variant = "desktop" }: Props = $props();
</script>

<div class="admin-nav-list" data-variant={variant}>
    {#each ADMIN_NAV_ITEMS as item (item.href)}
        <a
            href={item.href}
            class="admin-nav-link"
            aria-current={isAdminNavItemActive(currentPath, item.href) ? "page" : undefined}
        >
            {#if item.kind === "pending"}
                <Inbox size={17} aria-hidden="true" />
            {:else if item.kind === "create"}
                <Plus size={17} aria-hidden="true" />
            {:else if item.kind === "bulk"}
                <FileSpreadsheet size={17} aria-hidden="true" />
            {:else if item.kind === "published"}
                <CircleCheck size={17} aria-hidden="true" />
            {:else if item.kind === "offline"}
                <CircleOff size={17} aria-hidden="true" />
            {:else}
                <Tags size={17} aria-hidden="true" />
            {/if}
            <span>{item.label}</span>
        </a>
    {/each}
</div>
