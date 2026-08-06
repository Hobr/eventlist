<script lang="ts">
    import { Label } from "bits-ui";
    import type { HTMLLabelAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLLabelAttributes, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };

    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<Label.Root {...restProps} class={cn("ui-label", className)}>{@render children?.()}</Label.Root>
