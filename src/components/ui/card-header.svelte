<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        as?: "header" | "section" | "footer" | "div";
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { as: Tag = "div", class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("ui-card-header", className));
</script>

<Tag class={classes}>{@render children?.()}</Tag>
