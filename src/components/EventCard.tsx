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
      className="card group overflow-hidden flex flex-col"
    >
      <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
        <img
          src={posterUrl}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3">
          <span
            className={`badge ${event.eventType === "doujin" ? "badge-doujin" : "badge-concert"}`}
          >
            {typeLabel}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <p className="text-white text-xs font-medium truncate">{event.city} · {event.venue}</p>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm text-slate-900 line-clamp-2 mb-2 group-hover:text-indigo-600 transition-colors">
          {event.title}
        </h3>
        <p className="text-xs text-slate-500 mb-1">{dateStr}</p>
        <p className="text-xs text-slate-400 mt-auto flex items-center justify-between">
          <span>{event.city} · {event.venue}</span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            {event.viewCount}
          </span>
        </p>
      </div>
    </a>
  );
}
