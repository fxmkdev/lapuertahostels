import type { Features } from "@lapuertahostels/payload-types";

export type FeaturesBlock = Features;

export type Feature = FeaturesBlock["items"][number];
