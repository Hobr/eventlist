import { EVENT_PERIODS, filtersToActionUrl } from "../../lib/event-filters";
import type {
    EventFilters as EventFiltersType,
    EventScale,
    VocabularyTerm,
} from "../../server/events/types";

interface Props {
    filters: EventFiltersType;
    eventTypes: VocabularyTerm[];
    eventIps: VocabularyTerm[];
    scales: EventScale[];
    cities: string[];
}

export default function EventFilters({
    filters,
    eventTypes,
    eventIps,
    scales,
    cities,
}: Props) {
    return (
        <form className="filter-bar" action="/" method="get">
            <label>
                <span>关键词</span>
                <input
                    name="q"
                    defaultValue={filters.q}
                    placeholder="活动、地点、IP"
                />
            </label>
            <label>
                <span>地点</span>
                <select name="city" defaultValue={filters.city ?? ""}>
                    <option value="">全部城市</option>
                    {cities.map((city) => (
                        <option key={city} value={city}>
                            {city}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                <span>时间</span>
                <select
                    name="period"
                    defaultValue={filters.period ?? "upcoming"}
                >
                    {EVENT_PERIODS.map((period) => (
                        <option key={period.value} value={period.value}>
                            {period.label}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                <span>类型</span>
                <select name="type" defaultValue={filters.typeId ?? ""}>
                    <option value="">全部类型</option>
                    {eventTypes.map((term) => (
                        <option key={term.id} value={term.id}>
                            {term.name}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                <span>活动 IP</span>
                <select name="ip" defaultValue={filters.eventIpId ?? ""}>
                    <option value="">全部 IP</option>
                    {eventIps.map((term) => (
                        <option key={term.id} value={term.id}>
                            {term.name}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                <span>规模</span>
                <select name="scale" defaultValue={filters.scaleId ?? ""}>
                    <option value="">全部规模</option>
                    {scales.map((scale) => (
                        <option key={scale.id} value={scale.id}>
                            {scale.name}
                        </option>
                    ))}
                </select>
            </label>
            <div className="filter-actions">
                <button className="button-primary" type="submit">
                    筛选
                </button>
                <a className="button-ghost" href={filtersToActionUrl({})}>
                    重置
                </a>
            </div>
        </form>
    );
}
