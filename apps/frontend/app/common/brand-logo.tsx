import { Brand } from "@lapuertahostels/payload-types";
import { cn } from "./cn";
import { getTheme } from "~/themes";
import { MediaImage } from "./media";

export type BrandLogoProps = {
  size: "small" | "large";
  brand: Brand;
  type?: "with-wordmark" | "simple";
  className?: string;
};

export function BrandLogo({
  size,
  brand,
  type = "with-wordmark",
  className,
}: BrandLogoProps) {
  const theme = getTheme(brand.themeColor);
  return (
    <span
      className={cn(
        "flex items-center font-serif text-nowrap uppercase",
        theme.logoTextColor,
        {
          "gap-2 text-base tracking-wider": size === "small",
          "gap-4 text-2xl tracking-wide": size === "large",
        },
        className,
      )}
    >
      <MediaImage
        className={cn({
          "h-7": size === "small",
          "h-10": size === "large",
        })}
        media={brand.logo}
        transformation={{
          height: size === "small" ? 28 : size === "large" ? 40 : undefined,
        }}
        layout="fixed"
      />
      {type === "with-wordmark" && brand.name}
    </span>
  );
}
