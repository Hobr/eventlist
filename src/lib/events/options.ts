export interface EventOption {
    readonly name: string;
    readonly label: string;
}

export const EVENT_TYPES = [
    { name: "comic", label: "综合商业展" },
    { name: "doujin", label: "同人展" },
    { name: "concert", label: "演唱会/演奏会" },
    { name: "only", label: "Only展" },
    { name: "meeting", label: "见面会" },
    { name: "stage", label: "舞台剧" },
    { name: "dance", label: "宅舞" },
    { name: "ipflash", label: "IP快闪/联动" },
    { name: "exhibition", label: "展览" },
    { name: "online", label: "线上活动" },
    { name: "other", label: "其它" }
] as const satisfies readonly EventOption[];

export const EVENT_SCALES = [
    { name: "mini", label: "微型 (100人以下)" },
    { name: "small", label: "小型 (100 - 1,000人)" },
    { name: "mid", label: "中型 (1,000 - 5,000人)" },
    { name: "large", label: "大型 (5,000 - 10,000人)" },
    { name: "mega", label: "超大型 (1万人以上)" }
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
