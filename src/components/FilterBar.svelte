<script lang="ts">
    import Filter from "@lucide/svelte/icons/filter";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
    import X from "@lucide/svelte/icons/x";
    import type {
        EventSort,
        OptionRow,
        PublishedEventFilters,
        TagSummary
    } from "../lib/db/queries";
    import { getDivisionLabel } from "../lib/divisions";
    import DivisionPicker from "./DivisionPicker.svelte";
    import SelectField from "./SelectField.svelte";
    import Button from "./ui/button.svelte";
    import SidePanel from "./ui/side-panel.svelte";

    interface Props {
        types: OptionRow[];
        scales: OptionRow[];
        tags: TagSummary[];
        filters: PublishedEventFilters;
    }

    let { types, scales, tags, filters }: Props = $props();
    let searchResults = $state<TagSummary[] | null>(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const suggestions = $derived(searchResults ?? tags);

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
        { value: "start_asc", label: "最近开始" },
        { value: "start_desc", label: "最晚开始" }
    ];
    const sortValue: EventSort = $derived(filters.sort ?? "start_asc");

    const activeFilters = $derived.by(() => {
        const result: Array<{ key: string; label: string }> = [];
        if (filters.divisionCode) {
            result.push({
                key: "city",
                label: getDivisionLabel(filters.divisionCode) ?? "已选地区"
            });
        }
        if (filters.type) {
            const option = types.find((item) => item.name === filters.type);
            result.push({ key: "type", label: option?.label ?? filters.type });
        }
        if (filters.from) result.push({ key: "from", label: `始于 ${filters.from}` });
        if (filters.to) result.push({ key: "to", label: `止于 ${filters.to}` });
        if (filters.scale) {
            const option = scales.find((item) => item.name === filters.scale);
            result.push({ key: "scale", label: option?.label ?? filters.scale });
        }
        if (filters.tag) result.push({ key: "tag", label: `# ${filters.tag}` });
        if (sortValue === "start_desc") result.push({ key: "sort", label: "最晚开始" });
        return result;
    });

    const advancedCount = $derived(
        [
            filters.scale,
            filters.tag,
            filters.to,
            sortValue === "start_desc" ? sortValue : null
        ].filter(Boolean).length
    );

    function currentParams() {
        const params = new URLSearchParams();
        if (filters.divisionCode) params.set("city", filters.divisionCode);
        if (filters.type) params.set("type", filters.type);
        if (filters.scale) params.set("scale", filters.scale);
        if (filters.tag) params.set("tag", filters.tag);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (sortValue !== "start_asc") params.set("sort", sortValue);
        return params;
    }

    function hrefWithout(key: string) {
        const params = currentParams();
        params.delete(key);
        params.delete("page");
        const query = params.toString();
        return query ? `/events?${query}` : "/events";
    }

    async function refreshTagSuggestions(value: string) {
        const query = value.trim();
        if (!query) {
            searchResults = null;
            return;
        }

        const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
        const body = (await response.json().catch(() => null)) as {
            ok?: boolean;
            data?: { tags?: TagSummary[] };
        } | null;
        if (body?.ok && body.data?.tags) searchResults = body.data.tags;
    }

    function handleTagInput(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        if (timer) clearTimeout(timer);
        const nextValue = input.value;
        timer = setTimeout(() => void refreshTagSuggestions(nextValue), 160);
    }
</script>

<div class="flex flex-col gap-4">
    <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <form
            id="quick-event-filters"
            class="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(20rem,1.4fr)_minmax(11rem,0.8fr)_minmax(10rem,0.7fr)_auto] lg:items-end"
            action="/events"
            method="GET"
        >
            <DivisionPicker
                name="city"
                label="地区"
                mode="region"
                value={filters.divisionCode}
                allowEmpty
                emptyLabel="全部地区"
            />
            <SelectField
                name="type"
                label="类型"
                value={filters.type ?? ""}
                options={typeOptions}
            />
            <label class="flex flex-col gap-1.5">
                <span class="text-muted-foreground text-sm font-semibold">开始日期</span>
                <input
                    type="date"
                    name="from"
                    value={filters.from ?? ""}
                    class="border-border-strong bg-surface text-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                />
            </label>
            {#if filters.scale}<input type="hidden" name="scale" value={filters.scale} />{/if}
            {#if filters.tag}<input type="hidden" name="tag" value={filters.tag} />{/if}
            {#if filters.to}<input type="hidden" name="to" value={filters.to} />{/if}
            {#if sortValue !== "start_asc"}
                <input type="hidden" name="sort" value={sortValue} />
            {/if}
            <Button type="submit" class="w-full lg:w-auto">
                <Filter class="size-4" aria-hidden="true" />
                筛选
            </Button>
        </form>

        <SidePanel
            title="高级筛选"
            description="规模、标签、排序与结束日期"
            triggerClass="w-full lg:w-auto"
        >
            {#snippet trigger()}
                <SlidersHorizontal class="size-4" aria-hidden="true" />
                高级筛选
                {#if advancedCount > 0}
                    <span
                        class="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-full text-[0.65rem]"
                    >
                        {advancedCount}
                    </span>
                {/if}
            {/snippet}
            <form
                id="advanced-event-filters"
                class="flex flex-col gap-5"
                action="/events"
                method="GET"
            >
                {#if filters.divisionCode}
                    <input type="hidden" name="city" value={filters.divisionCode} />
                {/if}
                {#if filters.type}<input type="hidden" name="type" value={filters.type} />{/if}
                {#if filters.from}<input type="hidden" name="from" value={filters.from} />{/if}

                <SelectField
                    name="scale"
                    label="规模"
                    value={filters.scale ?? ""}
                    options={scaleOptions}
                />
                <SelectField name="sort" label="排序" value={sortValue} options={sortOptions} />
                <label class="flex flex-col gap-1.5">
                    <span class="text-muted-foreground text-sm font-semibold">结束日期</span>
                    <input
                        type="date"
                        name="to"
                        value={filters.to ?? ""}
                        class="border-border-strong bg-surface text-foreground focus-visible:border-ring focus-visible:ring-ring/40 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                </label>
                <label class="flex flex-col gap-1.5">
                    <span class="text-muted-foreground text-sm font-semibold">标签</span>
                    <input
                        type="search"
                        name="tag"
                        list="event-tag-suggestions"
                        value={filters.tag ?? ""}
                        oninput={handleTagInput}
                        class="border-border-strong bg-surface text-foreground placeholder:text-muted focus-visible:border-ring focus-visible:ring-ring/40 flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    />
                    <datalist id="event-tag-suggestions">
                        {#each suggestions as tag (tag.id)}
                            <option value={tag.name}>{tag.event_count} 场活动</option>
                        {/each}
                    </datalist>
                </label>
                <div class="border-border flex gap-3 border-t pt-5">
                    <Button type="submit" class="flex-1">应用筛选</Button>
                    <Button href="/events" variant="outline">
                        <RotateCcw class="size-4" aria-hidden="true" />
                        重置
                    </Button>
                </div>
            </form>
        </SidePanel>
    </div>

    {#if activeFilters.length > 0}
        <div
            class="border-border flex flex-wrap items-center gap-2 border-t pt-4"
            aria-label="已启用筛选"
        >
            <span class="text-muted text-xs font-semibold">已筛选</span>
            {#each activeFilters as filter (filter.key)}
                <a
                    href={hrefWithout(filter.key)}
                    class="bg-surface-subtle text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors"
                    aria-label={`移除筛选：${filter.label}`}
                >
                    {filter.label}
                    <X class="size-3" aria-hidden="true" />
                </a>
            {/each}
            <a
                href="/events"
                class="text-link ml-auto inline-flex items-center gap-1.5 text-xs font-semibold"
            >
                <RotateCcw class="size-3" aria-hidden="true" />
                全部重置
            </a>
        </div>
    {/if}
</div>
