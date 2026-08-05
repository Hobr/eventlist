<script lang="ts">
    import { TableBodyRow as FlowbiteTableRow } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(
        cn(
            "border-b border-border bg-surface transition-colors duration-300 ease-motion hover:bg-surface-subtle/60 dark:border-border! dark:bg-surface! dark:hover:bg-surface-subtle/60!",
            className
        )
    );
</script>

<FlowbiteTableRow color="default" class={classes}>
    {@render children?.()}
</FlowbiteTableRow>
