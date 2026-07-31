import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getDisplayCoverUrl } from "../src/lib/events/cover";
import { parseSubmissionForm } from "../src/lib/public/form";

function validSubmissionForm() {
    const formData = new FormData();
    formData.set("title", "测试活动");
    formData.set("type", "comic");
    formData.set("scale", "small");
    formData.set("division_code", "110101");
    formData.set("venue", "测试场馆");
    formData.set("start_date", "2026-08-01");
    formData.set("end_date", "2026-08-02");
    formData.set("source_url", "https://example.com/source");
    formData.set("submitter_contact", "user@example.com");
    return formData;
}

test("历史 HTTP 封面在展示时升级为 HTTPS", () => {
    assert.equal(
        getDisplayCoverUrl(" http://i2.hdslb.com/bfs/openplatform/cover.jpg "),
        "https://i2.hdslb.com/bfs/openplatform/cover.jpg"
    );
    assert.equal(
        getDisplayCoverUrl("https://example.com/cover.jpg"),
        "https://example.com/cover.jpg"
    );
    assert.equal(getDisplayCoverUrl("javascript:alert(1)"), null);
    assert.equal(getDisplayCoverUrl("  "), null);
});

test("公开投稿只接受 HTTPS 封面", () => {
    const secureForm = validSubmissionForm();
    secureForm.set("cover_url", "https://example.com/cover.jpg");
    assert.equal(parseSubmissionForm(secureForm).input.cover_url, "https://example.com/cover.jpg");

    const insecureForm = validSubmissionForm();
    insecureForm.set("cover_url", "http://example.com/cover.jpg");
    assert.throws(() => parseSubmissionForm(insecureForm), /封面 URL 必须使用 HTTPS/);
});

test("全部公开封面渲染入口禁用跨站 Referer", async () => {
    const [artwork, row, carousel] = await Promise.all(
        [
            "../src/components/EventArtwork.astro",
            "../src/components/EventRow.svelte",
            "../src/components/FeaturedEventCarousel.svelte"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    assert.match(artwork, /referrerpolicy="no-referrer"/);
    assert.match(row, /referrerpolicy="no-referrer"/);
    assert.match(carousel, /referrerpolicy: "no-referrer"/);
    assert.match(carousel, /referrerpolicy="no-referrer"/);
});
