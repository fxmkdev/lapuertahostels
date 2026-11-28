import type { Meta, StoryObj } from "@storybook/react";

import { SlideImage } from "./slide-image";
import { media } from "~/common/cms-data.builders";

const meta = {
  component: SlideImage,
  title: "blocks/Hero Slides Block/Slide Image",
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SlideImage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    media: media("azzedine-rouichi-gc5OYAll-rc-unsplash.jpg", "Example image"),
  },
};

export const FocalPoint: Story = {
  args: {
    media: {
      ...media(
        "david-hertle-3YCkAhD--Ic-unsplash.jpg",
        "Courtyard framed toward the left",
      ),
      width: 1280,
      height: 854,
      focalX: 20,
      focalY: 70,
    },
    alignment: "bottom",
    withPreview: true,
  },
  decorators: [
    (Story) => (
      <div style={{ height: "40rem" }}>
        <Story />
      </div>
    ),
  ],
};
