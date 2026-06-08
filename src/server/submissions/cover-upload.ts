import { createId } from "../events/utils";
import type { EventCover } from "../events/types";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSizeBytes = 2 * 1024 * 1024;

export async function uploadSubmissionCover(input: {
    file: File | null;
    bucket?: R2Bucket;
    publicBaseUrl?: string;
}): Promise<EventCover | undefined> {
    const file = input.file;
    if (!file || file.size === 0) {
        return undefined;
    }

    if (!allowedTypes.has(file.type)) {
        throw new Error("封面图仅支持 JPEG、PNG 或 WebP。");
    }

    if (file.size > maxSizeBytes) {
        throw new Error("封面图不能超过 2MB。");
    }

    const id = createId("cover");
    const extension = extensionForType(file.type);
    const objectKey = `pending/${id}${extension}`;

    if (input.bucket) {
        await input.bucket.put(objectKey, await file.arrayBuffer(), {
            httpMetadata: { contentType: file.type },
        });
    }

    return {
        id,
        eventId: "",
        objectKey,
        filename: file.name || `cover${extension}`,
        mimeType: file.type,
        sizeBytes: file.size,
        status: "pending",
        publicUrl: input.publicBaseUrl
            ? `${input.publicBaseUrl}/${objectKey}`
            : undefined,
    };
}

function extensionForType(type: string): string {
    if (type === "image/png") return ".png";
    if (type === "image/webp") return ".webp";
    return ".jpg";
}
