import type {
    AdminEvent,
    EventScale,
    VocabularyTerm,
} from "../../server/events/types";

interface Props {
    event: AdminEvent;
    eventTypes: VocabularyTerm[];
    eventIps: VocabularyTerm[];
    scales: EventScale[];
}

export default function EventReviewEditor({
    event,
    eventTypes,
    eventIps,
    scales,
}: Props) {
    return (
        <form
            className="grid gap-4"
            method="post"
            action={`/api/admin/events/${event.id}`}
        >
            <div className="form-grid">
                <Field name="name" label="活动名称" value={event.name} />
                <Field name="city" label="城市" value={event.city} />
                <Field name="venue" label="场馆" value={event.venue} />
                <Field
                    name="startsAt"
                    label="开始时间"
                    value={event.startsAt.slice(0, 16)}
                    type="datetime-local"
                />
                <Field
                    name="endsAt"
                    label="结束时间"
                    value={event.endsAt.slice(0, 16)}
                    type="datetime-local"
                />
                <label className="form-field">
                    <span>活动类型</span>
                    <select name="typeId" defaultValue={event.typeId ?? ""}>
                        <option value="">选择类型</option>
                        {eventTypes.map((term) => (
                            <option key={term.id} value={term.id}>
                                {term.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="form-field">
                    <span>活动 IP</span>
                    <select
                        name="eventIpId"
                        defaultValue={event.eventIpId ?? ""}
                    >
                        <option value="">选择 IP</option>
                        {eventIps.map((term) => (
                            <option key={term.id} value={term.id}>
                                {term.name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="form-field">
                    <span>规模</span>
                    <select name="scaleId" defaultValue={event.scaleId ?? ""}>
                        <option value="">选择规模</option>
                        {scales.map((scale) => (
                            <option key={scale.id} value={scale.id}>
                                {scale.name}
                            </option>
                        ))}
                    </select>
                </label>
                <Field
                    name="officialQqGroup"
                    label="官方 QQ 群"
                    value={event.officialQqGroup ?? ""}
                />
                <Field
                    name="ticketUrl"
                    label="购票地址"
                    value={event.ticketUrl ?? ""}
                    type="url"
                />
            </div>
            <label className="form-field">
                <span>简介</span>
                <textarea
                    name="description"
                    rows={4}
                    defaultValue={event.description ?? ""}
                />
            </label>
            <label className="form-field">
                <span>内部备注</span>
                <textarea
                    name="internalNote"
                    rows={3}
                    defaultValue={event.internalNote ?? ""}
                />
            </label>
            <div className="flex flex-wrap gap-2">
                <button
                    className="button-ghost"
                    name="action"
                    value="update"
                    type="submit"
                >
                    保存
                </button>
                <button
                    className="button-primary"
                    name="action"
                    value="approve"
                    type="submit"
                >
                    批准公开
                </button>
                <button
                    className="button-ghost"
                    name="action"
                    value="reject"
                    type="submit"
                >
                    拒绝
                </button>
                <button
                    className="button-ghost"
                    name="action"
                    value="archive"
                    type="submit"
                >
                    归档
                </button>
                <button
                    className="button-ghost"
                    name="action"
                    value="restore"
                    type="submit"
                >
                    恢复
                </button>
            </div>
        </form>
    );
}

function Field({
    label,
    name,
    value,
    type = "text",
}: {
    label: string;
    name: string;
    value: string;
    type?: string;
}) {
    return (
        <label className="form-field">
            <span>{label}</span>
            <input name={name} type={type} defaultValue={value} />
        </label>
    );
}
