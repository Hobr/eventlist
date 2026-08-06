<script lang="ts">
    import RotateCcw from "phosphor-svelte/lib/ArrowsClockwise";
    import Filter from "phosphor-svelte/lib/Funnel";
    import SlidersHorizontal from "phosphor-svelte/lib/SlidersHorizontal";
    import X from "phosphor-svelte/lib/X";
    import type { EventSort, EventTiming, PublishedEventFilters } from "../lib/db/public-events";
    import type { TagSummary } from "../lib/db/tags";
    import { getDivisionLabel } from "../lib/divisions";
    import type { EventOption } from "../lib/events/options";
    import DivisionPicker from "./DivisionPicker.svelte";
    import SelectField from "./SelectField.svelte";
    import Button from "./ui/button.svelte";
    import Input from "./ui/input.svelte";
    import Label from "./ui/label.svelte";
    import SidePanel from "./ui/side-panel.svelte";

    interface Props {
        types: readonly EventOption[];
        scales: readonly EventOption[];
        tags: TagSummary[];
        filters: PublishedEventFilters;
    }

    let { types, scales, tags, filters }: Props = $props();
    let searchResults = $state<TagSummary[] | null>(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let suggestionRequest = 0;
    const suggestions = $derived(searchResults ?? tags);

    const typeOptions = $derived([
        { value: "", label: "全部类型" },
        ...types.map((type) => ({
            value: type.name,
            label: type.label
        }))
    ]);
    const scaleOptions = $derived([
        { value: "", label: "全部规模" },
        ...scales.map((scale) => ({
            value: scale.name,
            label: scale.label
        }))
    ]);
    const sortOptions = [
        { value: "start_asc", label: "最近开始" },
        { value: "start_desc", label: "最晚开始" },
        { value: "end_desc", label: "最晚结束" }
    ];
    const timingOptions = [
        { value: "upcoming", label: "未结束" },
        { value: "ended", label: "已结束" },
        { value: "all", label: "全部" }
    ];
    const timingValue: EventTiming = $derived(filters.timing ?? "upcoming");
    const defaultSort: EventSort = $derived(timingValue === "ended" ? "end_desc" : "start_asc");
    const sortValue: EventSort = $derived(filters.sort ?? defaultSort);

    const activeFilters = $derived.by(() => {
        const result: Array<{ key: string; label: string }> = [];
        if (timingValue !== "upcoming") {
            result.push({
                key: "status",
                label: timingValue === "ended" ? "已结束" : "全部活动"
            });
        }
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
        if (filters.starts) {
            result.push({ key: "starts", label: `开始于 ${filters.starts}` });
        }
        if (filters.active) {
            result.push({ key: "active", label: `${filters.active} 活动中` });
        }
        if (filters.scale) {
            const option = scales.find((item) => item.name === filters.scale);
            result.push({ key: "scale", label: option?.label ?? filters.scale });
        }
        if (filters.tag) result.push({ key: "tag", label: `# ${filters.tag}` });
        if (filters.sort && filters.sort !== defaultSort) {
            const option = sortOptions.find((item) => item.value === filters.sort);
            result.push({ key: "sort", label: option?.label ?? filters.sort });
        }
        return result;
    });

    const advancedCount = $derived(
        [
            filters.scale,
            filters.tag,
            filters.to,
            filters.sort && filters.sort !== defaultSort ? filters.sort : null
        ].filter(Boolean).length
    );

    function currentParams() {
        const params = new URLSearchParams();
        if (timingValue !== "upcoming") params.set("status", timingValue);
        if (filters.divisionCode) params.set("city", filters.divisionCode);
        if (filters.type) params.set("type", filters.type);
        if (filters.scale) params.set("scale", filters.scale);
        if (filters.tag) params.set("tag", filters.tag);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        if (filters.starts) params.set("starts", filters.starts);
        if (filters.active) params.set("active", filters.active);
        if (filters.sort) params.set("sort", filters.sort);
        return params;
    }

    function hrefWithout(key: string) {
        const params = currentParams();
        params.delete(key);
        params.delete("page");
        const query = params.toString();
        return query ? `/events?${query}` : "/events";
    }

    async function refreshTagSuggestions(value: string, requestId: number) {
        const query = value.trim();
        if (!query) {
            if (requestId === suggestionRequest) searchResults = null;
            return;
        }

        try {
            const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean;
                data?: { tags?: TagSummary[] };
            } | null;
            if (requestId !== suggestionRequest) return;
            searchResults = body?.ok && body.data?.tags ? body.data.tags : [];
        } catch {
            if (requestId === suggestionRequest) searchResults = [];
        }
    }

    function handleTagInput(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        if (timer) clearTimeout(timer);
        const nextValue = input.value;
        const requestId = ++suggestionRequest;
        if (!nextValue.trim()) {
            searchResults = null;
            return;
        }
        timer = setTimeout(() => void refreshTagSuggestions(nextValue, requestId), 160);
    }
</script>

<div class="filter-bar">
    <div class="filter-controls">
        <form id="quick-event-filters" class="quick-filters" action="/events" method="GET">
            <DivisionPicker
                name="city"
                label="地区"
                mode="region"
                value={filters.divisionCode}
                allowEmpty
                emptyLabel="全部地区"
            />
            <SelectField name="status" label="状态" value={timingValue} options={timingOptions} />
            <SelectField
                name="type"
                label="类型"
                value={filters.type ?? ""}
                options={typeOptions}
            />
            <div class="field-group">
                <Label for="event-filter-from">开始日期</Label>
                <Input id="event-filter-from" type="date" name="from" value={filters.from ?? ""} />
            </div>
            {#if filters.scale}<input type="hidden" name="scale" value={filters.scale} />{/if}
            {#if filters.tag}<input type="hidden" name="tag" value={filters.tag} />{/if}
            {#if filters.to}<input type="hidden" name="to" value={filters.to} />{/if}
            {#if filters.starts}<input type="hidden" name="starts" value={filters.starts} />{/if}
            {#if filters.active}<input type="hidden" name="active" value={filters.active} />{/if}
            {#if filters.sort}<input type="hidden" name="sort" value={filters.sort} />{/if}
            <Button type="submit" class="filter-submit">
                <Filter size={17} aria-hidden="true" />
                筛选
            </Button>
        </form>

        <SidePanel
            title="高级筛选"
            description="规模、标签、排序与结束日期"
            triggerClass="advanced-filter-trigger"
        >
            {#snippet trigger()}
                <SlidersHorizontal size={17} aria-hidden="true" />
                高级筛选
                {#if advancedCount > 0}
                    <span class="filter-count">
                        {advancedCount}
                    </span>
                {/if}
            {/snippet}
            <form
                id="advanced-event-filters"
                class="advanced-filter-form"
                action="/events"
                method="GET"
            >
                {#if filters.divisionCode}
                    <input type="hidden" name="city" value={filters.divisionCode} />
                {/if}
                {#if filters.type}<input type="hidden" name="type" value={filters.type} />{/if}
                {#if filters.from}<input type="hidden" name="from" value={filters.from} />{/if}
                {#if filters.starts}
                    <input type="hidden" name="starts" value={filters.starts} />
                {/if}
                {#if filters.active}
                    <input type="hidden" name="active" value={filters.active} />
                {/if}
                {#if timingValue !== "upcoming"}
                    <input type="hidden" name="status" value={timingValue} />
                {/if}

                <SelectField
                    name="scale"
                    label="规模"
                    value={filters.scale ?? ""}
                    options={scaleOptions}
                />
                <SelectField name="sort" label="排序" value={sortValue} options={sortOptions} />
                <div class="field-group">
                    <Label for="event-filter-to">结束日期</Label>
                    <Input id="event-filter-to" type="date" name="to" value={filters.to ?? ""} />
                </div>
                <div class="field-group">
                    <Label for="event-filter-tag">标签</Label>
                    <Input
                        id="event-filter-tag"
                        type="search"
                        name="tag"
                        list="event-tag-suggestions"
                        value={filters.tag ?? ""}
                        oninput={handleTagInput}
                    />
                    <datalist id="event-tag-suggestions">
                        {#each suggestions as tag (tag.id)}
                            <option value={tag.name}>{tag.event_count} 场活动</option>
                        {/each}
                    </datalist>
                </div>
                <div class="filter-actions">
                    <Button type="submit" class="filter-apply">应用筛选</Button>
                    <Button href="/events" variant="outline">
                        <RotateCcw size={17} aria-hidden="true" />
                        重置
                    </Button>
                </div>
            </form>
        </SidePanel>
    </div>

    {#if activeFilters.length > 0}
        <div class="active-filters" aria-label="已启用筛选">
            <span>已筛选</span>
            {#each activeFilters as filter (filter.key)}
                <a
                    href={hrefWithout(filter.key)}
                    class="active-filter"
                    aria-label={`移除筛选：${filter.label}`}
                >
                    {filter.label}
                    <X size={13} aria-hidden="true" />
                </a>
            {/each}
            <a href="/events" class="reset-filters">
                <RotateCcw size={13} aria-hidden="true" />
                全部重置
            </a>
        </div>
    {/if}
</div>
