export function getPosterUrl(
  key: string | null | undefined,
  r2BaseUrl: string
): string {
  if (!key) return "/placeholder-poster.svg";
  if (r2BaseUrl) return `${r2BaseUrl}/${key}`;
  return `/r2/${key}`;
}
