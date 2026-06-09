import { PropsWithChildren } from "react";
import { Heading, HeadingProps } from "./heading";
import { Paragraph } from "./paragraph";
import { RichTextObject } from "@lapuertahostels/rich-text";
import { TextHighlight } from "./text-highlight";
import { useTheme } from "~/themes";
import { cn } from "./cn";
import { Link } from "./link";
import { isEmptyRichText, RichText } from "./rich-text";

export type LongFormRichTextProps = {
  content?: RichTextObject;
  baseHeadingLevel: number;
};

export function LongFormRichText({
  content,
  baseHeadingLevel,
}: LongFormRichTextProps) {
  const theme = useTheme();

  if (isEmptyRichText(content)) return null;
  return (
    <RichText
      content={content}
      elements={{
        bold: (props: PropsWithChildren) => (
          <TextHighlight variant="neutral" {...props} />
        ),
        h4: (props: PropsWithChildren) => (
          <Heading
            {...props}
            as={`h${baseHeadingLevel}` as HeadingProps["as"]}
            size="small"
            className="mt-10 first:mt-0 md:mt-12"
          />
        ),
        h5: (props: PropsWithChildren) => (
          <Heading
            {...props}
            as={`h${baseHeadingLevel + 1}` as HeadingProps["as"]}
            size="extra-small"
            className="mt-8 first:mt-0 md:mt-10"
          />
        ),
        paragraph: ({ indent, ...props }) => (
          <Paragraph
            {...props}
            justify
            className={cn("mt-3 first:mt-0 md:mt-4")}
            style={{
              marginInlineStart: indent ? `${indent * 1.5}rem` : undefined,
            }}
          />
        ),
        ul: (props: PropsWithChildren) => (
          <ul
            {...props}
            className="mt-3 list-disc first:mt-0 md:mt-4 [&_ul]:list-[revert]"
          />
        ),
        ol: (props: PropsWithChildren) => (
          <ol {...props} className="mt-3 list-decimal first:mt-0 md:mt-4" />
        ),
        li: (props: PropsWithChildren) => (
          <li {...props} className="ms-6 mt-1.5 md:mt-2" />
        ),
        link: ({ to, ...props }: PropsWithChildren<{ to: string }>) => (
          <Link
            {...props}
            className={cn(
              theme.linkColors.textColor,
              theme.linkColors.hoverTextColor,
              "font-bold hover:underline",
            )}
            to={to}
          />
        ),
      }}
    />
  );
}
