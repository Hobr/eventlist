<script lang="ts">
    import { Select } from "bits-ui";
    import CaretUpDown from "phosphor-svelte/lib/CaretUpDown";
    import Check from "phosphor-svelte/lib/Check";
    import { untrack } from "svelte";

    export interface SelectOption {
        value: string;
        label: string;
        disabled?: boolean;
    }

    interface Props {
        name?: string;
        label: string;
        value?: string | null;
        options: SelectOption[];
        placeholder?: string;
        required?: boolean;
        showRequiredIndicator?: boolean;
        disabled?: boolean;
        wide?: boolean;
        onchange?: (value: string) => void;
    }

    let {
        name = undefined,
        label,
        value = "",
        options,
        placeholder = "请选择",
        required = false,
        showRequiredIndicator = false,
        disabled = false,
        wide = false,
        onchange
    }: Props = $props();

    let selectedValue = $state(untrack(() => value ?? ""));
    $effect(() => {
        selectedValue = value ?? "";
    });

    const items = $derived(
        options.map((option) => ({
            value: option.value,
            label: option.label,
            disabled: option.disabled
        }))
    );

    function updateValue(nextValue: string) {
        selectedValue = nextValue;
        onchange?.(nextValue);
    }
</script>

<div class:wide class="ui-select-field">
    <span class="ui-label">
        {label}
        {#if showRequiredIndicator}<span class="required-indicator">必填</span>{/if}
    </span>
    <Select.Root
        type="single"
        {name}
        {items}
        required={required && !disabled}
        {disabled}
        value={selectedValue}
        onValueChange={updateValue}
    >
        <Select.Trigger class="ui-select-trigger" aria-label={label}>
            <Select.Value {placeholder} />
            <CaretUpDown size={17} aria-hidden="true" />
        </Select.Trigger>
        <Select.Portal>
            <Select.Content class="ui-select-content" sideOffset={6}>
                <Select.Viewport class="ui-select-viewport">
                    {#each options as option (option.value)}
                        <Select.Item
                            value={option.value}
                            label={option.label}
                            disabled={option.disabled}
                            class="ui-select-item"
                        >
                            {#snippet children({ selected })}
                                <span>{option.label}</span>
                                {#if selected}<Check size={16} aria-hidden="true" />{/if}
                            {/snippet}
                        </Select.Item>
                    {/each}
                </Select.Viewport>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
</div>
