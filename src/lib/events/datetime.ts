export interface EventSchedule {
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
}

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function normalizeOptionalTime(value: string | null, label: string) {
    if (!value) return null;
    const normalized = value.trim();
    if (!TIME_PATTERN.test(normalized)) {
        throw new Error(`${label}格式无效`);
    }
    return normalized;
}

export function validateEventSchedule(schedule: EventSchedule) {
    if (
        schedule.start_date === schedule.end_date &&
        schedule.start_time &&
        schedule.end_time &&
        schedule.end_time < schedule.start_time
    ) {
        throw new Error("同一天的结束时间不能早于开始时间");
    }
}

export function formatEventSchedule(schedule: EventSchedule) {
    const { start_date, end_date, start_time, end_time } = schedule;

    if (start_date === end_date) {
        if (start_time && end_time) return `${start_date} ${start_time}–${end_time}`;
        if (start_time) return `${start_date} ${start_time} 开始`;
        if (end_time) return `${start_date} ${end_time} 结束`;
        return start_date;
    }

    const start = start_time ? `${start_date} ${start_time}` : start_date;
    const end = end_time ? `${end_date} ${end_time}` : end_date;
    return `${start} - ${end}`;
}

export function toEventIsoDateTime(date: string, time: string | null) {
    return time ? `${date}T${time}:00+08:00` : date;
}
