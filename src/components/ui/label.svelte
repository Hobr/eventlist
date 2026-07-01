<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        for?: string;
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { for: htmlFor = undefined, class: className = undefined, children }: Props = $props();
    let classes = $derived(
        cn("text-sm font-semibold text-muted-foreground leading-tight", className)
    );
</script>

<label for={htmlFor} class={classes}>{@render children?.()}</label>
