import { PUBLIC_DATA_CACHE_NAMESPACE, type PublicDataCacheStore } from "./public-data";

export interface PublicDataCacheInvalidationStore {
    delete(request: Request): Promise<boolean>;
}

export async function openPublicDataCacheStore(): Promise<PublicDataCacheStore> {
    const cache = await caches.open(PUBLIC_DATA_CACHE_NAMESPACE);
    return {
        match: (request) => cache.match(request),
        put: (request, response) => cache.put(request, response)
    };
}

export async function openPublicDataCacheInvalidationStore(): Promise<PublicDataCacheInvalidationStore> {
    const cache = await caches.open(PUBLIC_DATA_CACHE_NAMESPACE);
    return {
        delete: (request) => cache.delete(request)
    };
}
