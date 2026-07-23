<script lang="ts">
    import { untrack } from "svelte";
    import type { TagSummary } from "../lib/db/queries";
    import X from "@lucide/svelte/icons/x";

    interface Props {
        name?: string;
        initial?: string;
        label?: string;
        available?: TagSummary[];
    }

    let { name = "tags", initial = "", label = "标签", available = [] }: Props = $props();
    let tags = $state(
        untrack(() => initial)
            .split(/[,\n，、]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
    );
    let draft = $state("");
    let suggestions = $state<TagSummary[]>([]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let suggestionRequest = 0;
    let serializedTags = $derived.by(() => {
        const draftTag = draft.trim().slice(0, 24);
        return [...new Set([...tags, ...(draftTag ? [draftTag] : [])])].slice(0, 12).join("、");
    });

    function addTag(value = draft) {
        const tag = value.trim().slice(0, 24);
        if (!tag || tags.includes(tag) || tags.length >= 12) return;
        tags = [...tags, tag];
        draft = "";
        suggestionRequest += 1;
        if (timer) clearTimeout(timer);
        suggestions = [];
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

    async function refreshSuggestions(value: string, requestId: number) {
        const query = value.trim();
        if (!query) {
            if (requestId === suggestionRequest) suggestions = [];
            return;
        }
        if (available.length > 0) {
            if (requestId !== suggestionRequest) return;
            suggestions = available
                .filter((suggestion) => suggestion.name.includes(query))
                .slice(0, 12);
            return;
        }
        try {
            const response = await fetch(`/api/tags?q=${encodeURIComponent(query)}`);
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean;
                data?: { tags?: TagSummary[] };
            } | null;
            if (requestId !== suggestionRequest) return;
            suggestions = body?.ok && body.data?.tags ? body.data.tags : [];
        } catch {
            if (requestId === suggestionRequest) suggestions = [];
        }
    }

    function handleInput(event: Event) {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        draft = input.value;
        if (timer) clearTimeout(timer);
        const requestId = ++suggestionRequest;
        if (!draft.trim()) {
            suggestions = [];
            return;
        }
        timer = setTimeout(() => void refreshSuggestions(draft, requestId), 160);
    }
</script>

<div class="flex flex-col gap-1.5">
    <label for="tag-input" class="text-sm font-semibold text-muted-foreground">{label}</label>
    <input type="hidden" {name} value={serializedTags} />
    <div
        class="flex flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface p-1.5 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40"
    >
        {#each tags as tag (tag)}
            <button
                type="button"
                onclick={() => removeTag(tag)}
                aria-label={`移除标签 ${tag}`}
                class="inline-flex items-center gap-1 rounded-sm bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-raised"
            >
                {tag}
                <X class="size-3" aria-hidden="true" />
            </button>
        {/each}
        <input
            id="tag-input"
            type="search"
            bind:value={draft}
            list="submit-tag-suggestions"
            onkeydown={handleKeydown}
            oninput={handleInput}
            onblur={() => addTag()}
            autocomplete="off"
            placeholder="输入后按 Enter 添加"
            class="flex-1 bg-transparent px-1.5 py-1 text-sm text-foreground outline-none placeholder:text-muted"
        />
    </div>
    <datalist id="submit-tag-suggestions">
        {#each suggestions as suggestion (suggestion.name)}
            <option value={suggestion.name}>{suggestion.event_count} 个活动</option>
        {/each}
    </datalist>
</div>
