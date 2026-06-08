import { expect, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

test("renders hot list tabs without overlap", async ({ page }) => {
    await page.goto(baseURL);
    await page.getByRole("tab", { name: "7 日" }).click();

    await expect(page.getByRole("heading", { name: "热门活动" })).toBeVisible();
});
