import { useState } from "react";
import EventCard from "./EventCard";
import type { EventWithWorks } from "../types/event";

interface Props {
    initialItems: EventWithWorks[];
    initialTotal: number;
    initialPage: number;
    filters: Record<string, string>;
    r2BaseUrl: string;
}

export default function EventList({
    initialItems,
    initialTotal,
    initialPage,
    filters,
    r2BaseUrl,
}: Props) {
    const [items, setItems] = useState(initialItems);
    const [page, setPage] = useState(initialPage);
    const [loading, setLoading] = useState(false);
    const totalPages = Math.ceil(initialTotal / 20);

    async function loadMore() {
        setLoading(true);
        const params = new URLSearchParams(filters);
        params.set("page", String(page + 1));
        const res = await fetch(`/api/events?${params}`);
        const data: { items: EventWithWorks[] } = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setPage(page + 1);
        setLoading(false);
    }

    return (
        <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((event) => (
                    <EventCard
                        key={event.id}
                        event={event}
                        r2BaseUrl={r2BaseUrl}
                    />
                ))}
            </div>
            {items.length === 0 && (
                <p className="text-center text-gray-400 py-12">
                    暂无符合条件的活动
                </p>
            )}
            {page < totalPages && (
                <div className="text-center mt-6">
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="bg-white border px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {loading ? "加载中..." : "加载更多"}
                    </button>
                </div>
            )}
        </div>
    );
}
