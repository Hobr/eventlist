<script lang="ts">
    import { Badge as FlowbiteBadge } from "flowbite-svelte";
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

    const colors = {
        default: "gray",
        primary: "primary",
        accent: "pink",
        warning: "yellow",
        outline: "gray",
        danger: "red"
    } as const;

    const tones: Record<Tone, string> = {
        default: "border border-border bg-surface-subtle text-muted-foreground",
        primary: "border border-transparent bg-primary-subtle text-primary-subtle-foreground",
        accent: "border border-transparent bg-accent-subtle text-accent",
        warning: "border border-transparent bg-warning-subtle text-warning",
        outline: "border border-border-strong bg-surface text-foreground",
        danger: "border border-transparent bg-danger-subtle text-danger"
    };

    let classes = $derived(
        cn(
            "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold",
            tones[tone],
            className
        )
    );
</script>

<FlowbiteBadge
    color={colors[tone]}
    border={tone === "outline"}
    rounded={false}
    {href}
    class={classes}
>
    {@render children?.()}
</FlowbiteBadge>
