<script lang="ts">
    import { Select } from "bits-ui";

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
        disabled = false,
        wide = false,
        onchange
    }: Props = $props();

    let selectedValue = $state(value ?? "");
    const items = $derived(
        options.map((option) => ({
            value: option.value,
            label: option.label,
            disabled: option.disabled
        }))
    );

    function handleValueChange(nextValue: string) {
        selectedValue = nextValue;
        onchange?.(nextValue);
    }
</script>

<div class:wide class="field select-field">
    <span>{label}</span>
    <Select.Root
        type="single"
        {name}
        {items}
        required={required && !disabled}
        {disabled}
        value={selectedValue}
        onValueChange={handleValueChange}
    >
        <Select.Trigger class="bits-select-trigger" aria-label={label}>
            <Select.Value {placeholder} />
            <span class="material-symbols-rounded bits-select-icon" aria-hidden="true">
                expand_more
            </span>
        </Select.Trigger>
        <Select.Portal>
            <Select.Content class="bits-select-content" sideOffset={6}>
                <Select.ScrollUpButton class="bits-select-scroll-button">
                    <span class="material-symbols-rounded" aria-hidden="true">
                        keyboard_arrow_up
                    </span>
                </Select.ScrollUpButton>
                <Select.Viewport class="bits-select-viewport">
                    {#each options as option}
                        <Select.Item
                            class="bits-select-item"
                            value={option.value}
                            label={option.label}
                            disabled={option.disabled}
                        >
                            {#snippet children({ selected })}
                                <span class="bits-select-item-label">{option.label}</span>
                                {#if selected}
                                    <span
                                        class="material-symbols-rounded bits-select-check"
                                        aria-hidden="true"
                                    >
                                        check
                                    </span>
                                {/if}
                            {/snippet}
                        </Select.Item>
                    {/each}
                </Select.Viewport>
                <Select.ScrollDownButton class="bits-select-scroll-button">
                    <span class="material-symbols-rounded" aria-hidden="true">
                        keyboard_arrow_down
                    </span>
                </Select.ScrollDownButton>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
</div>
