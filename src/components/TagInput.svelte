<script lang="ts">
    import type { TagSummary } from "../lib/db/queries";

    interface Props {
        name?: string;
        initial?: string;
        label?: string;
    }

    let { name = "tags", initial = "", label = "标签" }: Props = $props();
    let tags = initial
        .split(/[,\n，、]/)
        .map((tag) => tag.trim())
        .filter(Boolean);
    let draft = "";
    let suggestions: TagSummary[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    function addTag(value = draft) {
        const tag = value.trim().slice(0, 24);
        if (!tag || tags.includes(tag) || tags.length >= 12) return;
        tags = [...tags, tag];
        draft = "";
    }

    function removeTag(tag: string) {
        tags = tags.filter((item) => item !== tag);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== "Enter" && event.key !== "," && event.key !== "，") {
            return;
        }

        event.preventDefault();
        addTag();
    }

    async function refreshSuggestions(value: string) {
        const query = value.trim();
        if (!query) {
            suggestions = [];
            return;
        }

        const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
        const body = (await response.json().catch(() => null)) as {
            ok?: boolean;
            data?: { tags?: TagSummary[] };
        } | null;
        suggestions = body?.ok && body.data?.tags ? body.data.tags : [];
    }

    function handleInput(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        draft = input.value;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void refreshSuggestions(draft), 160);
    }
</script>

<div class="field">
    <label for="tag-input">{label}</label>
    <input type="hidden" {name} value={tags.join("、")} />
    <div class="tag-input">
        {#each tags as tag}
            <button class="chip chip-button" type="button" onclick={() => removeTag(tag)}>
                {tag}
                <span class="material-symbols-rounded" aria-hidden="true">close</span>
            </button>
        {/each}
        <input
            id="tag-input"
            type="search"
            bind:value={draft}
            list="submit-tag-suggestions"
            onkeydown={handleKeydown}
            oninput={handleInput}
            autocomplete="off"
        />
    </div>
    <datalist id="submit-tag-suggestions">
        {#each suggestions as suggestion}
            <option value={suggestion.name}>{suggestion.event_count} 个活动</option>
        {/each}
    </datalist>
</div>
