import type { EventScale, VocabularyTerm } from "../../server/events/types";

export default function VocabularyManager({
    title,
    kind,
    terms,
    scales,
}: {
    title: string;
    kind: "event_type" | "event_ip" | "scale";
    terms?: VocabularyTerm[];
    scales?: EventScale[];
}) {
    const rows = terms ?? scales ?? [];

    return (
        <div className="grid gap-4">
            <form
                className="filter-bar"
                method="post"
                action="/api/admin/vocabularies"
            >
                <input type="hidden" name="action" value="create" />
                <input type="hidden" name="kind" value={kind} />
                <input
                    type="hidden"
                    name="returnTo"
                    value={
                        kind === "scale"
                            ? "/admin/scales"
                            : "/admin/vocabularies"
                    }
                />
                <label>
                    <span>名称</span>
                    <input name="name" required />
                </label>
                <label>
                    <span>Slug</span>
                    <input name="slug" />
                </label>
                <label>
                    <span>{kind === "scale" ? "优先级" : "排序"}</span>
                    <input
                        name={kind === "scale" ? "priority" : "sortOrder"}
                        type="number"
                        defaultValue="0"
                    />
                </label>
                <div className="filter-actions">
                    <button className="button-primary" type="submit">
                        新增
                    </button>
                </div>
            </form>
            <section>
                <h2 className="mb-2 text-lg font-semibold">{title}</h2>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>名称</th>
                            <th>Slug</th>
                            <th>排序</th>
                            <th>状态</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td colSpan={5}>
                                    <form
                                        className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_120px_auto]"
                                        method="post"
                                        action="/api/admin/vocabularies"
                                    >
                                        <input
                                            type="hidden"
                                            name="action"
                                            value="update"
                                        />
                                        <input
                                            type="hidden"
                                            name="kind"
                                            value={kind}
                                        />
                                        <input
                                            type="hidden"
                                            name="id"
                                            value={row.id}
                                        />
                                        <input
                                            type="hidden"
                                            name="returnTo"
                                            value={
                                                kind === "scale"
                                                    ? "/admin/scales"
                                                    : "/admin/vocabularies"
                                            }
                                        />
                                        <input
                                            name="name"
                                            defaultValue={row.name}
                                            aria-label="名称"
                                        />
                                        <input
                                            name="slug"
                                            defaultValue={row.slug}
                                            aria-label="Slug"
                                        />
                                        <input
                                            name={
                                                kind === "scale"
                                                    ? "priority"
                                                    : "sortOrder"
                                            }
                                            type="number"
                                            defaultValue={
                                                "priority" in row
                                                    ? row.priority
                                                    : row.sortOrder
                                            }
                                            aria-label="排序"
                                        />
                                        <select
                                            name="isActive"
                                            defaultValue={
                                                row.isActive ? "true" : "false"
                                            }
                                            aria-label="状态"
                                        >
                                            <option value="true">启用</option>
                                            <option value="false">停用</option>
                                        </select>
                                        <button
                                            className="button-ghost"
                                            type="submit"
                                        >
                                            保存
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
        </div>
    );
}
