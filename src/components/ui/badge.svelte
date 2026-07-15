<script lang="ts">
    import { cn } from "../../lib/utils";

    type Tone = "default" | "primary" | "accent" | "warning" | "outline" | "danger";

    interface Props {
        tone?: Tone;
        href?: string;
        class?: string;
        children?: import("svelte").Snippet;
    }

    let {
        tone = "default",
        href = undefined,
        class: className = undefined,
        children
    }: Props = $props();

    const tones: Record<Tone, string> = {
        default: "bg-surface-subtle text-muted-foreground border border-border",
        primary: "bg-primary-subtle text-primary-subtle-foreground border border-transparent",
        accent: "bg-accent-subtle text-accent border border-transparent",
        warning: "bg-warning-subtle text-warning border border-transparent",
        outline: "bg-surface text-foreground border border-border-strong",
        danger: "bg-danger-subtle text-danger border border-transparent"
    };

    let classes = $derived(
        cn(
            "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold",
            tones[tone],
            className
        )
    );
</script>

{#if href}
    <a {href} class={classes}>{@render children?.()}</a>
{:else}
    <span class={classes}>{@render children?.()}</span>
{/if}
