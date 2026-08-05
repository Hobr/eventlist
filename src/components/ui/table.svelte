<script lang="ts">
    import { Table as FlowbiteTable } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(
        cn("w-full caption-bottom text-sm text-foreground dark:text-foreground!", className)
    );
</script>

<FlowbiteTable border={false} classes={{ div: "contents" }} class={classes}>
    {@render children?.()}
</FlowbiteTable>
