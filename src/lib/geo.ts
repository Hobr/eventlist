import { countiesCode } from "cn-division";
import { FALLBACK_DIVISION_CODE, getRegionOptionByCode, type RegionOption } from "./divisions";

const DIVISION_STORAGE_PARAM = "city";

interface CloudflareRequest extends Request {
    cf?: {
        city?: string;
        region?: string;
    };
}

export interface ResolvedDivision {
    division: RegionOption;
    source: "query" | "cf" | "default";
}

export function normalizeDivision(value: string | null | undefined) {
    return (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/city$/i, "")
        .replace(/[省市县区]/g, "")
        .replace(/(特别行政|壮族自治区|回族自治区|维吾尔自治区|自治区)$/g, "");
}

function parseDivisionCode(value: string | null | undefined) {
    const code = (value ?? "").trim();
    return /^(\d{2}|\d{4}|\d{6}|\d{12})$/.test(code) ? code : null;
}

function matchDivisionByName(city: string | null | undefined) {
    const target = normalizeDivision(city);
    if (!target) return null;

    const county = countiesCode.find((candidate) => {
        const name = normalizeDivision(candidate.n);
        return name === target || name.includes(target) || target.includes(name);
    });

    return county ? getRegionOptionByCode(county.c) : null;
}

export async function resolveSelectedDivision(
    request: Request,
    searchParams: URLSearchParams,
    defaultDivisionCode = FALLBACK_DIVISION_CODE
): Promise<ResolvedDivision> {
    const queryDivisionCode = parseDivisionCode(searchParams.get(DIVISION_STORAGE_PARAM));
    if (queryDivisionCode) {
        const queryDivision = getRegionOptionByCode(queryDivisionCode);
        if (queryDivision) return { division: queryDivision, source: "query" };
    }

    const cf = (request as CloudflareRequest).cf;
    const cfDivision = matchDivisionByName(cf?.city) ?? matchDivisionByName(cf?.region);
    if (cfDivision) return { division: cfDivision, source: "cf" };

    const fallback = getRegionOptionByCode(defaultDivisionCode);
    if (!fallback) {
        throw new Error("Default division code is invalid");
    }

    return { division: fallback, source: "default" };
}
