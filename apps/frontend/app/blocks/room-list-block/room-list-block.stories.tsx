import { media, requiredCallToAction } from "~/common/cms-data.builders";
import { RoomListBlock, RoomListBlockProps } from "./room-list-block";
import { Meta, StoryObj } from "@storybook/react";
import { paragraph, richTextRoot, text } from "@fxmk/common";

const meta = {
  title: "blocks/Room List Block",
  component: RoomListBlock,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof RoomListBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "RoomList",
    rooms: [
      {
        heading: "Standard Room with Terrace",
        text: richTextRoot(
          paragraph(
            text(
              "Our standard room with terrace is perfect for those who want to enjoy the outdoors from the comfort of their own room. The room features a private terrace with a hammock and a view of the garden.",
            ),
          ),
        ) as unknown as NonNullable<
          RoomListBlockProps["rooms"]
        >[number]["text"],
        images: [
          {
            image: media("_DSC0358.jpg"),
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
        ],
        cta: requiredCallToAction("Reserve Now"),
      },
      {
        heading: "Deluxe King Room",
        text: richTextRoot(
          paragraph(
            text(
              "Our deluxe king room is perfect for those who want to enjoy a little extra luxury. The room features a king-size bed, a private balcony, and a view of the garden.",
            ),
          ),
        ) as unknown as NonNullable<
          RoomListBlockProps["rooms"]
        >[number]["text"],
        images: [
          {
            image: media("_DSC0334.jpg"),
          },
          {
            image: media("16.jpg"),
          },
          {
            image: media("IMG_6814-Mejorado.jpg"),
          },
        ],
        cta: {
          ...requiredCallToAction("Reserve Now"),
          show: false,
        },
      },
      {
        heading: "Standard Room",
        text: richTextRoot(
          paragraph(
            text(
              "Our standard room is perfect for those who want to enjoy a comfortable stay. The room features a queen-size bed, a private bathroom, and a view of the garden.",
            ),
          ),
        ) as unknown as NonNullable<
          RoomListBlockProps["rooms"]
        >[number]["text"],
        images: [
          {
            image: media("_DSC0334.jpg"),
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
    ],
  },
};
