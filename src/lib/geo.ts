import type { D1Database } from "../types/cloudflare";
import { getCityById, listCities, type OptionRow } from "./db/queries";

export const FALLBACK_CITY_ID = 1;
const CITY_STORAGE_PARAM = "city";
const CITY_ALIASES: Record<string, string> = {
    anshan: "鞍山",
    baoding: "保定",
    baotou: "包头",
    beijing: "北京",
    changchun: "长春",
    changsha: "长沙",
    changzhou: "常州",
    chengdu: "成都",
    chongqing: "重庆",
    dalian: "大连",
    dali: "大理",
    daqing: "大庆",
    dongguan: "东莞",
    foshan: "佛山",
    fuzhou: "福州",
    ganzhou: "赣州",
    guangzhou: "广州",
    guiyang: "贵阳",
    guilin: "桂林",
    haikou: "海口",
    hangzhou: "杭州",
    harbin: "哈尔滨",
    hefei: "合肥",
    hengyang: "衡阳",
    hohhot: "呼和浩特",
    huhehaote: "呼和浩特",
    huizhou: "惠州",
    jiaxing: "嘉兴",
    jinan: "济南",
    jilin: "吉林市",
    jilincity: "吉林市",
    kunming: "昆明",
    lanzhou: "兰州",
    lasa: "拉萨",
    lhasa: "拉萨",
    luoyang: "洛阳",
    mianyang: "绵阳",
    nanchang: "南昌",
    nanchong: "南充",
    nanjing: "南京",
    nanning: "南宁",
    nantong: "南通",
    nanyang: "南阳",
    ningbo: "宁波",
    qingdao: "青岛",
    qiqihar: "齐齐哈尔",
    quanzhou: "泉州",
    sanya: "三亚",
    shanghai: "上海",
    shaoxing: "绍兴",
    shenyang: "沈阳",
    shenzhen: "深圳",
    shijiazhuang: "石家庄",
    suzhou: "苏州",
    taiyuan: "太原",
    tangshan: "唐山",
    tianjin: "天津",
    urumqi: "乌鲁木齐",
    wenzhou: "温州",
    wuhan: "武汉",
    wuxi: "无锡",
    xiamen: "厦门",
    xian: "西安",
    xiangyang: "襄阳",
    xining: "西宁",
    yantai: "烟台",
    yichang: "宜昌",
    yinchuan: "银川",
    zhengzhou: "郑州",
    zhuhai: "珠海",
    zhuzhou: "株洲",
    zunyi: "遵义",
};

interface CloudflareRequest extends Request {
    cf?: {
        city?: string;
        region?: string;
    };
}

export interface ResolvedCity {
    city: OptionRow;
    source: "query" | "cf" | "default";
}

export function normalizeCity(value: string | null | undefined) {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/city$/i, "")
        .replace(/[市县区]/g, "")
        .replace(
            /(省|特别行政|壮族自治区|回族自治区|维吾尔自治区|自治区)$/g,
            "",
        );
}

function expandCityTarget(value: string | null | undefined) {
    const normalized = normalizeCity(value);
    if (!normalized) return [];
    const alias = CITY_ALIASES[normalized];
    return alias ? [normalized, normalizeCity(alias)] : [normalized];
}

function parseCityId(value: string | null | undefined) {
    const cityId = Number.parseInt(value ?? "", 10);
    return Number.isInteger(cityId) && cityId > 0 ? cityId : null;
}

export async function matchCity(
    db: D1Database,
    city: string | null | undefined,
    region?: string | null,
) {
    const targets = [
        ...expandCityTarget(city),
        ...expandCityTarget(region),
    ].filter(Boolean);
    if (targets.length === 0) return null;

    const cities = await listCities(db);
    const exactAlias = targets.find((target) =>
        cities.some((candidate) => normalizeCity(candidate.name) === target),
    );
    if (exactAlias) {
        return (
            cities.find(
                (candidate) => normalizeCity(candidate.name) === exactAlias,
            ) ?? null
        );
    }

    return (
        cities.find((candidate) => {
            const candidateName = normalizeCity(candidate.name);
            const candidateProvince = normalizeCity(candidate.province);
            return targets.some(
                (target) =>
                    target === candidateName ||
                    target === candidateProvince ||
                    candidateName.includes(target) ||
                    target.includes(candidateName),
            );
        }) ?? null
    );
}

export async function resolveSelectedCity(
    db: D1Database,
    request: Request,
    searchParams: URLSearchParams,
    defaultCityId = FALLBACK_CITY_ID,
): Promise<ResolvedCity> {
    const queryCityId = parseCityId(searchParams.get(CITY_STORAGE_PARAM));
    if (queryCityId) {
        const queryCity = await getCityById(db, queryCityId);
        if (queryCity) return { city: queryCity, source: "query" };
    }

    const cf = (request as CloudflareRequest).cf;
    const cfCity = await matchCity(db, cf?.city, cf?.region);
    if (cfCity) return { city: cfCity, source: "cf" };

    const fallback =
        (await getCityById(db, defaultCityId)) ?? (await listCities(db))[0];
    if (!fallback) {
        throw new Error("No cities are configured");
    }

    return { city: fallback, source: "default" };
}
