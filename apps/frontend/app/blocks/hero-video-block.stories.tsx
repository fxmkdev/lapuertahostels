import type { Meta, StoryObj } from "@storybook/react";

import { HeroVideoBlock, HeroVideoBlockProps } from "./hero-video-block";
import { callToAction, media } from "~/common/cms-data.builders";
import {
  bold,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Hero Video Block",
  component: HeroVideoBlock,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "HeroVideo",
    video: media("video-compressed.mp4"),
    previewImage: media("video-compressed-preview.png"),
    overlayTitle: {
      show: true,
      text: richTextRoot(
        paragraph(text("Explore "), bold("Tayrona")),
      ) as unknown as NonNullable<HeroVideoBlockProps["overlayTitle"]>["text"],
      overlay: "subtle",
      position: "center",
      cta: callToAction("Book Now", "primary"),
    },
  },
};

export const WithoutOverlayTitle: Story = {
  args: {
    ...Default.args,
    overlayTitle: { show: false },
  },
};
