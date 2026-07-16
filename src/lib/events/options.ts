export interface EventOption {
    readonly name: string;
    readonly label: string;
}

export const EVENT_TYPES = [
    { name: "comic", label: "漫展" },
    { name: "doujin", label: "同人展" },
    { name: "concert", label: "演唱会" },
    { name: "stage", label: "舞台剧·2.5次元" },
    { name: "dance", label: "舞见·宅舞" },
    { name: "ipflash", label: "IP主题快闪" },
    { name: "online", label: "线上活动" },
    { name: "other", label: "其它" }
] as const satisfies readonly EventOption[];

export const EVENT_SCALES = [
    { name: "small", label: "小型(地区级)" },
    { name: "mid", label: "中型(省级)" },
    { name: "large", label: "大型(全国级)" },
    { name: "mega", label: "超大型(国际级)" }
] as const satisfies readonly EventOption[];

export type EventType = (typeof EVENT_TYPES)[number]["name"];
export type EventScale = (typeof EVENT_SCALES)[number]["name"];

const eventTypeNames = new Set<string>(EVENT_TYPES.map(({ name }) => name));
const eventScaleNames = new Set<string>(EVENT_SCALES.map(({ name }) => name));
const eventTypeLabels = new Map<string, string>(
    EVENT_TYPES.map(({ name, label }) => [name, label] as const)
);
const eventScaleLabels = new Map<string, string>(
    EVENT_SCALES.map(({ name, label }) => [name, label] as const)
);

export function isEventType(value: string): value is EventType {
    return eventTypeNames.has(value);
}

export function isEventScale(value: string): value is EventScale {
    return eventScaleNames.has(value);
}

export function getEventTypeLabel(value: string) {
    return eventTypeLabels.get(value) ?? value;
}

export function getEventScaleLabel(value: string) {
    return eventScaleLabels.get(value) ?? value;
}
