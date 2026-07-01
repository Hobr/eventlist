<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("w-full caption-bottom text-sm text-foreground", className));
</script>

<table class={classes}>{@render children?.()}</table>
