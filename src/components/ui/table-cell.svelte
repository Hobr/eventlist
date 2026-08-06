<script lang="ts">
    import type { HTMLTdAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";
    type Props = Omit<HTMLTdAttributes, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<td {...restProps} class={cn("ui-table-cell", className)}>{@render children?.()}</td>
