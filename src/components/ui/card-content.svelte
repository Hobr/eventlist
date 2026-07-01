<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("p-5 pt-0", className));
</script>

<div class={classes}>{@render children?.()}</div>
