import type { Meta, StoryObj } from "@storybook/react";
import { WideImageBlock, WideImageBlockProps } from "./wide-image-block";
import { callToAction, media } from "~/common/cms-data.builders";
import { createId } from "@paralleldrive/cuid2";
import {
  bold,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Wide Image Block",
  component: WideImageBlock,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof WideImageBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    image: media("IMG_6303.jpg"),
    overlayTextBox: {
      show: true,
      heading: "Feel at Home",
      text: richTextRoot(
        paragraph(
          text("Experience "),
          bold("Colombian hospitality"),
          text(" in our boutique hostel's "),
          bold("inviting community areas"),
          text(", perfect for "),
          bold("connecting"),
          text(" and creating "),
          bold("unforgettable"),
          text(" memories."),
        ),
      ) as unknown as NonNullable<
        WideImageBlockProps["overlayTextBox"]
      >["text"],
      cta: callToAction("Discover More"),
      position: "top-right",
    },
    id: createId(),
    blockType: "WideImage",
  },
};

export const WithoutOverlayTextBox: Story = {
  args: {
    ...Default.args,
    overlayTextBox: undefined,
  },
};
