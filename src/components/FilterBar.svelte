<script lang="ts">
    import type {
        EventSort,
        OptionRow,
        PublishedEventFilters,
        TagSummary
    } from "../lib/db/queries";
    import DivisionPicker from "./DivisionPicker.svelte";
    import SelectField from "./SelectField.svelte";
    import Button from "./ui/button.svelte";
    import Filter from "@lucide/svelte/icons/filter";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";

    interface Props {
        types: OptionRow[];
        scales: OptionRow[];
        tags: TagSummary[];
        filters: PublishedEventFilters;
    }

    let { types, scales, tags, filters }: Props = $props();
    let tagValue = $state(filters.tag ?? "");
    let suggestions = $state(tags);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const typeOptions = $derived([
        { value: "", label: "全部类型" },
        ...types.map((type) => ({
            value: type.name,
            label: type.label ?? type.name
        }))
    ]);
    const scaleOptions = $derived([
        { value: "", label: "全部规模" },
        ...scales.map((scale) => ({
            value: scale.name,
            label: scale.label ?? scale.name
        }))
    ]);
    const sortOptions = [
        { value: "start_asc", label: "最近" },
        { value: "start_desc", label: "最远" }
    ];

    async function refreshTagSuggestions(value: string) {
        const query = value.trim();
        if (!query) {
            suggestions = tags;
            return;
        }

        const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
        const body = (await response.json().catch(() => null)) as {
            ok?: boolean;
            data?: { tags?: TagSummary[] };
        } | null;
        if (body?.ok && body.data?.tags) {
            suggestions = body.data.tags;
        }
    }

    function handleTagInput(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        tagValue = input.value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void refreshTagSuggestions(tagValue), 160);
    }

    const sortValue: EventSort = $derived(filters.sort ?? "start_asc");
</script>

<form
    class="flex flex-col gap-4 rounded-md border border-border bg-surface p-4"
    action="/events"
    method="GET"
>
    <div class="flex items-center gap-2 text-sm font-semibold text-foreground">
        <SlidersHorizontal class="size-4 text-muted" aria-hidden="true" />
        筛选
    </div>

    <DivisionPicker
        name="city"
        label="地区"
        mode="region"
        value={filters.divisionCode}
        allowEmpty
        emptyLabel="全部地区"
    />

    <SelectField name="type" label="类型" value={filters.type ?? ""} options={typeOptions} />

    <SelectField name="scale" label="规模" value={filters.scale ?? ""} options={scaleOptions} />

    <SelectField name="sort" label="排序" value={sortValue} options={sortOptions} />

    <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-muted-foreground">开始不早于</span>
        <input
            type="date"
            name="from"
            value={filters.from ?? ""}
            class="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
    </label>

    <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-muted-foreground">结束不晚于</span>
        <input
            type="date"
            name="to"
            value={filters.to ?? ""}
            class="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
    </label>

    <label class="flex flex-col gap-1.5">
        <span class="text-sm font-semibold text-muted-foreground">标签</span>
        <input
            type="search"
            name="tag"
            list="event-tag-suggestions"
            value={tagValue}
            oninput={handleTagInput}
            autocomplete="off"
            class="flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <datalist id="event-tag-suggestions">
            {#each suggestions as tag (tag.name)}
                <option value={tag.name}>{tag.event_count} 个活动</option>
            {/each}
        </datalist>
    </label>

    <div class="flex items-center gap-2">
        <Button type="submit" class="flex-1">
            <Filter class="size-4" aria-hidden="true" />
            筛选
        </Button>
        <Button variant="outline" href="/events" class="flex-1">
            <RotateCcw class="size-4" aria-hidden="true" />
            重置
        </Button>
    </div>
</form>
