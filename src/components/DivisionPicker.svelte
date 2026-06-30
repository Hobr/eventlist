<script lang="ts">
    import type {
        CityDivisionOption,
        DivisionTree,
        ProvinceDivisionOption
    } from "../lib/divisions";
    import { listDivisionTree } from "../lib/divisions";

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

    const provinces = tree.provinces;

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

    let selectedProvinceCode = $state(findProvince(value)?.code ?? "");
    let selectedCityCode = $state(findCity(findProvince(value), value)?.code ?? "");
    let selectedCountyCode = $state(
        findCounty(findCity(findProvince(value), value), value)?.code ?? ""
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

    function syncChange() {
        onchange?.(selectedValue);
    }

    function handleProvinceChange(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        selectedProvinceCode = select.value;
        selectedCityCode = "";
        selectedCountyCode = "";
        syncChange();
    }

    function handleCityChange(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        selectedCityCode = select.value;
        selectedCountyCode = "";
        syncChange();
    }

    function handleCountyChange(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        selectedCountyCode = select.value;
        syncChange();
    }
</script>

<div class:wide class="field division-picker">
    <span>{label}</span>
    <input type="hidden" {name} value={selectedValue} {required} />
    <div class="division-picker-controls">
        <select
            aria-label={`${label}省份`}
            value={selectedProvinceCode}
            required={required && mode === "county"}
            onchange={handleProvinceChange}
        >
            {#if allowEmpty}
                <option value="">{emptyLabel}</option>
            {:else}
                <option value="" disabled selected={!selectedProvinceCode}> 选择省份 </option>
            {/if}
            {#each provinces as province}
                <option value={province.code}>{province.name}</option>
            {/each}
        </select>

        <select
            aria-label={`${label}城市`}
            value={selectedCityCode}
            disabled={!selectedProvince}
            required={required && mode === "county"}
            onchange={handleCityChange}
        >
            <option value="">
                {mode === "region" && selectedProvince ? "全部城市" : "选择城市"}
            </option>
            {#each cities as city}
                <option value={city.code}>{city.name}</option>
            {/each}
        </select>

        <select
            aria-label={`${label}区县`}
            value={selectedCountyCode}
            disabled={!selectedCity}
            required={required && mode === "county"}
            onchange={handleCountyChange}
        >
            <option value="">
                {mode === "region" && selectedCity ? "全部区县" : "选择区县"}
            </option>
            {#each counties as county}
                <option value={county.code}>{county.name}</option>
            {/each}
        </select>
    </div>
</div>
