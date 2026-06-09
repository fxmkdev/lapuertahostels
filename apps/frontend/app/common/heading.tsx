import { PropsWithChildren, createContext, useContext } from "react";
import { cn } from "./cn";
import { useTheme } from "~/themes";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { TextHighlight } from "./text-highlight";
import { isEmptyRichText, RichText } from "./rich-text";

type HeadingVariant = "brand" | "white" | "inherit";

export type HeadingProps = PropsWithChildren<{
  as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  variant?: HeadingVariant;
  size: "extra-small" | "small" | "medium" | "large" | "extra-large";
  textShadow?: boolean;
  className?: string;
  id?: string;
}>;

export function Heading({
  as: Component,
  variant = "brand",
  size,
  textShadow = false,
  children,
  className,
  id,
}: HeadingProps) {
  const theme = useTheme();
  return (
    <VariantContext.Provider value={variant}>
      <Component
        id={id}
        className={cn(
          variant === "brand"
            ? theme.headingTextColor
            : {
                "text-white": variant === "white",
                "text-inherit": variant === "inherit",
              },
          {
            "font-sans text-sm leading-relaxed font-bold tracking-wider uppercase":
              size === "extra-small",
            "font-sans text-sm leading-relaxed font-bold tracking-wider uppercase md:text-xl md:leading-relaxed md:font-normal md:tracking-normal":
              size === "small",
            "font-serif text-3xl leading-relaxed tracking-tight md:text-4xl md:leading-relaxed":
              size === "medium",
            "font-serif text-4xl leading-relaxed tracking-tight md:text-5xl md:leading-relaxed":
              size === "large",
            "font-serif text-5xl leading-relaxed tracking-tight md:text-6xl md:leading-relaxed md:font-light":
              size === "extra-large",
          },
          className,
        )}
        {...(textShadow ? { style: { textShadow: "2px 2px 20px black" } } : {})}
      >
        {children}
      </Component>
    </VariantContext.Provider>
  );
}

const VariantContext = createContext<HeadingVariant | undefined>(undefined);

function useVariant() {
  const context = useContext(VariantContext);
  if (!context) {
    throw new Error("HeadingHighlight must be used inside a Heading");
  }
  return context;
}

export function HeadingHighlight({ children }: PropsWithChildren) {
  const headingVariant = useVariant();

  if (headingVariant !== "white") {
    throw new Error("Only white heading variant is supported");
  }

  return <TextHighlight variant="white">{children}</TextHighlight>;
}

export type RichTextHeadingProps = Omit<HeadingProps, "children"> & {
  children?: RichTextObject;
};

export function RichTextHeading({ children, ...props }: RichTextHeadingProps) {
  if (isEmptyRichText(children)) return null;
  return (
    <Heading {...props}>
      {children && (
        <RichText
          content={children}
          elements={{
            bold: HeadingHighlight,
          }}
          lineBreakHandling="line-break"
        />
      )}
    </Heading>
  );
}
