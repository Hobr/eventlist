<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("text-sm text-muted-foreground", className));
</script>

<p class={classes}>{@render children?.()}</p>
