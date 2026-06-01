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

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <select
          value={province}
          onChange={(e) => { setProvince(e.target.value); setCity(""); }}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">全部省份</option>
          {provincesData.map((p) => (
            <option key={p.province} value={p.province}>{p.province}</option>
          ))}
        </select>

        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
          disabled={!province}
        >
          <option value="">全部城市</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="flex border rounded overflow-hidden text-sm">
          {["", "doujin", "concert"].map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 px-2 py-1.5 ${type === t ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
            >
              {t === "" ? "全部" : t === "doujin" ? "漫展" : "演唱会"}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={work}
          onChange={(e) => setWork(e.target.value)}
          placeholder="关联作品"
          className="border rounded px-2 py-1.5 text-sm"
        />

        <select
          value={scale}
          onChange={(e) => setScale(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">不限规模</option>
          {SCALES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border rounded px-2 py-1.5 text-sm"
        >
          <option value="">全部月份</option>
          {getMonths().map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={applyFilters} className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700">
          筛选
        </button>
        <button onClick={clearFilters} className="text-gray-500 px-4 py-1.5 rounded text-sm hover:bg-gray-100">
          清除
        </button>
      </div>
    </div>
  );
}
