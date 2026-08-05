<script lang="ts">
    import { Checkbox as FlowbiteCheckbox } from "flowbite-svelte";
    import type { CheckboxProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<CheckboxProps, "checked" | "children" | "class" | "color"> & {
        checked?: boolean;
        class?: string;
        children?: CheckboxProps["children"];
    };

    let {
        checked = $bindable(false),
        class: className = undefined,
        children = undefined,
        ...restProps
    }: Props = $props();

    let classes = $derived(
        cn(
            "size-4 rounded-xs border-border-strong bg-surface text-primary focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-strong! dark:bg-surface! dark:text-primary! dark:ring-offset-surface! dark:focus:ring-ring/40!",
            className
        )
    );
</script>

<FlowbiteCheckbox bind:checked {...restProps} {children} color="primary" class={classes} />
