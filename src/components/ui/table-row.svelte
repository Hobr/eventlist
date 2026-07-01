<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(
        cn("border-b border-border transition-colors hover:bg-surface-subtle/60", className)
    );
</script>

<tr class={classes}>{@render children?.()}</tr>
