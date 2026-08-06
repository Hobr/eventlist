<script lang="ts">
    import { AlertDialog } from "bits-ui";
    import Spinner from "./spinner.svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        title: string;
        description: string;
        confirmLabel?: string;
        cancelLabel?: string;
        tone?: "danger" | "primary";
        pending?: boolean;
        disabled?: boolean;
        confirmDisabled?: boolean;
        trigger: import("svelte").Snippet;
        children?: import("svelte").Snippet;
        onconfirm: () => boolean | Promise<boolean>;
        triggerClass?: string;
        contentClass?: string;
    }

    let {
        title,
        description,
        confirmLabel = "确认",
        cancelLabel = "取消",
        tone = "danger",
        pending = false,
        disabled = false,
        confirmDisabled = false,
        trigger,
        children = undefined,
        onconfirm,
        triggerClass = undefined,
        contentClass = undefined
    }: Props = $props();

    let open = $state(false);

    async function handleConfirm(event: MouseEvent) {
        event.preventDefault();
        if (pending || confirmDisabled) return;
        if (await onconfirm()) open = false;
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger
        class={cn("ui-button", triggerClass)}
        data-variant={tone === "danger" ? "destructive" : "default"}
        data-size="sm"
        {disabled}
    >
        {@render trigger()}
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
        <AlertDialog.Overlay class="ui-dialog-overlay" />
        <AlertDialog.Content class={cn("ui-dialog-content ui-alert-dialog", contentClass)}>
            <AlertDialog.Title class="ui-dialog-title">{title}</AlertDialog.Title>
            <AlertDialog.Description class="ui-dialog-description">
                {description}
            </AlertDialog.Description>
            {#if children}<div class="ui-dialog-extra">{@render children()}</div>{/if}
            <div class="ui-dialog-actions">
                <AlertDialog.Cancel
                    class="ui-button"
                    data-variant="outline"
                    data-size="md"
                    disabled={pending}
                >
                    {cancelLabel}
                </AlertDialog.Cancel>
                <AlertDialog.Action
                    class="ui-button"
                    data-variant={tone === "danger" ? "destructive" : "default"}
                    data-size="md"
                    disabled={pending || confirmDisabled}
                    aria-busy={pending}
                    onclick={handleConfirm}
                >
                    {#if pending}<Spinner />{/if}
                    {pending ? "处理中" : confirmLabel}
                </AlertDialog.Action>
            </div>
        </AlertDialog.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>
