import {
    citiesCode,
    countiesCode,
    formatFullPath,
    getCitiesByProvince,
    getCityByCode,
    getCountiesByCity,
    getCountyByCode,
    getProvinceByCode,
    provincesCode,
} from "cn-division";

export const FALLBACK_DIVISION_CODE = "110101";

export type DivisionLevel = "province" | "city" | "county";

export interface RegionOption {
    code: string;
    name: string;
    label: string;
    level: DivisionLevel;
    province: string | null;
    city: string | null;
    sort: number;
}

export interface DivisionOption {
    code: string;
    name: string;
    label: string;
    city: string | null;
    province: string | null;
    cityCode: string;
    provinceCode: string;
    sort: number;
}

export interface CityDivisionOption extends RegionOption {
    level: "city";
    provinceCode: string;
    counties: DivisionOption[];
}

export interface ProvinceDivisionOption extends RegionOption {
    level: "province";
    cities: CityDivisionOption[];
}

export interface DivisionTree {
    provinces: ProvinceDivisionOption[];
}

function toCode(value: string | number | null | undefined) {
    return String(value ?? "").trim();
}

function toProvinceCode(value: string | number | null | undefined) {
    const code = toCode(value);
    return code.length === 1 ? `0${code}` : code;
}

function joinLabel(...parts: Array<string | null | undefined>) {
    const values = parts.filter(Boolean) as string[];
    return [...new Set(values)].join(" / ");
}

function getCityLabel(code: string | number | null | undefined) {
    const city = getCityByCode(toCode(code));
    if (!city) return null;

    const province = getProvinceByCode(city.p);
    return joinLabel(province?.n, city.n);
}

export function getDivisionOptionByCode(
    code: string | number | null | undefined,
): DivisionOption | null {
    const normalized = toCode(code);
    const county = getCountyByCode(normalized);
    if (!county) return null;

    const city = getCityByCode(county.cc);
    const province = getProvinceByCode(county.c);
    const provinceCode = toProvinceCode(city?.p ?? province?.c);

    return {
        code: String(county.c),
        name: county.n,
        label: formatFullPath(String(county.c)) || county.n,
        city: city?.n ?? null,
        province: province?.n ?? null,
        cityCode: String(county.cc),
        provinceCode,
        sort: countiesCode.findIndex(
            (item) => String(item.c) === String(county.c),
        ),
    };
}

export function getRegionOptionByCode(
    code: string | number | null | undefined,
): RegionOption | null {
    const normalized = toCode(code);
    if (!normalized) return null;

    const county = getDivisionOptionByCode(normalized);
    if (county) {
        return {
            code: county.code,
            name: county.name,
            label: county.label,
            level: "county",
            province: county.province,
            city: county.city,
            sort: county.sort,
        };
    }

    const city = getCityByCode(normalized);
    if (city) {
        return {
            code: String(city.c),
            name: city.n,
            label: getCityLabel(city.c) ?? city.n,
            level: "city",
            province: getProvinceByCode(city.p)?.n ?? null,
            city: city.n,
            sort: citiesCode.findIndex(
                (item) => String(item.c) === String(city.c),
            ),
        };
    }

    const province = getProvinceByCode(normalized);
    if (province) {
        return {
            code: toProvinceCode(province.c),
            name: province.n,
            label: province.n,
            level: "province",
            province: province.n,
            city: null,
            sort: provincesCode.findIndex(
                (item) => toProvinceCode(item.c) === toProvinceCode(province.c),
            ),
        };
    }

    return null;
}

export function isCountyDivisionCode(code: string | number | null | undefined) {
    return getDivisionOptionByCode(code) !== null;
}

export function isRegionCode(code: string | number | null | undefined) {
    return getRegionOptionByCode(code) !== null;
}

export function getDivisionLabel(code: string | number | null | undefined) {
    return getDivisionOptionByCode(code)?.label ?? null;
}

export function listDivisionTree(): DivisionTree {
    return {
        provinces: provincesCode.map((province, provinceIndex) => {
            const provinceCode = toProvinceCode(province.c);
            const cities = getCitiesByProvince(provinceCode).map(
                (city, cityIndex) => {
                    const cityCode = String(city.c);
                    const counties = getCountiesByCity(cityCode).map(
                        (county, countyIndex) => ({
                            code: String(county.c),
                            name: county.n,
                            label: formatFullPath(String(county.c)) || county.n,
                            city: city.n,
                            province: province.n,
                            cityCode,
                            provinceCode,
                            sort: countyIndex,
                        }),
                    );

                    return {
                        code: cityCode,
                        name: city.n,
                        label: joinLabel(province.n, city.n),
                        level: "city" as const,
                        province: province.n,
                        city: city.n,
                        provinceCode,
                        counties,
                        sort: cityIndex,
                    };
                },
            );

            return {
                code: provinceCode,
                name: province.n,
                label: province.n,
                level: "province" as const,
                province: province.n,
                city: null,
                cities,
                sort: provinceIndex,
            };
        }),
    };
}
