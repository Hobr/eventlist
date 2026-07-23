<script lang="ts">
    import { untrack } from "svelte";
    import type {
        CityDivisionOption,
        DivisionTree,
        ProvinceDivisionOption
    } from "../lib/divisions";
    import { listDivisionTree } from "../lib/divisions";
    import SelectField from "./SelectField.svelte";

    type Mode = "region" | "county";

    interface Props {
        tree?: DivisionTree;
        name: string;
        value?: string | null;
        label?: string;
        mode?: Mode;
        allowEmpty?: boolean;
        emptyLabel?: string;
        required?: boolean;
        wide?: boolean;
        onchange?: (value: string) => void;
    }

    let {
        tree = listDivisionTree(),
        name,
        value = null,
        label = "地区",
        mode = "county",
        allowEmpty = false,
        emptyLabel = "全部地区",
        required = false,
        wide = false,
        onchange
    }: Props = $props();

    const provinces = $derived(tree.provinces);

    function findProvince(code: string | null | undefined) {
        if (!code) return null;
        return (
            provinces.find(
                (province) => province.code === code || code.startsWith(province.code)
            ) ?? null
        );
    }

    function findCity(province: ProvinceDivisionOption | null, code: string | null | undefined) {
        if (!province || !code) return null;
        return (
            province.cities.find((city) => city.code === code || code.startsWith(city.code)) ?? null
        );
    }

    function findCounty(city: CityDivisionOption | null, code: string | null | undefined) {
        if (!city || !code) return null;
        return city.counties.find((county) => county.code === code) ?? null;
    }

    let selectedProvinceCode = $state(untrack(() => findProvince(value)?.code ?? ""));
    let selectedCityCode = $state(untrack(() => findCity(findProvince(value), value)?.code ?? ""));
    let selectedCountyCode = $state(
        untrack(() => findCounty(findCity(findProvince(value), value), value)?.code ?? "")
    );

    let selectedProvince = $derived(
        provinces.find((province) => province.code === selectedProvinceCode) ?? null
    );
    let cities = $derived(selectedProvince?.cities ?? []);
    let selectedCity = $derived(cities.find((city) => city.code === selectedCityCode) ?? null);
    let counties = $derived(selectedCity?.counties ?? []);

    let selectedValue = $derived.by(() => {
        if (selectedCountyCode) return selectedCountyCode;
        if (mode === "region" && selectedCityCode) return selectedCityCode;
        if (mode === "region" && selectedProvinceCode) return selectedProvinceCode;
        return "";
    });
    let provinceOptions = $derived([
        ...(allowEmpty ? [{ value: "", label: emptyLabel }] : []),
        ...provinces.map((province) => ({
            value: province.code,
            label: province.name
        }))
    ]);
    let cityOptions = $derived([
        {
            value: "",
            label: mode === "region" && selectedProvince ? "全部市" : "选择市",
            disabled: mode === "county"
        },
        ...cities.map((city) => ({
            value: city.code,
            label: city.name
        }))
    ]);
    let countyOptions = $derived([
        {
            value: "",
            label: mode === "region" && selectedCity ? "全部区/县" : "选择区/县",
            disabled: mode === "county"
        },
        ...counties.map((county) => ({
            value: county.code,
            label: county.name
        }))
    ]);

    function syncChange() {
        onchange?.(selectedValue);
    }

    function handleProvinceChange(value: string) {
        selectedProvinceCode = value;
        const province = provinces.find((item) => item.code === value) ?? null;
        const municipalityCity = province?.cities.find((city) => city.code === province.code);
        selectedCityCode = municipalityCity?.code ?? "";
        selectedCountyCode = "";
        syncChange();
    }

    function handleCityChange(value: string) {
        selectedCityCode = value;
        selectedCountyCode = "";
        syncChange();
    }

    function handleCountyChange(value: string) {
        selectedCountyCode = value;
        syncChange();
    }
</script>

<div class="flex min-w-0 flex-col gap-1.5">
    <span class="text-sm font-semibold text-muted-foreground">{label}</span>
    <input type="hidden" {name} value={selectedValue} {required} />
    <div class={wide ? "grid grid-cols-1 gap-2" : "grid grid-cols-3 gap-2"}>
        <SelectField
            label="省"
            value={selectedProvinceCode}
            options={provinceOptions}
            placeholder="省"
            required={required && mode === "county"}
            onchange={handleProvinceChange}
        />
        <SelectField
            label="市"
            value={selectedCityCode}
            options={cityOptions}
            placeholder="市"
            disabled={!selectedProvince}
            required={required && mode === "county"}
            onchange={handleCityChange}
        />
        <SelectField
            label="区/县"
            value={selectedCountyCode}
            options={countyOptions}
            placeholder="区/县"
            disabled={!selectedCity}
            required={required && mode === "county"}
            onchange={handleCountyChange}
        />
    </div>
</div>
