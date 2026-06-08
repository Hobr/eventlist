import { expect, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

test("filters public event listings by city", async ({ page }) => {
    await page.goto(`${baseURL}/?city=上海`);

    await expect(page.getByRole("heading", { name: "活动列表" })).toBeVisible();
    await expect(
        page.getByRole("link", { name: "上海术力口同人会" }),
    ).toBeVisible();
    await expect(page.getByText("广州方舟音乐小聚")).toHaveCount(0);
});
