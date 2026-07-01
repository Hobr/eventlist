<script lang="ts">
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

<th class={classes}>{@render children?.()}</th>
