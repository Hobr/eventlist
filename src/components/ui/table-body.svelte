<script lang="ts">
    import type { HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";
    type Props = Omit<HTMLAttributes<HTMLTableSectionElement>, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<tbody {...restProps} class={cn("ui-table-body", className)}>{@render children?.()}</tbody>
