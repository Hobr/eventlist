<script lang="ts">
    import { Checkbox } from "bits-ui";
    import type { CheckboxRootProps } from "bits-ui";
    import { cn } from "../../lib/utils";

    const uid = $props.id();

    type Props = Omit<CheckboxRootProps, "checked" | "child" | "children" | "class"> & {
        checked?: boolean;
        class?: string;
        wrapperClass?: string;
        children?: import("svelte").Snippet;
    };

    let {
        checked = $bindable(false),
        id = uid,
        class: className = undefined,
        wrapperClass: wrapperClassName = undefined,
        children = undefined,
        ...restProps
    }: Props = $props();
</script>

<span class={cn("ui-checkbox-layout", wrapperClassName)}>
    <Checkbox.Root
        bind:checked
        {...restProps}
        {id}
        aria-labelledby={children ? `${id}-label` : undefined}
        class={cn("ui-checkbox", className)}
    >
        {#snippet children({ checked: isChecked, indeterminate })}
            {#if isChecked || indeterminate}<span class="ui-checkbox-indicator"></span>{/if}
        {/snippet}
    </Checkbox.Root>
    {#if children}
        <label id={`${id}-label`} for={id} class="ui-checkbox-label">{@render children()}</label>
    {/if}
</span>
