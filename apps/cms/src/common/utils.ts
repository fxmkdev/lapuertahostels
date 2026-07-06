export function getValueByPath(doc: object, fieldPath: string) {
  const fieldPathParts = fieldPath.split(".");
  let value = doc;
  for (const part of fieldPathParts) {
    if (value && typeof value === "object") {
      // @ts-expect-error We don't care about the type here
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
}
