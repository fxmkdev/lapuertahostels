function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getTargetPageId(value: unknown): string | undefined {
  if (isRecord(value)) {
    if ("relationTo" in value) {
      return value.relationTo === "pages"
        ? getTargetPageId(value.value)
        : undefined;
    }
    return getTargetPageId(value.id);
  }
  return typeof value === "string" && value.length > 0
    ? value
    : typeof value === "number"
      ? String(value)
      : undefined;
}

export function getPageFragmentOptions(page: unknown) {
  if (!isRecord(page)) return [];

  const anchors = new Set<string>();
  for (const blocks of [page.hero, page.content]) {
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (
        isRecord(block) &&
        typeof block.elementId === "string" &&
        block.elementId.trim().length > 0
      ) {
        anchors.add(block.elementId);
      }
    }
  }
  return Array.from(anchors, (value) => ({ label: `#${value}`, value }));
}
