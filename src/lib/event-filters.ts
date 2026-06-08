import type { EventFilters } from "../server/events/types";

type EventPeriod = NonNullable<EventFilters["period"]>;

export const EVENT_PERIODS = [
    { value: "upcoming", label: "近期" },
    { value: "this-week", label: "本周" },
    { value: "this-month", label: "本月" },
    { value: "past", label: "已结束" },
    { value: "all", label: "全部" },
] as const;

const allowedPeriods = new Set<EventPeriod>(
    EVENT_PERIODS.map((period) => period.value),
);

export function parseEventFilters(input: URLSearchParams): EventFilters {
    const period = input.get("period")?.trim();
    const parsedPeriod =
        period && allowedPeriods.has(period as EventPeriod)
            ? (period as EventPeriod)
            : "upcoming";

    return cleanFilters({
        city: input.get("city") ?? undefined,
        period: parsedPeriod,
        typeId: input.get("type") ?? undefined,
        eventIpId: input.get("ip") ?? undefined,
        scaleId: input.get("scale") ?? undefined,
        q: input.get("q") ?? undefined,
    });
}

export function cleanFilters(filters: EventFilters): EventFilters {
    return Object.fromEntries(
        Object.entries(filters)
            .map(([key, value]) => [
                key,
                typeof value === "string" ? value.trim() : value,
            ])
            .filter(([, value]) => value !== undefined && value !== ""),
    ) as EventFilters;
}

export function serializeEventFilters(filters: EventFilters): string {
    const clean = cleanFilters(filters);
    const params = new URLSearchParams();

    if (clean.city) params.set("city", clean.city);
    if (clean.period && clean.period !== "upcoming")
        params.set("period", clean.period);
    if (clean.typeId) params.set("type", clean.typeId);
    if (clean.eventIpId) params.set("ip", clean.eventIpId);
    if (clean.scaleId) params.set("scale", clean.scaleId);
    if (clean.q) params.set("q", clean.q);

    return params.toString();
}

export function filtersToActionUrl(filters: EventFilters, base = "/"): string {
    const query = serializeEventFilters(filters);
    return query ? `${base}?${query}` : base;
}
