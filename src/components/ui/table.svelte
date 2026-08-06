<script lang="ts">
    import type { HTMLTableAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLTableAttributes, "children" | "class"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    let { class: className = undefined, children, ...restProps }: Props = $props();
</script>

<div class="ui-table-wrap">
    <table {...restProps} class={cn("ui-table", className)}>{@render children?.()}</table>
</div>
