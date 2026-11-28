import type { ImageManifest } from "@lapuertahostels/payload-types";
import type { FocalPoint } from "../image-focal-point";

export type ImageViewerImage = {
  src: string;
  variants?: ImageManifest;
  originalVersion?: string;
  alt?: string;
  caption?: string;
  aspectRatio: number;
  focalPoint?: FocalPoint;
};
