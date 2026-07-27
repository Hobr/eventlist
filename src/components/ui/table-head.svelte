<script lang="ts">
    import { TableHeadCell as FlowbiteTableHeadCell } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(
        cn("h-11 px-3 text-left align-middle font-semibold text-muted-foreground", className)
    );
</script>

<FlowbiteTableHeadCell class={classes}>{@render children?.()}</FlowbiteTableHeadCell>
