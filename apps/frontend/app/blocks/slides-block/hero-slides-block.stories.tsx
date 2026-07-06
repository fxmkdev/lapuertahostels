import type { Meta, StoryObj } from "@storybook/react";

import { HeroSlidesBlock, HeroSlidesBlockProps } from "./hero-slides-block";
import { callToAction, media } from "~/common/cms-data.builders";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Hero Slides Block",
  component: HeroSlidesBlock,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof HeroSlidesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "HeroSlides",
    seoPageHeading: "Welcome to La Puerta Hostels",
    slides: [
      {
        image: media("datingjungle-Vv4JB0SMfZ4-unsplash.jpg"),
        overlayTitle: {
          show: true,
          text: richTextRoot(
            paragraph(text("Lost City")),
          ) as unknown as NonNullable<
            NonNullable<HeroSlidesBlockProps["slides"]>[number]["overlayTitle"]
          >["text"],
          position: "top-right",
          cta: callToAction("Read More", "primary"),
        },
      },
      {
        image: media("azzedine-rouichi-gc5OYAll-rc-unsplash.jpg"),
        overlayTitle: {
          show: true,
          text: richTextRoot(
            paragraph(text("Parque Tayrona")),
          ) as unknown as NonNullable<
            NonNullable<HeroSlidesBlockProps["slides"]>[number]["overlayTitle"]
          >["text"],
          position: "bottom-left",
          cta: callToAction("Read More", "primary"),
        },
      },
      {
        image: media("david-hertle-3YCkAhD--Ic-unsplash.jpg"),
        overlayTitle: {
          show: true,
          text: richTextRoot(
            paragraph(text("Santa Marta")),
          ) as unknown as NonNullable<
            NonNullable<HeroSlidesBlockProps["slides"]>[number]["overlayTitle"]
          >["text"],
          position: "bottom-right",
          cta: callToAction("Read More", "primary"),
        },
      },
      {
        image: media("denise-leisner-8eVV287ST0E-unsplash.jpg"),
        overlayTitle: {
          show: true,
          text: richTextRoot(
            paragraph(text("Minca")),
          ) as unknown as NonNullable<
            NonNullable<HeroSlidesBlockProps["slides"]>[number]["overlayTitle"]
          >["text"],
          position: "top-left",
          cta: callToAction("Read More", "primary"),
        },
      },
    ],
  },
};

export const SingleSlide: Story = {
  args: {
    ...Default.args,
    slides: Default.args?.slides?.slice(0, 1),
  },
};
