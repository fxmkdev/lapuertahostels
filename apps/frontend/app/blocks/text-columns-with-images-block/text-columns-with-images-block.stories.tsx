import type { Meta, StoryObj } from "@storybook/react";

import {
  TextColumnsWithImagesBlock,
  TextColumnsWithImagesBlockProps,
} from "./text-columns-with-images-block";
import { callToAction, media } from "~/common/cms-data.builders";
import { createId } from "@paralleldrive/cuid2";
import {
  bold,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Text Columns with Images Block",
  component: TextColumnsWithImagesBlock,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TextColumnsWithImagesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "TextColumnsWithImages",
    heading: "Our Services",
    text: richTextRoot(
      paragraph(
        text("Our services are designed to "),
        bold("make your life easier."),
      ),
    ) as unknown as TextColumnsWithImagesBlockProps["text"],
    numberOfColumns: 3,
    items: [
      {
        id: createId(),
        image: media("_DSC0320.jpg"),
        heading: "Example Heading",
        text: richTextRoot(
          paragraph(
            text("Lorem ipsum dolor sit amet, consectetur adipiscing elit."),
          ),
        ) as unknown as NonNullable<
          TextColumnsWithImagesBlockProps["items"]
        >[number]["text"],
        cta: callToAction("Learn More"),
        size: "full",
      },
      {
        id: createId(),
        image: media("Tayrona 4.jpg"),
        heading: "Another Service",
        text: richTextRoot(
          paragraph(
            text(
              "Vivamus luctus urna sed urna ultricies ac tempor dui sagittis.",
            ),
          ),
        ) as unknown as NonNullable<
          TextColumnsWithImagesBlockProps["items"]
        >[number]["text"],
        cta: callToAction("Learn More"),
        size: "full",
      },
      {
        id: createId(),
        image: media("CP4.jpg"),
        heading: "This is Interesting",
        text: richTextRoot(
          paragraph(
            text(
              "In condimentum facilisis porta. Sed nec diam eu diam mattis viverra. ",
            ),
          ),
        ) as unknown as NonNullable<
          TextColumnsWithImagesBlockProps["items"]
        >[number]["text"],
        cta: callToAction("Learn More"),
        size: "full",
      },
      {
        id: createId(),
        image: media("Minca 5.png"),
        heading: "This service",
        text: richTextRoot(
          paragraph(
            text(
              " Nulla fringilla, orci ac euismod semper, magna diam porttitor mauris, quis sollicitudin sapien justo in libero.",
            ),
          ),
        ) as unknown as NonNullable<
          TextColumnsWithImagesBlockProps["items"]
        >[number]["text"],
        cta: callToAction("Learn More"),
        size: "full",
      },
    ],
  },
};

export const TwoColumns: Story = {
  args: {
    ...Default.args,
    numberOfColumns: 2,
  },
};

export const FourColumns: Story = {
  args: {
    ...Default.args,
    numberOfColumns: 4,
  },
};

export const WithDifferentSizes: Story = {
  args: {
    ...Default.args,
    items: [
      {
        ...(Default.args?.items && Default.args.items[0]),
        size: "small",
      },
      {
        ...(Default.args?.items && Default.args.items[2]),
        size: "full",
      },
      {
        ...(Default.args?.items && Default.args.items[1]),
        size: "medium",
      },
    ],
  },
};

export const WithoutHeadingAndText: Story = {
  args: {
    ...Default.args,
    heading: undefined,
    text: undefined,
  },
};
