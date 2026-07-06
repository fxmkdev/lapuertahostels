import type { Meta, StoryObj } from "@storybook/react";
import { StoryBlock, StoryBlockProps } from "./story-block";
import { media } from "~/common/cms-data.builders";
import {
  bold,
  paragraph,
  richTextRoot,
  text,
} from "@lapuertahostels/rich-text";

const meta = {
  title: "blocks/Story Block",
  component: StoryBlock,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof StoryBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "Story",
    heading: "About Us",
    text: richTextRoot(
      paragraph(
        text("Step into our "),
        bold("Santa Marta haven,"),
        text(" where the "),
        bold("Caribbean breeze whispers tales of adventure,"),
        text(
          " and the Sierra Nevada mountains cradle our dreams. Three years ago, a passionate soul embarked on a journey to craft more than just a hostel—a place where every traveler feels the warmth of connection and the embrace of a second home.",
        ),
      ),
      paragraph(
        text(
          "We didn’t just paint walls; we painted stories. Our founder, driven by a ",
        ),
        bold("deep love for Santa Marta,"),
        text(
          " worked tirelessly to create a space that resonates with the city’s soul. From vibrant murals that speak of local tales to cozy corners designed for shared laughter, every inch is a canvas of our commitment to authentic experiences.",
        ),
      ),
      paragraph(
        text(
          "Collaborating with skilled local artisans, we’ve woven the spirit of Santa Marta into the very fabric of our hostel. The past three years have seen our space evolve into a ",
        ),
        bold(
          "sanctuary for adventurers, a haven for backpackers, and a tapestry of shared memories",
        ),
        text(" for those exploring Santa Marta’s wonders."),
      ),
      paragraph(
        text(
          "Join us in this heartfelt journey—where stories come to life, friendships find a common thread, and the enchantment of Santa Marta unfolds at our intimately personal hostel.",
        ),
      ),
    ) as unknown as StoryBlockProps["text"],
    image: media("351429301_1381427532589680_2319248312954498147_n.jpg"),
  },
};

export const ImageRight: Story = {
  args: {
    ...Default.args,
    imagePosition: "right",
  },
};

export const Grayscale: Story = {
  args: {
    ...Default.args,
    grayscaleImage: true,
  },
};

export const WithoutImage: Story = {
  args: {
    ...Default.args,
    image: undefined,
  },
};

export const WithoutHeading: Story = {
  args: {
    ...Default.args,
    heading: undefined,
  },
};
