import assert from "node:assert/strict";
import test from "node:test";
import {
    DIVISION_STORAGE_KEY,
    navigateToDivision,
    restoreStoredDivision
} from "../src/lib/division-preference";

class FakeStorage {
    values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

function fakeBrowser(search = "") {
    const storage = new FakeStorage();
    const navigation = { assigned: "", replaced: "" };
    const browser = {
        localStorage: storage,
        location: {
            origin: "https://example.com",
            search,
            assign(value: string) {
                navigation.assigned = value;
            },
            replace(value: string) {
                navigation.replaced = value;
            }
        }
    } as unknown as Pick<Window, "localStorage" | "location">;

    return { browser, navigation, storage };
}

test("地区选择保存原存储键并保留 action 查询参数", () => {
    const { browser, navigation, storage } = fakeBrowser();

    navigateToDivision({ value: "31", action: "/?trend=7", name: "city" }, browser);

    assert.equal(storage.getItem(DIVISION_STORAGE_KEY), "31");
    assert.equal(navigation.assigned, "/?trend=7&city=31");
});

test("导航地区入口在 URL 未指定 city 时恢复已保存地区", () => {
    const { browser, navigation, storage } = fakeBrowser("?trend=7");
    storage.setItem(DIVISION_STORAGE_KEY, "11");

    restoreStoredDivision(
        { selectedDivisionCode: "110101", action: "/?trend=7", name: "city" },
        browser
    );

    assert.equal(navigation.replaced, "/?trend=7&city=11");
});

test("显式 city 查询参数优先于已保存地区", () => {
    const { browser, navigation, storage } = fakeBrowser("?trend=7&city=31");
    storage.setItem(DIVISION_STORAGE_KEY, "11");

    restoreStoredDivision(
        { selectedDivisionCode: "31", action: "/?trend=7", name: "city" },
        browser
    );

    assert.equal(navigation.replaced, "");
});
