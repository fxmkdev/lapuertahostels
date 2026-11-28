import type { Meta, StoryObj } from "@storybook/react";

import { ImageViewer } from "./image-viewer";

const meta = {
  title: "common/Image Viewer",
  component: ImageViewer,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[35rem]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ImageViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    images: [
      {
        src: "/_DSC0358.jpg",
        alt: "",
        caption: "This is a caption",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0337.jpg",
        alt: "",
        aspectRatio: 1.4234693878,
      },
      {
        src: "/_DSC0360.jpg",
        alt: "",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0334.jpg",
        alt: "",
        aspectRatio: 1.4566326531,
      },
      {
        src: "/15.jpg",
        alt: "",
        aspectRatio: 0.5612244898,
      },
      {
        src: "/16.jpg",
        alt: "",
        aspectRatio: 1.7755102041,
      },
      {
        src: "/_dsc0989.jpg",
        alt: "Private balcony",
        aspectRatio: 1.4742990654,
      },
    ],
  },
};

export const SlotsFilledExactly: Story = {
  args: {
    images: [
      {
        src: "/_DSC0358.jpg",
        alt: "",
        caption: "This is a caption",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0337.jpg",
        alt: "",
        aspectRatio: 1.4234693878,
      },
      {
        src: "/_DSC0360.jpg",
        alt: "",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0334.jpg",
        alt: "",
        aspectRatio: 1.4566326531,
      },
      {
        src: "/15.jpg",
        alt: "",
        aspectRatio: 0.5612244898,
      },
    ],
  },
};

export const LessSlotsFilled: Story = {
  args: {
    images: [
      {
        src: "/_DSC0358.jpg",
        alt: "",
        caption: "This is a caption",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0337.jpg",
        alt: "",
        aspectRatio: 1.4234693878,
      },
      {
        src: "/_DSC0360.jpg",
        alt: "",
        aspectRatio: 1.5,
      },
      {
        src: "/_DSC0334.jpg",
        alt: "",
        aspectRatio: 1.4566326531,
      },
    ],
  },
};

export const FocalPoints: Story = {
  args: {
    images: [
      {
        src: "/david-hertle-3YCkAhD--Ic-unsplash.jpg",
        alt: "Courtyard framed toward the left",
        aspectRatio: 1280 / 854,
        focalPoint: { x: 20, y: 70 },
      },
      {
        src: "/datingjungle-Vv4JB0SMfZ4-unsplash.jpg",
        alt: "Landscape framed toward the right",
        aspectRatio: 1280 / 853,
        focalPoint: { x: 90, y: 20 },
      },
    ],
  },
};
