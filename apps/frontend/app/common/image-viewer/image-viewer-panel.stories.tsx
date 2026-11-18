import type { Meta, StoryObj } from "@storybook/react";
import { ImageViewerPanel } from "./image-viewer-panel";
import { Transition } from "@headlessui/react";

const meta = {
  title: "common/Image Viewer/Image Viewer Panel",
  component: ImageViewerPanel,
  argTypes: {},
  decorators: [
    (Story) => (
      <Transition show={true} as="div" className="h-screen w-screen bg-black">
        <Story />
      </Transition>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ImageViewerPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    defaultImageIndex: 1,
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
        caption: "This is another caption",
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
    ],
    onDismiss: () => {},
  },
};
