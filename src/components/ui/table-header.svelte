<script lang="ts">
    import { TableHead as FlowbiteTableHead } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("[&_tr]:border-b", className));
</script>

<FlowbiteTableHead defaultRow={false} class={classes}>
    {@render children?.()}
</FlowbiteTableHead>
