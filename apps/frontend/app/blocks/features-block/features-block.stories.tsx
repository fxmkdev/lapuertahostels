import type { Meta, StoryObj } from "@storybook/react";

import { FeaturesBlock, FeaturesBlockProps } from "./features-block";
import { callToAction, media } from "~/common/cms-data.builders";
import {
  bold,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Features Block",
  component: FeaturesBlock,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FeaturesBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "Features",
    items: [
      {
        image: media("_DSC0358.jpg"),
        heading: "Feel Refreshed",
        text: richTextRoot(
          paragraph(
            text("A day full of exploring the city can be tiring. Our "),
            bold("air-conditioned"),
            text(" rooms with "),
            bold("tasteful"),
            text(" details give you the perfect place to relax and unwind."),
          ),
        ) as unknown as FeaturesBlockProps["items"][number]["text"],
      },
      {
        image: media("_DSC0320.jpg"),
        heading: "Cool Down in the Pool",
        text: richTextRoot(
          paragraph(
            text("Our "),
            bold("courtyard pool"),
            text(
              " is the perfect place to cool down after a hot day under the Carribean sun.",
            ),
          ),
        ) as unknown as FeaturesBlockProps["items"][number]["text"],
      },
      {
        image: media("_DSC0820.jpg"),
        heading: "Bring Your Family",
        text: richTextRoot(
          paragraph(
            text("Traveling with your loved ones? We offer "),
            bold("Twin Rooms"),
            text(" allowing an occupancy of up to four people."),
          ),
        ) as unknown as FeaturesBlockProps["items"][number]["text"],
        cta: callToAction("Book Twin Room"),
      },
    ],
  },
};

export const OrientationFirstImageRight: Story = {
  args: {
    ...Default.args,
    orientation: "first-image-right",
  },
};
