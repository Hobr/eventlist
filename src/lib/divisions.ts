import {
    countiesCode,
    formatFullPath,
    getCityByCode,
    getCountyByCode,
    getProvinceByCode,
} from "cn-division";

export const FALLBACK_DIVISION_CODE = "110101";

export interface DivisionOption {
    code: string;
    name: string;
    label: string;
    city: string | null;
    province: string | null;
    sort: number;
}

function toCode(value: string | number | null | undefined) {
    return String(value ?? "").trim();
}

export function getDivisionOptionByCode(
    code: string | number | null | undefined,
): DivisionOption | null {
    const normalized = toCode(code);
    const county = getCountyByCode(normalized);
    if (!county) return null;

    const city = getCityByCode(county.cc);
    const province = getProvinceByCode(county.c);

    return {
        code: String(county.c),
        name: county.n,
        label: formatFullPath(String(county.c)) || county.n,
        city: city?.n ?? null,
        province: province?.n ?? null,
        sort: countiesCode.findIndex(
            (item) => String(item.c) === String(county.c),
        ),
    };
}

export function isDivisionCode(code: string | number | null | undefined) {
    return getDivisionOptionByCode(code) !== null;
}

export function getDivisionLabel(code: string | number | null | undefined) {
    return getDivisionOptionByCode(code)?.label ?? null;
}

export function listDivisionOptions(): DivisionOption[] {
    return countiesCode.map((county, index) => {
        const city = getCityByCode(county.cc);
        const province = getProvinceByCode(county.c);

        return {
            code: String(county.c),
            name: county.n,
            label: formatFullPath(String(county.c)) || county.n,
            city: city?.n ?? null,
            province: province?.n ?? null,
            sort: index,
        };
    });
}
