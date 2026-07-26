export const POPULARITY_WINDOWS = [3, 7, 30] as const;

export type PopularityWindow = (typeof POPULARITY_WINDOWS)[number];

export function parsePopularityWindow(value: string | null | undefined): PopularityWindow {
    const parsed = Number(value);
    return parsed === 3 || parsed === 7 || parsed === 30 ? parsed : 7;
}

export async function hashEventVisitor(eventId: number, ip: string, secret: string) {
    if (!Number.isSafeInteger(eventId) || eventId < 1) {
        throw new Error("Invalid event id");
    }
    if (!ip.trim() || !secret) {
        throw new Error("Visitor hash input is incomplete");
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`event:${eventId}\nip:${ip.trim()}`)
    );

    return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
        ""
    );
}
