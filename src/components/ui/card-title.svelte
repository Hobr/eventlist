<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        as?: "h1" | "h2" | "h3" | "h4" | "p" | "div";
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { as: Tag = "h3", class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("text-base font-semibold leading-tight text-foreground", className));
</script>

<Tag class={classes}>{@render children?.()}</Tag>
