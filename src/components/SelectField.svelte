<script lang="ts">
    import { Select } from "flowbite-svelte";
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
            name: option.label,
            disabled: option.disabled
        }))
    );

    function handleChange(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        selectedValue = select.value;
        onchange?.(select.value);
    }
</script>

<div class={wide ? "flex w-full min-w-0 flex-col gap-1.5" : "flex min-w-0 flex-col gap-1.5"}>
    <span class="text-sm font-semibold text-muted-foreground">{label}</span>
    <Select
        {name}
        {items}
        {placeholder}
        required={required && !disabled}
        {disabled}
        bind:value={selectedValue}
        onchange={handleChange}
        aria-label={label}
        class="w-full"
        classes={{
            select: "h-10 rounded-md border-border-strong bg-surface px-3 py-2 text-foreground focus:border-ring focus:ring-ring/40 dark:border-border-strong dark:bg-surface dark:text-foreground dark:focus:border-ring dark:focus:ring-ring/40"
        }}
    />
</div>
