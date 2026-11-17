import type { Meta, StoryObj } from "@storybook/react";
import { ImageViewerControlsOverlay } from "./image-viewer-controls-overlay";

const meta = {
  title: "common/Image Viewer/Image Viewer Controls Overlay",
  component: ImageViewerControlsOverlay,
  argTypes: {},
  decorators: [
    (Story) => (
      <div className="h-screen w-screen bg-black">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ImageViewerControlsOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    supportsFullscreen: true,
    isFullscreen: false,
    currentImageIndex: 1,
    numberOfImages: 6,
    caption: "This is a long caption which will overflow on smaller devices",
    onDismiss: () => {},
    onGoToNextImage: () => {},
    onGoToPreviousImage: () => {},
    onEnterFullscreen: () => {},
    onExitFullscreen: () => {},
  },
};

export const Fullscreen: Story = {
  args: {
    ...Default.args,
    isFullscreen: true,
  },
};

export const SingleImage: Story = {
  args: {
    ...Default.args,
    currentImageIndex: 0,
    numberOfImages: 1,
  },
};
