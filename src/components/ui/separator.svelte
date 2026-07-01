<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        class?: string;
    }
    let { class: className = undefined }: Props = $props();
    let classes = $derived(cn("h-px w-full bg-border", className));
</script>

<div class={classes} role="separator"></div>
