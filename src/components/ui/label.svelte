<script lang="ts">
    import { Label as FlowbiteLabel } from "flowbite-svelte";
    import type { LabelProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<LabelProps, "children" | "class" | "color"> & {
        class?: string;
        children?: import("svelte").Snippet;
    };

    let { class: className = undefined, children, ...restProps }: Props = $props();
    let classes = $derived(
        cn(
            "text-sm leading-tight font-semibold text-muted-foreground dark:text-muted-foreground!",
            className
        )
    );
</script>

<FlowbiteLabel {...restProps} color="gray" class={classes}>
    {@render children?.()}
</FlowbiteLabel>
