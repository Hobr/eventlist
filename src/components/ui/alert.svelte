<script lang="ts">
    import { Alert as FlowbiteAlert } from "flowbite-svelte";
    import type { AlertProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Tone = "neutral" | "warning" | "danger" | "success";
    type Props = Omit<AlertProps, "border" | "children" | "class" | "color" | "rounded"> & {
        tone?: Tone;
        class?: string;
        children: import("svelte").Snippet;
    };

    let {
        tone = "neutral",
        class: className = undefined,
        children,
        ...restProps
    }: Props = $props();

    const colors = {
        neutral: "gray",
        warning: "amber",
        danger: "red",
        success: "green"
    } as const;
    const tones: Record<Tone, string> = {
        neutral:
            "border-border bg-surface-subtle text-foreground dark:border-border! dark:bg-surface-subtle! dark:text-foreground!",
        warning:
            "border-warning/30 bg-warning-subtle text-warning dark:border-warning/30! dark:bg-warning-subtle! dark:text-warning!",
        danger: "border-danger/30 bg-danger-subtle text-danger dark:border-danger/30! dark:bg-danger-subtle! dark:text-danger!",
        success:
            "border-primary/30 bg-primary-subtle text-primary-subtle-foreground dark:border-primary/30! dark:bg-primary-subtle! dark:text-primary-subtle-foreground!"
    };
    let classes = $derived(cn("rounded-md p-4 text-sm leading-6", tones[tone], className));
</script>

<FlowbiteAlert {...restProps} color={colors[tone]} rounded border class={classes}>
    {@render children()}
</FlowbiteAlert>
