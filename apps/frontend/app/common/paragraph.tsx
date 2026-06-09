import { PropsWithChildren, createContext, useContext } from "react";
import { cn } from "./cn";
import { useTheme } from "~/themes";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { TextHighlight } from "./text-highlight";
import { isEmptyRichText, RichText } from "./rich-text";

type ParagraphVariant = "neutral" | "brand" | "white" | "inherit";

export type ParagraphProps = PropsWithChildren<{
  className?: string;
  style?: React.CSSProperties;
  size?: "small" | "medium" | "large" | "extra-large";
  textShadow?: boolean;
  variant?: ParagraphVariant;
  justify?: boolean;
}>;

export function Paragraph({
  children,
  size = "medium",
  variant = "neutral",
  justify = false,
  textShadow = false,
  className,
  style,
}: ParagraphProps) {
  const theme = useTheme();
  return (
    <VariantContext.Provider value={variant}>
      <p
        className={cn(
          justify && "text-justify hyphens-auto",
          {
            "text-sm leading-normal": size === "small",
            "text-base leading-relaxed": size === "medium",
            "text-md leading-relaxed md:text-lg md:leading-relaxed":
              size === "large",
            "text-lg leading-relaxed md:text-xl md:leading-relaxed":
              size === "extra-large",
          },
          {
            "text-white": variant === "white",
            [theme.paragraphTextColor]: variant === "brand",
            "text-inherit": variant === "inherit",
          },
          className,
        )}
        style={{
          ...style,
          ...(textShadow ? { textShadow: "1px 1px 5px black" } : {}),
        }}
      >
        {children}
      </p>
    </VariantContext.Provider>
  );
}

const VariantContext = createContext<ParagraphVariant | undefined>(undefined);

function useVariant() {
  const context = useContext(VariantContext);
  if (!context) {
    throw new Error("ParagraphHighlight must be used inside a Paragraph");
  }
  return context;
}

export function ParagraphHighlight({ children }: PropsWithChildren) {
  const paragraphVariant = useVariant();

  return (
    <TextHighlight
      variant={paragraphVariant === "neutral" ? "neutral" : "inherit"}
    >
      {children}
    </TextHighlight>
  );
}

export type RichTextParagraphProps = Omit<ParagraphProps, "children"> & {
  children?: RichTextObject;
};

export function RichTextParagraph({
  children,
  ...props
}: RichTextParagraphProps) {
  if (isEmptyRichText(children)) return null;
  return (
    <Paragraph {...props}>
      <RichText
        content={children}
        elements={{ bold: ParagraphHighlight }}
        lineBreakHandling="line-break"
      />
    </Paragraph>
  );
}
