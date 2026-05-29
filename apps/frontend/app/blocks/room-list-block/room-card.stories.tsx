import { paragraph, richTextRoot, text } from "@fxmk/common";
import { RoomCard, RoomCardProps } from "./room-card";
import { Meta, StoryObj } from "@storybook/react";
import { media, requiredCallToAction } from "~/common/cms-data.builders";

const meta = {
  title: "blocks/Room List Block/Room Card",
  component: RoomCard,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto my-36 flex flex-row flex-wrap justify-center gap-32">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RoomCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    heading: "Standard Room with Terrace",
    text: richTextRoot(
      paragraph(
        text(
          "Our standard room with terrace is perfect for those who want to enjoy the outdoors from the comfort of their own room. The room features a private terrace with a hammock and a view of the garden.",
        ),
      ),
    ) as unknown as RoomCardProps["text"],
    images: [
      {
        image: media("_DSC0358.jpg"),
        caption: "This is a caption",
      },
      {
        image: media("_DSC0337.jpg"),
      },
      {
        image: media("_DSC0360.jpg"),
      },
      {
        image: media("_DSC0334.jpg"),
      },
      {
        image: media("_DSC0820.jpg"),
      },
      {
        image: media("16.jpg"),
      },
      {
        image: media("IMG_6814-Mejorado.jpg"),
      },
    ],
    cta: requiredCallToAction("Reserve Now"),
  },
};

export const WithoutCallToAction: Story = {
  args: {
    ...Default.args,
    cta: {
      ...requiredCallToAction("Reserve Now"),
      show: false,
    },
  },
};
