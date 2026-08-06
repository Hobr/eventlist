<script lang="ts">
    import { Combobox } from "bits-ui";
    import X from "phosphor-svelte/lib/X";
    import { untrack } from "svelte";
    import type { TagSummary } from "../lib/db/tags";
    import Button from "./ui/button.svelte";
    import Label from "./ui/label.svelte";

    interface Props {
        name?: string;
        initial?: string;
        label?: string;
        available?: TagSummary[];
        showRequiredIndicator?: boolean;
    }

    let {
        name = "tags",
        initial = "",
        label = "标签",
        available = [],
        showRequiredIndicator = false
    }: Props = $props();
    let tags = $state(
        untrack(() => initial)
            .split(/[,\n，、]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
    );
    let draft = $state("");
    let suggestions = $state<TagSummary[]>([]);
    let selectedSuggestion = $state("");
    let open = $state(false);
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
        selectedSuggestion = "";
        open = false;
        suggestionRequest += 1;
        if (timer) clearTimeout(timer);
        suggestions = [];
    }

    function removeTag(tag: string) {
        tags = tags.filter((item) => item !== tag);
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== "Enter" && event.key !== "," && event.key !== "，") return;
        event.preventDefault();
        addTag(selectedSuggestion || draft);
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
        draft = input.value.slice(0, 24);
        if (timer) clearTimeout(timer);
        const requestId = ++suggestionRequest;
        open = Boolean(draft.trim());
        if (!draft.trim()) {
            suggestions = [];
            return;
        }
        timer = setTimeout(() => void refreshSuggestions(draft, requestId), 160);
    }

    function handleSelection(value: string) {
        selectedSuggestion = value;
        if (value) addTag(value);
    }
</script>

<div class="tag-field">
    <Label for="tag-input"
        >{label}{#if showRequiredIndicator}<span class="required-indicator">必填</span>{/if}</Label
    >
    <input type="hidden" {name} value={serializedTags} />
    <div class="tag-control">
        {#each tags as tag (tag)}
            <Button
                type="button"
                variant="tonal"
                size="sm"
                onclick={() => removeTag(tag)}
                aria-label={`移除标签 ${tag}`}
                class="tag-chip"
            >
                {tag}<X size={13} aria-hidden="true" />
            </Button>
        {/each}
        <Combobox.Root
            type="single"
            bind:open
            inputValue={draft}
            value={selectedSuggestion}
            onValueChange={handleSelection}
        >
            <Combobox.Input
                id="tag-input"
                class="tag-input"
                autocomplete="off"
                placeholder="输入后按 Enter 添加"
                oninput={handleInput}
                onkeydown={handleKeydown}
                onblur={() => addTag()}
            />
            <Combobox.Portal>
                <Combobox.Content class="ui-select-content tag-suggestions" sideOffset={6}>
                    <Combobox.Viewport class="ui-select-viewport">
                        {#each suggestions as suggestion (suggestion.name)}
                            <Combobox.Item
                                value={suggestion.name}
                                label={suggestion.name}
                                class="ui-select-item"
                            >
                                <span>{suggestion.name}</span><small
                                    >{suggestion.event_count} 场</small
                                >
                            </Combobox.Item>
                        {/each}
                    </Combobox.Viewport>
                </Combobox.Content>
            </Combobox.Portal>
        </Combobox.Root>
    </div>
</div>
