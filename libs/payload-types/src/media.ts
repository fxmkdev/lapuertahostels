/** Public metadata for immutable, pre-generated image files. */
export type ImageVariant = {
  preset: string;
  key: string;
  width: number;
  height: number;
  mimeType: "image/webp" | "image/jpeg";
  focalX: number;
  focalY: number;
  sha256: string;
};
export type ImageManifest = {
  recipeVersion: number;
  sourceHash: string;
  focalX: number;
  focalY: number;
  variants: ImageVariant[];
};

export function readImageManifest(value: unknown): ImageManifest | undefined {
  if (!value || typeof value !== "object") return;
  const manifest = value as ImageManifest;
  const validPoint = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
  if (
    !Number.isInteger(manifest.recipeVersion) ||
    !/^[a-f0-9]{64}$/.test(manifest.sourceHash ?? "") ||
    !validPoint(manifest.focalX) ||
    !validPoint(manifest.focalY) ||
    !Array.isArray(manifest.variants) ||
    !manifest.variants.length
  )
    return;
  if (
    !manifest.variants.every(
      (v) =>
        v &&
        typeof v.preset === "string" &&
        typeof v.key === "string" &&
        v.key.startsWith("optimized/") &&
        !v.key.split("/").includes("..") &&
        Number.isInteger(v.width) &&
        v.width > 0 &&
        Number.isInteger(v.height) &&
        v.height > 0 &&
        ["image/webp", "image/jpeg"].includes(v.mimeType) &&
        validPoint(v.focalX) &&
        validPoint(v.focalY) &&
        /^[a-f0-9]{64}$/.test(v.sha256 ?? ""),
    )
  )
    return;
  return manifest;
}

export function publicMediaUrl(base: string, key: string, version?: string) {
  const url = `${base.replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
}
