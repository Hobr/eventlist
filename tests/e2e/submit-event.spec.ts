import { expect, test } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

test("shows field-level validation on submit", async ({ page }) => {
    await page.goto(`${baseURL}/submit`);
    await page.getByLabel("活动名称").fill("测试活动");
    await page.getByLabel("城市").fill("上海");
    await page.getByLabel("场馆或地点").fill("测试场馆");
    await page.getByLabel("开始时间").fill("2026-07-02T10:00");
    await page.getByLabel("结束时间").fill("2026-07-01T10:00");
    await page.getByLabel("活动类型文本").fill("同人展");
    await page.getByLabel("活动 IP 文本").fill("原创");
    await page.getByLabel("官方 QQ 群").fill("abc");
    await page.getByRole("button", { name: "提交活动" }).click();

    await expect(page.getByText("结束时间不能早于开始时间。")).toBeVisible();
    await expect(page.getByText("QQ群号应为 5 到 12 位数字。")).toBeVisible();
});
