export function getLivePreviewUrl(
  baseUrl: string,
  pathname: string,
  dataPath: string,
  locale: string,
) {
  const url = new URL(pathname, baseUrl);
  url.searchParams.set("lng", locale);
  url.searchParams.set("preview", dataPath);
  url.searchParams.set("skipcache", "true");
  return url.toString();
}
