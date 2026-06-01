import { useState, useRef } from "react";
import provincesData from "../../data/provinces.json";

const SCALES = ["全国大型", "区域中型", "地方小型"];

interface Props {
    turnstileSiteKey: string;
}

export default function SubmitForm({ turnstileSiteKey }: Props) {
    const [province, setProvince] = useState("");
    const [city, setCity] = useState("");
    const [works, setWorks] = useState<string[]>([]);
    const [workInput, setWorkInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const cities = province
        ? (provincesData.find((p) => p.province === province)?.cities ?? [])
        : [];

    function addWork() {
        const trimmed = workInput.trim();
        if (trimmed && !works.includes(trimmed) && works.length < 20) {
            setWorks([...works, trimmed]);
            setWorkInput("");
        }
    }

    function removeWork(w: string) {
        setWorks(works.filter((x) => x !== w));
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const form = formRef.current!;
            const fd = new FormData(form);
            const turnstileToken = (
                document.querySelector(
                    '[name="cf-turnstile-response"]',
                ) as HTMLInputElement
            )?.value;

            if (!turnstileToken) {
                setError("请完成验证码");
                setSubmitting(false);
                return;
            }

            const signBody = {
                title: fd.get("title"),
                province: fd.get("province"),
                city: fd.get("city"),
                venue: fd.get("venue"),
                address: fd.get("address"),
                startDate: fd.get("startDate"),
                endDate: fd.get("endDate") || null,
                eventType: fd.get("eventType"),
                scale: fd.get("scale") || null,
                works,
                qqGroup: fd.get("qqGroup") || null,
                ticketUrl: fd.get("ticketUrl") || null,
                priceInfo: fd.get("priceInfo") || null,
                description: fd.get("description") || null,
                turnstileToken,
            };

            const signRes = await fetch("/api/submit/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(signBody),
            });

            if (!signRes.ok) {
                const data: { error?: string } = await signRes.json();
                throw new Error(data.error ?? "签名失败");
            }

            const { ticket } = (await signRes.json()) as { ticket: string };

            const commitFd = new FormData();
            commitFd.append("ticket", ticket);
            if (posterFile) commitFd.append("poster", posterFile);

            const commitRes = await fetch("/api/submit/commit", {
                method: "POST",
                body: commitFd,
            });

            if (!commitRes.ok) {
                const data: { error?: string } = await commitRes.json();
                throw new Error(data.error ?? "提交失败");
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "提交失败");
        } finally {
            setSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="card p-8 text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                    提交成功!
                </h2>
                <p className="text-slate-500">
                    活动已提交，待管理员审核后发布。
                </p>
                <a
                    href="/"
                    className="btn-primary inline-block mt-4"
                >
                    返回首页
                </a>
            </div>
        );
    }

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="card p-6 lg:p-8 space-y-5"
        >
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">
                    活动名称 *
                </label>
                <input
                    name="title"
                    required
                    className="input-field"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        省/直辖市 *
                    </label>
                    <select
                        name="province"
                        required
                        value={province}
                        onChange={(e) => {
                            setProvince(e.target.value);
                            setCity("");
                        }}
                        className="input-field"
                    >
                        <option value="">请选择</option>
                        {provincesData.map((p) => (
                            <option key={p.province} value={p.province}>
                                {p.province}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        城市 *
                    </label>
                    <select
                        name="city"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="input-field"
                        disabled={!province}
                    >
                        <option value="">请选择</option>
                        {cities.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    具体场馆 *
                </label>
                <input
                    name="venue"
                    required
                    className="input-field"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    场馆地址
                </label>
                <input
                    name="address"
                    className="input-field"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        开始日期 *
                    </label>
                    <input
                        name="startDate"
                        type="date"
                        required
                        className="input-field"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        结束日期
                    </label>
                    <input
                        name="endDate"
                        type="date"
                        className="input-field"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        活动类型 *
                    </label>
                    <select
                        name="eventType"
                        required
                        className="input-field"
                    >
                        <option value="doujin">漫展/同人展</option>
                        <option value="concert">演唱会/Live</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        规模
                    </label>
                    <select
                        name="scale"
                        className="input-field"
                    >
                        <option value="">不限</option>
                        {SCALES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    关联作品
                </label>
                <div className="flex gap-2">
                    <input
                        value={workInput}
                        onChange={(e) => setWorkInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && (e.preventDefault(), addWork())
                        }
                        className="flex-1 input-field"
                        placeholder="输入作品名后按回车"
                    />
                    <button
                        type="button"
                        onClick={addWork}
                        className="btn-ghost"
                    >
                        添加
                    </button>
                </div>
                {works.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {works.map((w) => (
                            <span
                                key={w}
                                className="badge bg-indigo-50 text-indigo-700 flex items-center gap-1"
                            >
                                {w}
                                <button
                                    type="button"
                                    onClick={() => removeWork(w)}
                                    className="hover:text-red-500"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        QQ群号
                    </label>
                    <input
                        name="qqGroup"
                        className="input-field"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        购票链接
                    </label>
                    <input
                        name="ticketUrl"
                        type="url"
                        className="input-field"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    票价信息
                </label>
                <input
                    name="priceInfo"
                    className="input-field"
                    placeholder="如: 预售50元/现场60元"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">海报图</label>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    补充描述
                </label>
                <textarea
                    name="description"
                    rows={4}
                    className="input-field"
                />
            </div>

            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />

            <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
            >
                {submitting ? "提交中..." : "提交活动"}
            </button>
        </form>
    );
}
