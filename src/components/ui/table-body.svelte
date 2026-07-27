<script lang="ts">
    import { TableBody as FlowbiteTableBody } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("[&_tr:last-child]:border-0", className));
</script>

<FlowbiteTableBody class={classes}>{@render children?.()}</FlowbiteTableBody>
