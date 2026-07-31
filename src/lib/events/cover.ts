export function getDisplayCoverUrl(value: string | null | undefined) {
    const coverUrl = value?.trim();
    if (!coverUrl) return null;

    try {
        const url = new URL(coverUrl);
        if (url.protocol === "http:") url.protocol = "https:";
        return url.protocol === "https:" ? url.toString() : null;
    } catch {
        return null;
    }
}
