<script lang="ts">
    import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Tone = "default" | "primary" | "accent" | "warning" | "outline" | "danger";
    type Shared = { tone?: Tone; class?: string; children?: import("svelte").Snippet };
    type Props = Shared &
        (
            | ({ href: string } & Omit<HTMLAnchorAttributes, "children" | "class" | "href">)
            | ({ href?: undefined } & Omit<HTMLAttributes<HTMLSpanElement>, "children" | "class">)
        );

    let {
        tone = "default",
        href = undefined,
        class: className = undefined,
        children,
        ...restProps
    }: Props = $props();
</script>

{#if href}
    <a {...restProps} {href} class={cn("ui-badge", className)} data-tone={tone}>
        {@render children?.()}
    </a>
{:else}
    <span {...restProps} class={cn("ui-badge", className)} data-tone={tone}>
        {@render children?.()}
    </span>
{/if}
