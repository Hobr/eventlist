<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Tone = "neutral" | "warning" | "danger" | "success";
    type Props = Omit<HTMLAttributes<HTMLDivElement>, "children" | "class"> & {
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
</script>

<div {...restProps} class={cn("ui-alert", className)} data-tone={tone}>{@render children()}</div>
