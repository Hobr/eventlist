<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("[&_tr]:border-b", className));
</script>

<thead class={classes}>{@render children?.()}</thead>
