import {
    MUNICIPALITY_CODES,
    citiesCode,
    countiesCode,
    formatFullPath,
    getCitiesByProvince,
    getCityByCode,
    getCountiesByCity,
    getCountyByCode,
    getProvinceByCode,
    provincesCode
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

const SUPPLEMENTAL_PROVINCES = [
    {
        provinceCode: "71",
        cityCode: "7100",
        countyCode: "710000",
        name: "台湾省"
    },
    {
        provinceCode: "81",
        cityCode: "8100",
        countyCode: "810000",
        name: "香港特别行政区"
    },
    {
        provinceCode: "82",
        cityCode: "8200",
        countyCode: "820000",
        name: "澳门特别行政区"
    }
] as const;

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

function getSupplementalProvinceByCode(code: string | number | null | undefined) {
    const normalized = toCode(code);
    return (
        SUPPLEMENTAL_PROVINCES.find(
            (province) =>
                province.provinceCode === normalized ||
                province.cityCode === normalized ||
                province.countyCode === normalized
        ) ?? null
    );
}

export function getDivisionOptionByCode(
    code: string | number | null | undefined
): DivisionOption | null {
    const normalized = toCode(code);
    const supplemental = getSupplementalProvinceByCode(normalized);
    if (supplemental?.countyCode === normalized) {
        return {
            code: supplemental.countyCode,
            name: supplemental.name,
            label: supplemental.name,
            city: supplemental.name,
            province: supplemental.name,
            cityCode: supplemental.cityCode,
            provinceCode: supplemental.provinceCode,
            sort: countiesCode.length + SUPPLEMENTAL_PROVINCES.indexOf(supplemental)
        };
    }

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
        sort: countiesCode.findIndex((item) => String(item.c) === String(county.c))
    };
}

export function getRegionOptionByCode(
    code: string | number | null | undefined
): RegionOption | null {
    const normalized = toCode(code);
    if (!normalized) return null;

    const supplemental = getSupplementalProvinceByCode(normalized);
    if (supplemental) {
        const sort = provincesCode.length + SUPPLEMENTAL_PROVINCES.indexOf(supplemental);
        if (normalized === supplemental.countyCode) {
            return {
                code: supplemental.countyCode,
                name: supplemental.name,
                label: supplemental.name,
                level: "county",
                province: supplemental.name,
                city: supplemental.name,
                sort
            };
        }

        if (normalized === supplemental.cityCode) {
            return {
                code: supplemental.cityCode,
                name: supplemental.name,
                label: supplemental.name,
                level: "city",
                province: supplemental.name,
                city: supplemental.name,
                sort
            };
        }

        return {
            code: supplemental.provinceCode,
            name: supplemental.name,
            label: supplemental.name,
            level: "province",
            province: supplemental.name,
            city: null,
            sort
        };
    }

    const county = getDivisionOptionByCode(normalized);
    if (county) {
        return {
            code: county.code,
            name: county.name,
            label: county.label,
            level: "county",
            province: county.province,
            city: county.city,
            sort: county.sort
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
            sort: citiesCode.findIndex((item) => String(item.c) === String(city.c))
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
                (item) => toProvinceCode(item.c) === toProvinceCode(province.c)
            )
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
        provinces: [
            ...provincesCode.map((province, provinceIndex) => {
                const provinceCode = toProvinceCode(province.c);
                const sourceCities = getCitiesByProvince(provinceCode).map((city, cityIndex) => {
                    const cityCode = String(city.c);
                    const counties = getCountiesByCity(cityCode).map((county, countyIndex) => ({
                        code: String(county.c),
                        name: county.n,
                        label: formatFullPath(String(county.c)) || county.n,
                        city: city.n,
                        province: province.n,
                        cityCode,
                        provinceCode,
                        sort: countyIndex
                    }));

                    return {
                        code: cityCode,
                        name: city.n,
                        label: joinLabel(province.n, city.n),
                        level: "city" as const,
                        province: province.n,
                        city: city.n,
                        provinceCode,
                        counties,
                        sort: cityIndex
                    };
                });
                const cities = MUNICIPALITY_CODES.includes(provinceCode)
                    ? [
                          {
                              code: provinceCode,
                              name: province.n,
                              label: province.n,
                              level: "city" as const,
                              province: province.n,
                              city: province.n,
                              provinceCode,
                              counties: sourceCities.flatMap((city) =>
                                  city.counties.map((county) => ({
                                      ...county,
                                      city: province.n,
                                      cityCode: provinceCode
                                  }))
                              ),
                              sort: 0
                          }
                      ]
                    : sourceCities;

                return {
                    code: provinceCode,
                    name: province.n,
                    label: province.n,
                    level: "province" as const,
                    province: province.n,
                    city: null,
                    cities,
                    sort: provinceIndex
                };
            }),
            ...SUPPLEMENTAL_PROVINCES.map((province, index) => ({
                code: province.provinceCode,
                name: province.name,
                label: province.name,
                level: "province" as const,
                province: province.name,
                city: null,
                cities: [
                    {
                        code: province.cityCode,
                        name: province.name,
                        label: province.name,
                        level: "city" as const,
                        province: province.name,
                        city: province.name,
                        provinceCode: province.provinceCode,
                        counties: [
                            {
                                code: province.countyCode,
                                name: province.name,
                                label: province.name,
                                city: province.name,
                                province: province.name,
                                cityCode: province.cityCode,
                                provinceCode: province.provinceCode,
                                sort: 0
                            }
                        ],
                        sort: 0
                    }
                ],
                sort: provincesCode.length + index
            }))
        ]
    };
}
