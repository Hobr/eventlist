import { useState } from "react";
import provincesData from "../../data/provinces.json";

interface Props {
  initialFilters: Record<string, string>;
}

const SCALES = ["全国大型", "区域中型", "地方小型"];

function getMonths() {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

export default function FilterBar({ initialFilters }: Props) {
  const [province, setProvince] = useState(initialFilters.province ?? "");
  const [city, setCity] = useState(initialFilters.city ?? "");
  const [type, setType] = useState(initialFilters.type ?? "");
  const [work, setWork] = useState(initialFilters.work ?? "");
  const [scale, setScale] = useState(initialFilters.scale ?? "");
  const [month, setMonth] = useState(initialFilters.month ?? "");

  const cities = province
    ? provincesData.find((p) => p.province === province)?.cities ?? []
    : [];

  function applyFilters() {
    const params = new URLSearchParams();
    if (province) params.set("province", province);
    if (city) params.set("city", city);
    if (type) params.set("type", type);
    if (work) params.set("work", work);
    if (scale) params.set("scale", scale);
    if (month) params.set("month", month);
    window.location.search = params.toString();
  }

  function clearFilters() {
    window.location.search = "";
  }

  const hasFilters = province || city || type || work || scale || month;

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          筛选活动
        </h3>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-indigo-600 transition-colors">
            清除全部
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <select value={province} onChange={(e) => { setProvince(e.target.value); setCity(""); }} className="input-field">
          <option value="">全部省份</option>
          {provincesData.map((p) => <option key={p.province} value={p.province}>{p.province}</option>)}
        </select>

        <select value={city} onChange={(e) => setCity(e.target.value)} className="input-field" disabled={!province}>
          <option value="">全部城市</option>
          {cities.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex rounded-lg overflow-hidden border border-slate-200 bg-slate-50/50">
          {["", "doujin", "concert"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 px-2 py-2 text-xs font-medium transition-all ${
                type === t
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "" ? "全部" : t === "doujin" ? "漫展" : "演唱会"}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={work}
          onChange={(e) => setWork(e.target.value)}
          placeholder="关联作品..."
          className="input-field"
        />

        <select value={scale} onChange={(e) => setScale(e.target.value)} className="input-field">
          <option value="">不限规模</option>
          {SCALES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={month} onChange={(e) => setMonth(e.target.value)} className="input-field">
          <option value="">全部月份</option>
          {getMonths().map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={applyFilters} className="btn-primary">
          筛选
        </button>
      </div>
    </div>
  );
}
