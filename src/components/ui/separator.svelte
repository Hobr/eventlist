<script lang="ts">
    import { Separator } from "bits-ui";
    import type { HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLAttributes<HTMLDivElement>, "children" | "class"> & {
        orientation?: "horizontal" | "vertical";
        decorative?: boolean;
        class?: string;
    };

    let {
        orientation = "horizontal",
        decorative = true,
        class: className = undefined,
        ...restProps
    }: Props = $props();
</script>

<Separator.Root {...restProps} {orientation} {decorative} class={cn("ui-separator", className)} />
