export async function cleanup(store, currentId, now = Date.now()) {
  const objects = await store.list("snapshots/");
  const complete = [];
  for (const object of objects.filter(({ Key }) =>
    Key.endsWith("/manifest.json"),
  )) {
    const manifest = await store.json(object.Key);
    if (
      manifest.formatVersion !== 1 ||
      !Number.isFinite(Date.parse(manifest.createdAt))
    )
      throw new Error("Invalid snapshot during cleanup");
    complete.push(manifest);
  }
  const retained = new Set([
    currentId,
    ...complete
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id }) => id)
      .filter((id) => id !== currentId)
      .slice(0, 4),
  ]);
  const completed = new Set(complete.map(({ id }) => id));
  const expired = objects.filter((object) => {
    const id = object.Key.split("/")[1];
    return (
      !retained.has(id) &&
      (completed.has(id) ||
        now - new Date(object.LastModified).getTime() > 24 * 60 * 60 * 1000)
    );
  });
  await store.remove(expired.map(({ Key }) => Key));
}
