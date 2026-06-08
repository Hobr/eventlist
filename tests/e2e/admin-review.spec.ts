import { expect, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

test("loads the local mock admin review queue", async ({ page }) => {
    await page.goto(`${baseURL}/admin`);

    await expect(page.getByRole("heading", { name: "审核队列" })).toBeVisible();
    await expect(page.getByText("待审核新 IP 茶会")).toBeVisible();
});
