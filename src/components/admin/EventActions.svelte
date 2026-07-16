<script lang="ts">
    import Check from "@lucide/svelte/icons/check";
    import CircleOff from "@lucide/svelte/icons/circle-off";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import Pencil from "@lucide/svelte/icons/pencil";
    import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
    import X from "@lucide/svelte/icons/x";
    import Button from "../ui/button.svelte";
    import ConfirmDialog from "../ui/confirm-dialog.svelte";

    type Mode = "pending" | "published" | "offline";
    type Action = "approve" | "reject" | "offline" | "republish";

    interface Props {
        eventId: number;
        mode: Mode;
        hasTags: boolean;
    }

    let { eventId, mode, hasTags }: Props = $props();
    let pendingAction = $state<Action | null>(null);
    let errorMessage = $state("");
    let rejectReason = $state("");
    const busy = $derived(pendingAction !== null);

    async function submitAction(action: Action, formData?: FormData) {
        if (busy) return false;
        pendingAction = action;
        errorMessage = "";

        try {
            const response = await fetch(`/api/admin/events/${eventId}/${action}`, {
                method: "POST",
                body: formData
            });
            if (!response.ok) {
                const body = (await response.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(body?.error ?? "操作失败，请重试");
            }

            window.location.reload();
            return true;
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "操作失败，请重试";
            return false;
        } finally {
            pendingAction = null;
        }
    }

    function rejectEvent() {
        const reason = rejectReason.trim();
        if (!reason) {
            errorMessage = "请填写驳回理由";
            return false;
        }
        const formData = new FormData();
        formData.set("reject_reason", reason);
        return submitAction("reject", formData);
    }
</script>

<div class="flex min-w-32 flex-col gap-2">
    {#if mode === "pending"}
        <Button href={`/admin/events/${eventId}/edit`} variant="outline" size="sm" class="w-full">
            <Pencil class="size-3.5" aria-hidden="true" />
            整理标签
        </Button>
        <Button
            size="sm"
            class="w-full"
            disabled={busy || !hasTags}
            onclick={() => void submitAction("approve")}
        >
            {#if pendingAction === "approve"}
                <LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
            {:else}
                <Check class="size-3.5" aria-hidden="true" />
            {/if}
            {pendingAction === "approve" ? "处理中" : "通过"}
        </Button>
        {#if !hasTags}
            <p class="text-warning text-xs leading-5 font-semibold" role="status">
                请先整理至少一个规范标签。
            </p>
        {/if}

        <ConfirmDialog
            title="驳回这条投稿？"
            description="请写明需要投稿者修正的内容。驳回后，该活动不会公开展示。"
            confirmLabel="确认驳回"
            pending={pendingAction === "reject"}
            disabled={busy}
            confirmDisabled={!rejectReason.trim()}
            onconfirm={rejectEvent}
        >
            {#snippet trigger()}
                <X class="size-3.5" aria-hidden="true" />
                驳回
            {/snippet}
            {#snippet children()}
                <label
                    class="text-muted-foreground text-sm font-semibold"
                    for={`reject-reason-${eventId}`}
                >
                    驳回理由
                </label>
                <textarea
                    id={`reject-reason-${eventId}`}
                    name="reject_reason"
                    bind:value={rejectReason}
                    required
                    rows="3"
                    class="border-border-strong bg-surface text-foreground placeholder:text-muted focus-visible:border-ring focus-visible:ring-ring/40 mt-1.5 flex w-full resize-y rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    placeholder="例如：请补充官方来源链接"></textarea>
            {/snippet}
        </ConfirmDialog>
    {:else if mode === "published"}
        <Button href={`/admin/events/${eventId}/edit`} variant="outline" size="sm" class="w-full">
            <Pencil class="size-3.5" aria-hidden="true" />
            编辑
        </Button>
        <ConfirmDialog
            title="下线这个活动？"
            description="活动会从公开列表中移除，但数据会保留，可以稍后重新发布。"
            confirmLabel="确认下线"
            pending={pendingAction === "offline"}
            disabled={busy}
            onconfirm={() => submitAction("offline")}
        >
            {#snippet trigger()}
                <CircleOff class="size-3.5" aria-hidden="true" />
                下线
            {/snippet}
        </ConfirmDialog>
    {:else}
        <Button href={`/admin/events/${eventId}/edit`} variant="outline" size="sm" class="w-full">
            <Pencil class="size-3.5" aria-hidden="true" />
            编辑
        </Button>
        <Button
            variant="tonal"
            size="sm"
            class="w-full"
            disabled={busy || !hasTags}
            onclick={() => void submitAction("republish")}
        >
            {#if pendingAction === "republish"}
                <LoaderCircle class="size-3.5 animate-spin" aria-hidden="true" />
            {:else}
                <RotateCcw class="size-3.5" aria-hidden="true" />
            {/if}
            {pendingAction === "republish" ? "处理中" : "重新发布"}
        </Button>
        {#if !hasTags}
            <p class="text-warning text-xs leading-5 font-semibold" role="status">
                请先整理至少一个规范标签。
            </p>
        {/if}
    {/if}

    {#if errorMessage}
        <p class="text-danger text-xs leading-5 font-semibold" role="alert">{errorMessage}</p>
    {/if}
</div>
