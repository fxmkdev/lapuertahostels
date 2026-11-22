import type { FocalPoint } from "../image-focal-point";

export type ImageViewerImage = {
  src: string;
  alt?: string;
  caption?: string;
  aspectRatio: number;
  focalPoint?: FocalPoint;
};
