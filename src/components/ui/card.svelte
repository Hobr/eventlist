<script lang="ts">
    import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Shared = { class?: string; children?: import("svelte").Snippet; size?: string };
    type Props = Shared &
        (
            | ({ href: string } & Omit<HTMLAnchorAttributes, "children" | "class" | "href">)
            | ({ href?: undefined } & Omit<HTMLAttributes<HTMLDivElement>, "children" | "class">)
        );

    let {
        class: className = undefined,
        children,
        href = undefined,
        ...restProps
    }: Props = $props();
</script>

{#if href}
    <a {...restProps} {href} class={cn("ui-card", className)}>{@render children?.()}</a>
{:else}
    <div {...restProps} class={cn("ui-card", className)}>{@render children?.()}</div>
{/if}
