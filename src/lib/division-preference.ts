import { isRegionCode } from "./divisions";

export const DIVISION_STORAGE_KEY = "eventlist.divisionCode";
type DivisionBrowser = Pick<Window, "localStorage" | "location">;
type DivisionStorageReader = Pick<Storage, "getItem">;
type DivisionStorageWriter = Pick<Storage, "setItem">;

interface DivisionNavigationOptions {
    value: string;
    action: string;
    name: string;
    replace?: boolean;
}

interface DivisionRestoreOptions {
    selectedDivisionCode: string | null;
    action: string;
    name: string;
}

export function readDivisionPreference(
    storage: DivisionStorageReader = window.localStorage
): string | null {
    const value = storage.getItem(DIVISION_STORAGE_KEY);
    return value && isRegionCode(value) ? value : null;
}

export function writeDivisionPreference(
    value: string,
    storage: DivisionStorageWriter = window.localStorage
) {
    if (!isRegionCode(value)) return false;
    storage.setItem(DIVISION_STORAGE_KEY, value);
    return true;
}

export function navigateToDivision(
    { value, action, name, replace = false }: DivisionNavigationOptions,
    browser: DivisionBrowser = window
) {
    if (!value || !isRegionCode(value)) return;

    writeDivisionPreference(value, browser.localStorage);
    const url = new URL(action, browser.location.origin);
    url.searchParams.set(name, value);
    const next = `${url.pathname}${url.search}`;
    if (replace) {
        browser.location.replace(next);
        return;
    }
    browser.location.assign(next);
}

export function restoreStoredDivision(
    { selectedDivisionCode, action, name }: DivisionRestoreOptions,
    browser: DivisionBrowser = window
) {
    const saved = readDivisionPreference(browser.localStorage);
    const searchParams = new URLSearchParams(browser.location.search);
    if (!saved || saved === selectedDivisionCode || searchParams.has(name)) return;

    navigateToDivision({ value: saved, action, name, replace: true }, browser);
}
