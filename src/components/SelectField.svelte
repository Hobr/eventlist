<script lang="ts">
    import { untrack } from "svelte";
    import { Select } from "bits-ui";
    import ChevronDown from "@lucide/svelte/icons/chevron-down";
    import ChevronUp from "@lucide/svelte/icons/chevron-up";
    import Check from "@lucide/svelte/icons/check";

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

    function handleValueChange(nextValue: string) {
        selectedValue = nextValue;
        onchange?.(nextValue);
    }
</script>

<div class="flex min-w-0 flex-col gap-1.5">
    <span class="text-sm font-semibold text-muted-foreground">{label}</span>
    <Select.Root
        type="single"
        {name}
        {items}
        required={required && !disabled}
        {disabled}
        value={selectedValue}
        onValueChange={handleValueChange}
    >
        <Select.Trigger
            class="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-subtle focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/40"
            aria-label={label}
        >
            <Select.Value {placeholder} class="truncate data-[placeholder]:text-muted" />
            <ChevronDown class="size-4 shrink-0 text-muted" aria-hidden="true" />
        </Select.Trigger>
        <Select.Portal>
            <Select.Content
                sideOffset={6}
                class="z-50 max-h-80 min-w-[var(--bits-select-anchor-width)] overflow-hidden rounded-md border border-border-strong bg-surface-raised text-foreground shadow-popover"
            >
                <Select.ScrollUpButton class="flex h-8 items-center justify-center text-muted">
                    <ChevronUp class="size-4" aria-hidden="true" />
                </Select.ScrollUpButton>
                <Select.Viewport class="max-h-72 p-1">
                    {#each options as option (option.value)}
                        <Select.Item
                            value={option.value}
                            label={option.label}
                            disabled={option.disabled}
                            class="relative flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-subtle data-[selected]:text-primary"
                        >
                            {#snippet children({ selected })}
                                <span class="truncate">{option.label}</span>
                                {#if selected}
                                    <span class="ml-auto flex shrink-0">
                                        <Check class="size-4" aria-hidden="true" />
                                    </span>
                                {/if}
                            {/snippet}
                        </Select.Item>
                    {/each}
                </Select.Viewport>
                <Select.ScrollDownButton class="flex h-8 items-center justify-center text-muted">
                    <ChevronDown class="size-4" aria-hidden="true" />
                </Select.ScrollDownButton>
            </Select.Content>
        </Select.Portal>
    </Select.Root>
</div>
