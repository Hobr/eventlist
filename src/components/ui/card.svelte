<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("rounded-md border border-border bg-surface", className));
</script>

<div class={classes}>{@render children?.()}</div>
