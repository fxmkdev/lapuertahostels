export const IS_BOLD = 1;
export const IS_ITALIC = 1 << 1;
export const IS_STRIKETHROUGH = 1 << 2;
export const IS_UNDERLINE = 1 << 3;
export const IS_CODE = 1 << 4;
export const IS_SUBSCRIPT = 1 << 5;
export const IS_SUPERSCRIPT = 1 << 6;
export const IS_HIGHLIGHT = 1 << 7;

export type RichTextObject = {
  root: {
    type: "root";
    children: ElementNode[];
    direction: ("ltr" | "rtl") | null;
    format: "left" | "start" | "center" | "right" | "end" | "justify" | "";
    indent: number;
    version: number;
  };
};

export type TextNode = {
  type: "text";
  text?: string;
  format: number;
};

export type ElementNode =
  | ListItemElementNode
  | ParagraphElementNode
  | LinkElementNode
  | ListElementNode
  | HeadingElementNode;

export type Node = ElementNode | TextNode | LineBreakNode;

export type LineBreakNode = {
  type: "linebreak";
};

type BaseElementNode = {
  version: number;
  children: Node[];
};

export type ListItemElementNode = BaseElementNode & {
  type: "listitem";
};

export type ParagraphElementNode = BaseElementNode & {
  type: "paragraph";
  indent?: number;
};

export type HeadingElementNode = BaseElementNode & {
  type: "heading";
  tag: "h4" | "h5";
};

export type LinkElementNode = BaseElementNode & {
  type: "link";
  fields:
    | {
        linkType: "custom";
        url: string;
      }
    | {
        linkType: "internal";
        doc: {
          relationTo: "pages";
          value: {
            pathname: string;
          };
        };
        queryString?: string;
        fragment?: string;
      };
};

export type ListElementNode = BaseElementNode & {
  type: "list";
  tag: "ul" | "ol";
};

export function richTextRoot(...children: ElementNode[]): RichTextObject {
  return {
    root: {
      type: "root",
      children,
      version: 1,
      format: "",
      indent: 0,
      direction: null,
    },
  };
}

export function text(
  text: string | undefined,
  {
    bold,
    italic,
    underline,
    strikethrough,
    code,
  }: {
    bold?: true;
    italic?: true;
    underline?: true;
    strikethrough?: true;
    code?: true;
  } = {},
): TextNode {
  const node = { type: "text", text, format: 0 } satisfies TextNode;

  if (bold) node.format += IS_BOLD;
  if (italic) node.format += IS_ITALIC;
  if (underline) node.format += IS_UNDERLINE;
  if (strikethrough) node.format += IS_STRIKETHROUGH;
  if (code) node.format += IS_CODE;

  return node;
}

export function lineBreak(): LineBreakNode {
  return { type: "linebreak" };
}

export function bold(t: string): TextNode {
  return text(t, { bold: true });
}

export function italic(t: string): TextNode {
  return text(t, { italic: true });
}

export function underline(t: string): TextNode {
  return text(t, { underline: true });
}

export function strikethrough(t: string): TextNode {
  return text(t, { strikethrough: true });
}

export function code(t: string): TextNode {
  return text(t, { code: true });
}

export function unsupportedElementWithoutChildren(): ElementNode {
  return { type: "NOT_SUPPORTED" } as unknown as ElementNode;
}

export function listitem(...children: Node[]): ListItemElementNode {
  return { type: "listitem", version: 1, children };
}

export function paragraph(...args: Node[]): ParagraphElementNode;
export function paragraph(
  indent: number,
  ...children: Node[]
): ParagraphElementNode;
export function paragraph(
  ...args: Node[] | [number, ...Node[]]
): ParagraphElementNode {
  if (typeof args[0] === "number") {
    const [indent, ...children] = args as [number, ...Node[]];

    return {
      type: "paragraph",
      version: 1,
      indent,
      children,
    };
  }

  return {
    type: "paragraph",
    version: 1,
    children: args as Node[],
  };
}

export function heading(
  tag: "h4" | "h5",
  ...children: Node[]
): HeadingElementNode {
  return { type: "heading", version: 1, tag, children };
}

export function list(
  tag: "ul" | "ol",
  ...children: ElementNode[]
): ListElementNode {
  return { type: "list", version: 1, tag, children };
}

export function customUrlLink(
  url: string,
  ...children: Node[]
): LinkElementNode {
  return {
    type: "link",
    version: 1,
    fields: { linkType: "custom", url },
    children,
  };
}

export function internalLink(
  pathname: string,
  ...children: Node[]
): LinkElementNode {
  return {
    type: "link",
    version: 1,
    fields: {
      linkType: "internal",
      doc: {
        relationTo: "pages",
        value: { pathname },
      },
    },
    children,
  };
}
