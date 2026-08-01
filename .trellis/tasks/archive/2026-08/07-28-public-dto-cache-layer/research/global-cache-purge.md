# Cloudflare global purge evidence

Research date: 2026-08-01.

## Cache API locality

Cloudflare Cache API documentation states that cache contents do not replicate outside the originating data center. `cache.delete()` purges only the data center where the Worker was invoked.

Source: https://developers.cloudflare.com/workers/runtime-apis/cache/

Implication: the existing bounded local delete helper cannot support six-hour TTLs by itself without allowing other data centers to remain stale for the full TTL.

## Cache-Tag support

Cache API `put()` respects the `Cache-Tag` response header. Cloudflare can purge Cache API assets globally by tag through the zone cache purge API.

Sources:

- https://developers.cloudflare.com/workers/reference/how-the-cache-works/#purge-assets-stored-with-the-cache-api
- https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/
- https://developers.cloudflare.com/api/resources/cache/methods/purge/

API contract:

```text
POST /client/v4/zones/{zone_id}/purge_cache
Authorization: Bearer <token>
Content-Type: application/json

{"tags":["eventlist-homepage","eventlist-list"]}
```

## Free-plan limits

Cloudflare's current availability table includes URL, hostname, tag, prefix and purge-everything operations on Free. Hostname/tag/prefix/purge-everything limits are 5 requests per minute, bucket size 25 and 100 operations per request.

Source: https://developers.cloudflare.com/cache/how-to/purge-cache/#availability-and-limits

Implication: combine all tags affected by one administrator mutation into a single purge request. Do not issue one request per cache key or activity ID.

## Security boundary

Use an API token restricted to the target zone and Cache Purge permission. Do not use a Global API key or grant Workers Scripts write permission. The token is a Worker secret and must never enter source, logs or error responses.
