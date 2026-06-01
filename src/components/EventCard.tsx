import type { EventWithWorks } from "../types/event";
import { getPosterUrl } from "../lib/poster-url";

interface Props {
  event: EventWithWorks;
  r2BaseUrl: string;
}

export default function EventCard({ event, r2BaseUrl }: Props) {
  const posterUrl = getPosterUrl(event.posterKey, r2BaseUrl);
  const typeLabel = event.eventType === "doujin" ? "漫展" : "演唱会";
  const dateStr = event.endDate
    ? `${event.startDate} ~ ${event.endDate}`
    : event.startDate;

  return (
    <a
      href={`/event/${event.id}`}
      className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
        <img
          src={posterUrl}
          alt={event.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">{event.title}</h3>
        <p className="text-xs text-gray-500 mb-1">{dateStr}</p>
        <p className="text-xs text-gray-500 mb-2">
          {event.city} · {event.venue}
        </p>
        <div className="flex items-center justify-between">
          <span
            className={`text-xs px-2 py-0.5 rounded ${
              event.eventType === "doujin"
                ? "bg-pink-100 text-pink-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {typeLabel}
          </span>
          <span className="text-xs text-gray-400">🔥 {event.viewCount}</span>
        </div>
      </div>
    </a>
  );
}
