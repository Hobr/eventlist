<script lang="ts">
    import type { HTMLThAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";
    type Props = Omit<HTMLThAttributes, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<th {...restProps} class={cn("ui-table-head", className)}>{@render children?.()}</th>
