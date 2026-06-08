import { useState } from "react";

type Errors = Record<string, string>;

export default function EventSubmissionForm() {
    const [errors, setErrors] = useState<Errors>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setErrors({});
        setSuccess(false);

        const form = event.currentTarget;
        const response = await fetch("/api/submissions", {
            method: "POST",
            body: new FormData(form),
        });
        const payload = (await response.json()) as {
            ok: boolean;
            errors?: Errors;
        };

        setIsSubmitting(false);

        if (!payload.ok) {
            setErrors(payload.errors ?? { form: "提交失败，请检查表单。" });
            return;
        }

        form.reset();
        setSuccess(true);
    }

    return (
        <form className="grid gap-4" onSubmit={onSubmit}>
            {errors.form && <div className="field-error">{errors.form}</div>}
            {success && (
                <div className="empty-state">
                    提交成功，活动已进入待审核队列。
                </div>
            )}
            <input type="hidden" name="turnstileToken" value="dev" />
            <div className="form-grid">
                <Field
                    label="活动名称"
                    name="name"
                    error={errors.name}
                    required
                />
                <Field label="城市" name="city" error={errors.city} required />
                <Field
                    label="场馆或地点"
                    name="venue"
                    error={errors.venue}
                    required
                />
                <Field
                    label="开始时间"
                    name="startsAt"
                    type="datetime-local"
                    error={errors.startsAt}
                    required
                />
                <Field
                    label="结束时间"
                    name="endsAt"
                    type="datetime-local"
                    error={errors.endsAt}
                    required
                />
                <Field
                    label="活动类型文本"
                    name="typeText"
                    error={errors.typeText}
                    required
                />
                <Field
                    label="活动 IP 文本"
                    name="eventIpText"
                    error={errors.eventIpText}
                    required
                />
                <Field
                    label="官方 QQ 群"
                    name="officialQqGroup"
                    error={errors.officialQqGroup}
                />
                <Field
                    label="购票地址"
                    name="ticketUrl"
                    type="url"
                    error={errors.ticketUrl}
                />
                <Field
                    label="联系方式"
                    name="submitterContact"
                    error={errors.submitterContact}
                />
            </div>
            <label className="form-field">
                <span>活动简介</span>
                <textarea name="description" rows={4} />
            </label>
            <label className="form-field">
                <span>封面图</span>
                <input
                    name="cover"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                />
                {errors.cover && (
                    <span className="field-error">{errors.cover}</span>
                )}
            </label>
            {errors.turnstile && (
                <div className="field-error">{errors.turnstile}</div>
            )}
            <button
                className="button-primary"
                type="submit"
                disabled={isSubmitting}
            >
                {isSubmitting ? "提交中" : "提交活动"}
            </button>
        </form>
    );
}

function Field({
    label,
    name,
    type = "text",
    error,
    required = false,
}: {
    label: string;
    name: string;
    type?: string;
    error?: string;
    required?: boolean;
}) {
    return (
        <label className="form-field">
            <span>{label}</span>
            <input name={name} type={type} required={required} />
            {error && <span className="field-error">{error}</span>}
        </label>
    );
}
