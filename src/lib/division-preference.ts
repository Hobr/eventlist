import { isRegionCode } from "./divisions";

export const DIVISION_STORAGE_KEY = "eventlist.divisionCode";
type DivisionBrowser = Pick<Window, "localStorage" | "location">;

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

export function navigateToDivision(
    { value, action, name, replace = false }: DivisionNavigationOptions,
    browser: DivisionBrowser = window
) {
    if (!value || !isRegionCode(value)) return;

    browser.localStorage.setItem(DIVISION_STORAGE_KEY, value);
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
    const saved = browser.localStorage.getItem(DIVISION_STORAGE_KEY);
    const searchParams = new URLSearchParams(browser.location.search);
    if (!saved || saved === selectedDivisionCode || searchParams.has(name)) return;

    navigateToDivision({ value: saved, action, name, replace: true }, browser);
}
