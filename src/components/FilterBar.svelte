<script lang="ts">
    import type {
        EventSort,
        OptionRow,
        PublishedEventFilters,
        TagSummary
    } from "../lib/db/queries";
    import DivisionPicker from "./DivisionPicker.svelte";
    import SelectField from "./SelectField.svelte";

    interface Props {
        types: OptionRow[];
        scales: OptionRow[];
        tags: TagSummary[];
        filters: PublishedEventFilters;
    }

    let { types, scales, tags, filters }: Props = $props();
    let tagValue = filters.tag ?? "";
    let suggestions = tags;
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

    const sortValue: EventSort = filters.sort ?? "start_asc";
</script>

<form class="panel toolbar" action="/events" method="GET">
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

    <label class="field">
        <span>开始不早于</span>
        <input type="date" name="from" value={filters.from ?? ""} />
    </label>

    <label class="field">
        <span>结束不晚于</span>
        <input type="date" name="to" value={filters.to ?? ""} />
    </label>

    <label class="field wide">
        <span>标签</span>
        <input
            type="search"
            name="tag"
            list="event-tag-suggestions"
            value={tagValue}
            oninput={handleTagInput}
            autocomplete="off"
        />
        <datalist id="event-tag-suggestions">
            {#each suggestions as tag}
                <option value={tag.name}>{tag.event_count} 个活动</option>
            {/each}
        </datalist>
    </label>

    <div class="button-row">
        <button class="button button-filled" type="submit">
            <span class="material-symbols-rounded" aria-hidden="true">filter_alt</span>
            筛选
        </button>
        <a class="button button-outline" href="/events">
            <span class="material-symbols-rounded" aria-hidden="true">restart_alt</span>
            重置
        </a>
    </div>
</form>
