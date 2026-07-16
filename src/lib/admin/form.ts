import type { AdminEventInput } from "../db/queries";
import { normalizeOptionalTime, validateEventSchedule } from "../events/datetime";

function readRequired(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${name} is required`);
    }

    return value.trim();
}

function readOptional(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

export function parseEventForm(formData: FormData): AdminEventInput {
    const divisionCode = readRequired(formData, "division_code");
    if (!/^\d{6}(\d{6})?$/.test(divisionCode)) {
        throw new Error("division_code must be a county code");
    }

    const tagsValue = readOptional(formData, "tags") ?? "";
    const startDate = readRequired(formData, "start_date");
    const endDate = readRequired(formData, "end_date");
    if (endDate < startDate) {
        throw new Error("结束日期不能早于开始日期");
    }
    const startTime = normalizeOptionalTime(readOptional(formData, "start_time"), "开始时间");
    const endTime = normalizeOptionalTime(readOptional(formData, "end_time"), "结束时间");
    validateEventSchedule({
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime
    });

    return {
        title: readRequired(formData, "title"),
        type: readRequired(formData, "type"),
        scale: readRequired(formData, "scale"),
        division_code: divisionCode,
        venue: readRequired(formData, "venue"),
        address: readOptional(formData, "address"),
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        cover_url: readOptional(formData, "cover_url"),
        description: readOptional(formData, "description"),
        qq_group: readOptional(formData, "qq_group"),
        ticket_url: readOptional(formData, "ticket_url"),
        source_url: readRequired(formData, "source_url"),
        submitter_contact: readRequired(formData, "submitter_contact"),
        tags: tagsValue
            .split(/[,\n，、]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
    };
}
