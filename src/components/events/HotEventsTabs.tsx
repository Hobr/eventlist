import { useState } from "react";
import type {
    HotWindowDays,
    PublicEventWithHotness,
} from "../../server/events/types";

type WindowMap = Record<HotWindowDays, PublicEventWithHotness[]>;

export default function HotEventsTabs({ windows }: { windows: WindowMap }) {
    const [active, setActive] = useState<HotWindowDays>(3);
    const events = windows[active];

    return (
        <div>
            <div className="segmented" role="tablist" aria-label="热门窗口">
                {([3, 7, 30] as HotWindowDays[]).map((days) => (
                    <button
                        key={days}
                        type="button"
                        role="tab"
                        aria-selected={active === days}
                        className={active === days ? "is-active" : ""}
                        onClick={() => setActive(days)}
                    >
                        {days} 日
                    </button>
                ))}
            </div>
            {events.length ? (
                <ol className="hot-list">
                    {events.map((event) => (
                        <li key={event.id}>
                            <a href={`/events/${event.slug}`}>
                                <span>{event.name}</span>
                                <strong>{event.hotness}</strong>
                            </a>
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="empty-state compact">暂无热门活动</div>
            )}
        </div>
    );
}
