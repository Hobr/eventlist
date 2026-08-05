<script lang="ts">
    import { Card as FlowbiteCard } from "flowbite-svelte";
    import type { CardProps } from "flowbite-svelte";
    import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type CardOptions = Pick<
        CardProps,
        "classes" | "horizontal" | "img" | "imgClass" | "reverse" | "size"
    >;
    type CardBaseProps = CardOptions & {
        class?: string;
        children?: import("svelte").Snippet;
    };
    type Props =
        | (CardBaseProps &
              Omit<HTMLAnchorAttributes, "children" | "class" | "href"> & { href: string })
        | (CardBaseProps &
              Omit<HTMLAttributes<HTMLDivElement>, "children" | "class"> & { href?: undefined });

    let { class: className = undefined, children, size = "xl", ...restProps }: Props = $props();
    let classes = $derived(
        cn(
            "rounded-md border-border bg-surface ring-1 ring-border/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-surface dark:border-border! dark:bg-surface! dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] dark:hover:bg-surface!",
            className
        )
    );
</script>

<FlowbiteCard {...restProps} color="gray" shadow="sm" {size} class={classes}>
    {@render children?.()}
</FlowbiteCard>
