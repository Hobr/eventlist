<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        as?: "header" | "section" | "footer" | "div";
        class?: string;
        children?: import("svelte").Snippet;
    }
    let { as: Tag = "div", class: className = undefined, children }: Props = $props();
    let classes = $derived(cn("flex flex-col space-y-1.5 p-5", className));
</script>

<Tag class={classes}>{@render children?.()}</Tag>
