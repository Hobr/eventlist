<script lang="ts">
    import Merge from "@lucide/svelte/icons/git-merge";
    import SelectField, { type SelectOption } from "../SelectField.svelte";
    import ConfirmDialog from "../ui/confirm-dialog.svelte";

    interface Props {
        options: SelectOption[];
    }

    let { options }: Props = $props();
    let sourceId = $state("");
    let targetId = $state("");
    let pending = $state(false);
    let errorMessage = $state("");

    const sourceLabel = $derived(options.find((option) => option.value === sourceId)?.label ?? "");
    const targetLabel = $derived(options.find((option) => option.value === targetId)?.label ?? "");
    const selectionInvalid = $derived(!sourceId || !targetId || sourceId === targetId);

    async function mergeTags() {
        if (selectionInvalid || pending) {
            errorMessage = sourceId === targetId ? "源标签和目标标签不能相同" : "请选择两个标签";
            return false;
        }

        pending = true;
        errorMessage = "";
        const formData = new FormData();
        formData.set("from", sourceId);
        formData.set("to", targetId);

        try {
            const response = await fetch("/api/admin/tags/merge", {
                method: "POST",
                body: formData
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(body?.error ?? "归并失败，请重试");
            }

            window.location.reload();
            return true;
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "归并失败，请重试";
            return false;
        } finally {
            pending = false;
        }
    }
</script>

<form
    class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_10rem] lg:items-end"
    onsubmit={(event) => event.preventDefault()}
>
    <SelectField
        name="from"
        label="源标签"
        {options}
        placeholder="选择要归并的标签"
        required
        onchange={(value) => {
            sourceId = value;
            errorMessage = "";
        }}
    />
    <span class="text-muted hidden pb-3 text-sm font-semibold lg:block" aria-hidden="true">→</span>
    <SelectField
        name="to"
        label="目标标签"
        {options}
        placeholder="选择保留的规范标签"
        required
        onchange={(value) => {
            targetId = value;
            errorMessage = "";
        }}
    />
    <ConfirmDialog
        title="确认归并标签？"
        description={`${sourceLabel} 的活动会全部改为 ${targetLabel}。该操作不可逆。`}
        confirmLabel="确认归并"
        {pending}
        disabled={selectionInvalid || pending}
        onconfirm={mergeTags}
        triggerClass="h-10 text-sm"
    >
        {#snippet trigger()}
            <Merge class="size-4" aria-hidden="true" />
            归并
        {/snippet}
    </ConfirmDialog>
</form>

{#if sourceId && targetId && sourceId === targetId}
    <p class="text-danger mt-3 text-sm font-semibold" role="alert">源标签和目标标签不能相同</p>
{:else if errorMessage}
    <p class="text-danger mt-3 text-sm font-semibold" role="alert">{errorMessage}</p>
{/if}
