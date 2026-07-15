<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
        dataLabel?: string;
        children?: import("svelte").Snippet;
    }
    let { class: className = undefined, dataLabel = undefined, children }: Props = $props();
    let classes = $derived(cn("p-3 align-top text-sm", className));
</script>

<td class={classes} data-label={dataLabel}>{@render children?.()}</td>
