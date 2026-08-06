<script lang="ts">
    import RotateCcw from "phosphor-svelte/lib/ArrowsClockwise";
    import CheckCircle2 from "phosphor-svelte/lib/CheckCircle";
    import Download from "phosphor-svelte/lib/DownloadSimple";
    import FileSpreadsheet from "phosphor-svelte/lib/FileCsv";
    import Upload from "phosphor-svelte/lib/UploadSimple";
    import AlertTriangle from "phosphor-svelte/lib/WarningCircle";
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
    import LoaderCircle from "../ui/spinner.svelte";

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

<div class="bulk-import">
    <section class="bulk-upload-section">
        <div class="bulk-upload-main">
            <Label for="bulk-event-file">CSV 文件</Label>
            <div class="bulk-file-row">
                <FileUpload
                    bind:files={selectedFiles}
                    bind:elementRef={fileInput}
                    id="bulk-event-file"
                    accept=".csv,text/csv"
                    class="bulk-file-input"
                    onchange={(event) => {
                        const input = event.currentTarget;
                        setFile(input.files?.[0] ?? null);
                    }}
                />
                <Button type="button" disabled={!file || pending} onclick={previewFile}>
                    {#if state === "previewing"}
                        <LoaderCircle label="预览中" />
                        预览中
                    {:else}
                        <Upload size={17} aria-hidden="true" />
                        预览 CSV
                    {/if}
                </Button>
            </div>
            <p class="bulk-help">UTF-8 CSV · 1 至 20 条活动 · 最大 1 MiB</p>
        </div>

        <div class="bulk-template-help">
            <Button href="/api/admin/events/bulk/template" variant="outline">
                <Download size={17} aria-hidden="true" />
                下载 CSV 模板
            </Button>
            <dl class="bulk-option-help">
                <div>
                    <dt>活动类型</dt>
                    <dd>
                        {EVENT_TYPES.map(({ name, label }) => `${label} (${name})`).join("、")}
                    </dd>
                </div>
                <div>
                    <dt>活动规模</dt>
                    <dd>
                        {EVENT_SCALES.map(({ name, label }) => `${label} (${name})`).join("、")}
                    </dd>
                </div>
            </dl>
        </div>
    </section>

    {#if state === "success"}
        <section aria-labelledby="bulk-result-heading">
            <div class="bulk-result-header">
                <div>
                    <h2
                        bind:this={resultHeading}
                        id="bulk-result-heading"
                        class="bulk-result-title"
                        tabindex="-1"
                    >
                        <CheckCircle2 size={20} aria-hidden="true" />
                        已创建 {createdEvents.length} 条活动
                    </h2>
                    <p>活动已发布, 并已写入独立审计记录</p>
                </div>
                <Button type="button" variant="outline" size="sm" onclick={reset}>
                    <RotateCcw size={17} aria-hidden="true" />
                    导入下一批
                </Button>
            </div>
            <ul class="bulk-created-list" aria-label="已创建活动">
                {#each createdEvents as event (event.id)}
                    <li>
                        <div>
                            <p>
                                {event.title}
                            </p>
                            <small>ID {event.id}</small>
                        </div>
                        <a href={`/admin/events/${event.id}/edit`} class="bulk-edit-link">
                            编辑活动
                        </a>
                    </li>
                {/each}
            </ul>
        </section>
    {:else if preview || errorMessage}
        <section aria-labelledby="bulk-result-heading">
            <div class="bulk-result-header">
                <div>
                    <h2
                        bind:this={resultHeading}
                        id="bulk-result-heading"
                        class="bulk-result-title"
                        tabindex="-1"
                    >
                        {preview?.valid ? `预览 ${preview.rows.length} 条活动` : "CSV 校验结果"}
                    </h2>
                    {#if errorMessage}
                        <Alert tone="danger" class="bulk-inline-alert">
                            {errorMessage}
                        </Alert>
                    {/if}
                </div>
                <Button type="button" variant="outline" size="sm" onclick={reset}>
                    <RotateCcw size={17} aria-hidden="true" />
                    重置
                </Button>
            </div>

            {#if preview?.errors.length}
                <Alert tone="danger" class="bulk-result-alert">
                    <h3>
                        发现 {preview.errors.length} 个错误
                    </h3>
                    <ul class="bulk-error-list">
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
                <Alert tone="warning" class="bulk-result-alert">
                    <h3 class="bulk-warning-title">
                        <AlertTriangle size={17} aria-hidden="true" />
                        疑似重复活动
                    </h3>
                    <div class="bulk-warning-list">
                        {#each preview.warnings as warning (warning.key)}
                            <Checkbox
                                class="bulk-warning-checkbox"
                                checked={confirmedWarningKeys.includes(warning.key)}
                                onCheckedChange={(checked) =>
                                    setWarningConfirmed(warning.key, checked)}
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
                                    <span class="bulk-warning-confirm">确认仍要创建此活动</span>
                                </span>
                            </Checkbox>
                        {/each}
                    </div>
                </Alert>
            {/if}

            {#if preview?.rows.length}
                <div class="bulk-preview-table">
                    <Table class="bulk-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead>行</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>活动名称</TableHead>
                                <TableHead>类型 / 规模</TableHead>
                                <TableHead>日期</TableHead>
                                <TableHead>场馆</TableHead>
                                <TableHead>标签</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {#each preview.rows as row (row.row)}
                                <TableRow>
                                    <TableCell class="bulk-row-number">{row.row}</TableCell>
                                    <TableCell>
                                        <span class={row.valid ? "bulk-valid" : "bulk-invalid"}>
                                            {row.valid ? "有效" : "有误"}
                                        </span>
                                    </TableCell>
                                    <TableCell class="bulk-title-cell">
                                        {row.title || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {row.type || "-"} / {row.scale || "-"}
                                    </TableCell>
                                    <TableCell class="bulk-date-cell">
                                        {row.startDate || "-"} 至 {row.endDate || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {row.venue || "-"}
                                    </TableCell>
                                    <TableCell>
                                        {row.tags.join("、") || "-"}
                                    </TableCell>
                                </TableRow>
                            {/each}
                        </TableBody>
                    </Table>
                </div>
            {/if}

            <div class="bulk-submit-row">
                <p role="status" aria-live="polite">
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
                <Button type="button" disabled={!canSubmit || pending} onclick={submitEvents}>
                    {#if state === "submitting"}
                        <LoaderCircle label="创建中" />
                        创建中
                    {:else}
                        <FileSpreadsheet size={17} aria-hidden="true" />
                        创建 {preview?.rows.length ?? 0} 条活动
                    {/if}
                </Button>
            </div>
        </section>
    {/if}
</div>
