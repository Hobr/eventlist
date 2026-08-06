<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";
    type Props = Omit<HTMLAttributes<HTMLTableRowElement>, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<tr {...restProps} class={cn("ui-table-row", className)}>{@render children?.()}</tr>
