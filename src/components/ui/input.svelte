<script lang="ts">
    import { Input as FlowbiteInput } from "flowbite-svelte";
    import type { InputProps, InputValue } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<
        InputProps<InputValue>,
        "class" | "color" | "elementRef" | "size" | "value"
    > & {
        value?: InputValue;
        elementRef?: HTMLInputElement;
        class?: string;
    };

    let {
        value = $bindable(),
        elementRef = $bindable(),
        class: className = undefined,
        ...restProps
    }: Props = $props();

    let classes = $derived(
        cn(
            "flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-[border-color,background-color,box-shadow] duration-300 ease-motion placeholder:text-muted focus:border-ring focus:ring-ring/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-strong! dark:bg-surface! dark:text-foreground! dark:placeholder:text-muted! dark:focus:border-ring! dark:focus:ring-ring/40!",
            className
        )
    );
</script>

<FlowbiteInput
    bind:value
    bind:elementRef
    {...restProps}
    size="md"
    color="default"
    class={classes}
/>
