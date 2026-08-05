<script lang="ts">
    import { Spinner as LoaderCircle } from "flowbite-svelte";
    import {
        CheckCircleOutline as CheckCircle2,
        DownloadOutline as Download,
        ExclamationCircleOutline as AlertTriangle,
        FileCsvOutline as FileSpreadsheet,
        RefreshOutline as RotateCcw,
        UploadOutline as Upload
    } from "flowbite-svelte-icons";
    import { tick } from "svelte";
    import {
        BulkEventCsvError,
        createBulkEventErrorPreview,
        parseBulkEventCsv,
        type BulkPreviewData
    } from "../../lib/admin/bulk-events";
    import { EVENT_SCALES, EVENT_TYPES } from "../../lib/events/options";
    import Alert from "../ui/alert.svelte";
    import Button from "../ui/button.svelte";
    import Checkbox from "../ui/checkbox.svelte";
    import FileUpload from "../ui/file-upload.svelte";
    import Label from "../ui/label.svelte";
    import Table from "../ui/table.svelte";
    import TableBody from "../ui/table-body.svelte";
    import TableCell from "../ui/table-cell.svelte";
    import TableHead from "../ui/table-head.svelte";
    import TableHeader from "../ui/table-header.svelte";
    import TableRow from "../ui/table-row.svelte";

    interface CreatedEvent {
        id: number;
        title: string;
    }

    interface BulkApiBody {
        ok: boolean;
        error?: string;
        data?: {
            preview?: BulkPreviewData;
            events?: CreatedEvent[];
        };
        details?: {
            preview?: BulkPreviewData;
        };
    }

    type ImportState = "initial" | "previewing" | "ready" | "invalid" | "submitting" | "success";

    let state: ImportState = $state("initial");
    let file: File | null = $state(null);
    let preview: BulkPreviewData | null = $state(null);
    let createdEvents: CreatedEvent[] = $state([]);
    let errorMessage = $state("");
    let confirmedWarningKeys = $state<string[]>([]);
    let selectedFiles = $state<FileList | null>();
    let fileInput = $state<HTMLInputElement>();
    let resultHeading = $state<HTMLHeadingElement>();

    const pending = $derived(state === "previewing" || state === "submitting");
    const allWarningsConfirmed = $derived(
        preview?.warnings.every(({ key }) => confirmedWarningKeys.includes(key)) ?? false
    );
    const canSubmit = $derived(
        state === "ready" &&
            preview?.valid === true &&
            (preview.warnings.length === 0 || allWarningsConfirmed)
    );

    function focusResult() {
        void tick().then(() => resultHeading?.focus());
    }

    function setFile(nextFile: File | null) {
        file = nextFile;
        preview = null;
        createdEvents = [];
        confirmedWarningKeys = [];
        errorMessage = "";
        state = "initial";
    }

    function reset() {
        setFile(null);
        selectedFiles = undefined;
        if (fileInput) fileInput.value = "";
        fileInput?.focus();
    }

    async function readBody(response: Response) {
        return (await response.json().catch(() => null)) as BulkApiBody | null;
    }

    async function previewFile() {
        if (!file || pending) return;

        state = "previewing";
        errorMessage = "";
        preview = null;
        confirmedWarningKeys = [];

        try {
            const clientResult = await parseBulkEventCsv(file);
            preview = clientResult.preview;
            if (!clientResult.preview.valid) {
                errorMessage = "CSV 包含需要修正的记录";
                state = "invalid";
                focusResult();
                return;
            }
        } catch (error) {
            errorMessage =
                error instanceof BulkEventCsvError ? error.message : "无法在浏览器中解析 CSV";
            preview = createBulkEventErrorPreview(errorMessage);
            state = "invalid";
            focusResult();
            return;
        }

        const formData = new FormData();
        formData.set("file", file);

        try {
            const response = await fetch("/api/admin/events/bulk/preview", {
                method: "POST",
                body: formData
            });
            const body = await readBody(response);
            const nextPreview = body?.data?.preview ?? body?.details?.preview ?? null;
            preview = nextPreview;

            if (!response.ok) {
                errorMessage = body?.error ?? "CSV 预览失败, 请重试";
                state = "invalid";
            } else if (!nextPreview?.valid) {
                errorMessage = "CSV 包含需要修正的记录";
                state = "invalid";
            } else {
                state = "ready";
            }
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "CSV 预览失败, 请重试";
            state = "invalid";
        }

        focusResult();
    }

    function setWarningConfirmed(key: string, checked: boolean) {
        confirmedWarningKeys = checked
            ? [...new Set([...confirmedWarningKeys, key])]
            : confirmedWarningKeys.filter((candidate) => candidate !== key);
    }

    async function submitEvents() {
        if (!file || !canSubmit || pending) return;

        state = "submitting";
        errorMessage = "";
        const formData = new FormData();
        formData.set("file", file);
        for (const key of confirmedWarningKeys) {
            formData.append("confirmed_warning_keys", key);
        }

        try {
            const response = await fetch("/api/admin/events/bulk", {
                method: "POST",
                body: formData
            });
            const body = await readBody(response);

            if (!response.ok) {
                const nextPreview = body?.details?.preview;
                if (nextPreview) preview = nextPreview;
                confirmedWarningKeys = [];
                errorMessage = body?.error ?? "批量创建失败, 请重试";
                state = nextPreview?.valid ? "ready" : "invalid";
                focusResult();
                return;
            }

            createdEvents = body?.data?.events ?? [];
            state = "success";
            focusResult();
        } catch (error) {
            errorMessage = error instanceof Error ? error.message : "批量创建失败, 请重试";
            state = "ready";
            focusResult();
        }
    }
</script>

<div class="flex flex-col gap-8">
    <section class="grid gap-6 border-b border-border/80 pb-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div class="min-w-0">
            <Label class="text-foreground" for="bulk-event-file">CSV 文件</Label>
            <div class="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <FileUpload
                    bind:files={selectedFiles}
                    bind:elementRef={fileInput}
                    id="bulk-event-file"
                    accept=".csv,text/csv"
                    class="min-w-0 flex-1"
                    onchange={(event) => {
                        const input = event.currentTarget;
                        setFile(input.files?.[0] ?? null);
                    }}
                />
                <Button type="button" disabled={!file || pending} onclick={previewFile}>
                    {#if state === "previewing"}
                        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
                        预览中
                    {:else}
                        <Upload class="size-4" aria-hidden="true" />
                        预览 CSV
                    {/if}
                </Button>
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
                UTF-8 CSV · 1 至 20 条活动 · 最大 1 MiB
            </p>
        </div>

        <div class="border-l-0 border-border xl:border-l xl:pl-6">
            <Button href="/api/admin/events/bulk/template" variant="outline">
                <Download class="size-4" aria-hidden="true" />
                下载 CSV 模板
            </Button>
            <dl class="mt-4 grid gap-3 text-xs">
                <div>
                    <dt class="font-semibold text-muted">活动类型</dt>
                    <dd class="mt-1 leading-5 text-muted-foreground">
                        {EVENT_TYPES.map(({ name, label }) => `${label} (${name})`).join("、")}
                    </dd>
                </div>
                <div>
                    <dt class="font-semibold text-muted">活动规模</dt>
                    <dd class="mt-1 leading-5 text-muted-foreground">
                        {EVENT_SCALES.map(({ name, label }) => `${label} (${name})`).join("、")}
                    </dd>
                </div>
            </dl>
        </div>
    </section>

    {#if state === "success"}
        <section aria-labelledby="bulk-result-heading">
            <div
                class="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"
            >
                <div>
                    <h2
                        bind:this={resultHeading}
                        id="bulk-result-heading"
                        class="flex items-center gap-2 text-base font-black text-foreground focus:outline-none"
                        tabindex="-1"
                    >
                        <CheckCircle2 class="size-5 text-accent" aria-hidden="true" />
                        已创建 {createdEvents.length} 条活动
                    </h2>
                    <p class="mt-1 text-sm text-muted-foreground">
                        活动已发布, 并已写入独立审计记录
                    </p>
                </div>
                <Button type="button" variant="outline" size="sm" class="h-9" onclick={reset}>
                    <RotateCcw class="size-4" aria-hidden="true" />
                    导入下一批
                </Button>
            </div>
            <ul class="divide-y divide-border" aria-label="已创建活动">
                {#each createdEvents as event (event.id)}
                    <li class="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div class="min-w-0">
                            <p class="truncate text-sm font-semibold text-foreground">
                                {event.title}
                            </p>
                            <p class="mt-1 text-xs text-muted">ID {event.id}</p>
                        </div>
                        <a
                            href={`/admin/events/${event.id}/edit`}
                            class="text-sm font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                        >
                            编辑活动
                        </a>
                    </li>
                {/each}
            </ul>
        </section>
    {:else if preview || errorMessage}
        <section aria-labelledby="bulk-result-heading">
            <div
                class="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5"
            >
                <div>
                    <h2
                        bind:this={resultHeading}
                        id="bulk-result-heading"
                        class="text-base font-black text-foreground focus:outline-none"
                        tabindex="-1"
                    >
                        {preview?.valid ? `预览 ${preview.rows.length} 条活动` : "CSV 校验结果"}
                    </h2>
                    {#if errorMessage}
                        <Alert tone="danger" class="mt-3 py-2 font-semibold">
                            {errorMessage}
                        </Alert>
                    {/if}
                </div>
                <Button type="button" variant="outline" size="sm" class="h-9" onclick={reset}>
                    <RotateCcw class="size-4" aria-hidden="true" />
                    重置
                </Button>
            </div>

            {#if preview?.errors.length}
                <Alert tone="danger" class="mt-5 border-l-4 px-4 py-3">
                    <h3 class="font-black">
                        发现 {preview.errors.length} 个错误
                    </h3>
                    <ul class="mt-2 space-y-1 text-sm text-danger">
                        {#each preview.errors as error}
                            <li>
                                {error.row ? `第 ${error.row} 行` : "文件"}{error.field
                                    ? ` · ${error.field}`
                                    : ""}：{error.message}
                            </li>
                        {/each}
                    </ul>
                </Alert>
            {/if}

            {#if preview?.warnings.length}
                <Alert tone="warning" class="mt-5 border-l-4 px-4 py-3">
                    <h3 class="flex items-center gap-2 font-black">
                        <AlertTriangle class="size-4" aria-hidden="true" />
                        疑似重复活动
                    </h3>
                    <div class="mt-3 divide-y divide-warning/25">
                        {#each preview.warnings as warning (warning.key)}
                            <Checkbox
                                divClass="flex cursor-pointer items-start gap-3 py-3 text-sm text-warning"
                                class="mt-0.5 shrink-0"
                                checked={confirmedWarningKeys.includes(warning.key)}
                                onchange={(event) =>
                                    setWarningConfirmed(warning.key, event.currentTarget.checked)}
                            >
                                <span>
                                    <strong>第 {warning.row} 行</strong>
                                    {warning.source === "csv"
                                        ? "与 CSV 内记录重复"
                                        : "与数据库活动重复"}：
                                    {warning.matches
                                        .map((match) =>
                                            match.id
                                                ? `${match.title} (ID ${match.id})`
                                                : `${match.title} (第 ${match.row} 行)`
                                        )
                                        .join("、")}
                                    <span class="mt-1 block text-xs font-semibold"
                                        >确认仍要创建此活动</span
                                    >
                                </span>
                            </Checkbox>
                        {/each}
                    </div>
                </Alert>
            {/if}

            {#if preview?.rows.length}
                <div class="mt-6 overflow-x-auto rounded-md ring-1 ring-border/80">
                    <Table class="min-w-[58rem] border-collapse text-left">
                        <TableHeader class="bg-surface-subtle text-xs text-muted-foreground">
                            <TableRow class="hover:bg-surface-subtle">
                                <TableHead>行</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>活动名称</TableHead>
                                <TableHead>类型 / 规模</TableHead>
                                <TableHead>日期</TableHead>
                                <TableHead>场馆</TableHead>
                                <TableHead>标签</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody class="divide-y divide-border">
                            {#each preview.rows as row (row.row)}
                                <TableRow class="bg-surface hover:bg-surface">
                                    <TableCell class="font-mono text-xs text-muted"
                                        >{row.row}</TableCell
                                    >
                                    <TableCell>
                                        <span
                                            class={row.valid
                                                ? "font-semibold text-accent"
                                                : "font-semibold text-danger"}
                                        >
                                            {row.valid ? "有效" : "有误"}
                                        </span>
                                    </TableCell>
                                    <TableCell class="max-w-64 font-semibold text-foreground">
                                        {row.title || "-"}
                                    </TableCell>
                                    <TableCell class="text-muted-foreground">
                                        {row.type || "-"} / {row.scale || "-"}
                                    </TableCell>
                                    <TableCell class="whitespace-nowrap text-muted-foreground">
                                        {row.startDate || "-"} 至 {row.endDate || "-"}
                                    </TableCell>
                                    <TableCell class="max-w-56 text-muted-foreground">
                                        {row.venue || "-"}
                                    </TableCell>
                                    <TableCell class="max-w-64 text-muted-foreground">
                                        {row.tags.join("、") || "-"}
                                    </TableCell>
                                </TableRow>
                            {/each}
                        </TableBody>
                    </Table>
                </div>
            {/if}

            <div
                class="mt-6 flex flex-col items-stretch justify-between gap-3 border-t border-border/80 pt-5 sm:flex-row sm:items-center"
            >
                <p class="text-sm text-muted-foreground" role="status" aria-live="polite">
                    {#if state === "submitting"}
                        正在重新校验并创建活动…
                    {:else if preview?.warnings.length && !allWarningsConfirmed}
                        请确认全部疑似重复项后提交
                    {:else if preview?.valid}
                        服务端将在提交时重新解析原始文件
                    {:else}
                        请修正 CSV 后重新预览
                    {/if}
                </p>
                <Button
                    type="button"
                    class="px-5"
                    disabled={!canSubmit || pending}
                    onclick={submitEvents}
                >
                    {#if state === "submitting"}
                        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
                        创建中
                    {:else}
                        <FileSpreadsheet class="size-4" aria-hidden="true" />
                        创建 {preview?.rows.length ?? 0} 条活动
                    {/if}
                </Button>
            </div>
        </section>
    {/if}
</div>
