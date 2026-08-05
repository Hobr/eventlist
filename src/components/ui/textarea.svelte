<script lang="ts">
    import { Textarea as FlowbiteTextarea } from "flowbite-svelte";
    import type { TextareaProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<TextareaProps, "class" | "elementRef" | "rows" | "value"> & {
        value?: string;
        elementRef?: HTMLTextAreaElement;
        rows?: number;
        class?: string;
    };

    let {
        value = $bindable(),
        elementRef = $bindable(),
        rows = 4,
        class: className = undefined,
        ...restProps
    }: Props = $props();

    let classes = $derived(
        cn(
            "flex min-h-32 w-full resize-y rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-[border-color,background-color,box-shadow] duration-300 ease-motion placeholder:text-muted focus:border-ring focus:ring-ring/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-strong! dark:bg-surface! dark:text-foreground! dark:placeholder:text-muted! dark:focus:border-ring! dark:focus:ring-ring/40!",
            className
        )
    );
</script>

<FlowbiteTextarea bind:value bind:elementRef {...restProps} {rows} class={classes} />
