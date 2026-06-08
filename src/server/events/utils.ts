const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
});

export function nowIso(): string {
    return new Date().toISOString();
}

export function createId(prefix: string): string {
    const random =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID().slice(0, 8)
            : Math.random().toString(36).slice(2, 10);
    return `${prefix}_${random}`;
}

export function slugify(input: string): string {
    const ascii = input
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);

    return ascii || `event-${Date.now().toString(36)}`;
}

export function uniqueSlug(base: string, existing: Iterable<string>): string {
    const used = new Set(existing);
    let candidate = slugify(base);
    let suffix = 2;

    while (used.has(candidate)) {
        candidate = `${slugify(base)}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

export function parseJsonArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string");
    }

    if (typeof value !== "string" || value.trim() === "") {
        return [];
    }

    try {
        const parsed = JSON.parse(value) as unknown;
        return Array.isArray(parsed)
            ? parsed.filter((item): item is string => typeof item === "string")
            : [];
    } catch {
        return [];
    }
}

export function booleanFromSql(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}

export function isEnded(event: { endsAt: string }, now = new Date()): boolean {
    return new Date(event.endsAt).getTime() < now.getTime();
}

export function isUpcoming(
    event: { endsAt: string },
    now = new Date(),
): boolean {
    return !isEnded(event, now);
}

export function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

export function observedDay(date = new Date()): string {
    return startOfUtcDay(date).toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
}

export function formatDateRange(startsAt: string, endsAt: string): string {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const sameDay = start.toDateString() === end.toDateString();

    if (sameDay) {
        return dateFormatter.format(start);
    }

    return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
}

export function readOptional(
    value: FormDataEntryValue | null,
): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
}

export function readRequired(value: FormDataEntryValue | null): string {
    return typeof value === "string" ? value.trim() : "";
}
