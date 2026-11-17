import { Meta, StoryObj } from "@storybook/react";
import { TestimonialsBlock } from "./testimonials";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { Testimonials } from "@lapuertahostels/payload-types";

const meta = {
  title: "blocks/Testimonials Block",
  component: TestimonialsBlock,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TestimonialsBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  {
    id: "1",
    text: "Great place to stay! The staff was friendly and the location was perfect. I would definitely recommend it to anyone visiting the area.",
    author: "John Doe, USA",
  },
  {
    id: "2",
    text: "Had an amazing experience! The rooms were clean and comfortable, and the amenities were top-notch. Can‘t wait to come back!",
    author: "Jane Smith, Canada",
  },
  {
    id: "3",
    text: "A hidden gem! The atmosphere was so welcoming and the staff went above and beyond to make sure we had a great stay.",
    author: "Emily Johnson, UK",
  },
  {
    id: "4",
    text: "Absolutely loved it! The food was delicious and the activities were so much fun. Highly recommend for a weekend getaway.",
    author: "Michael Brown, Australia",
  },
  {
    id: "5",
    text: "An unforgettable experience! The views were breathtaking and the service was exceptional. Will definitely be returning soon.",
    author: "Max Mustermann, Germany",
  },
];

export const Default: Story = {
  args: {
    heading: "What Our Guests Say",
    supportingText: richTextRoot(
      paragraph(
        text(
          "We take pride in providing the best experience for our guests. Here‘s what they have to say about us.",
        ),
      ),
    ) as unknown as Testimonials["supportingText"],
    items: items.slice(0, 3),
  },
};

export const One: Story = {
  args: {
    ...Default.args,
    items: items.slice(0, 1),
  },
};

export const Two: Story = {
  args: {
    ...Default.args,
    items: items.slice(0, 2),
  },
};

export const Four: Story = {
  args: {
    ...Default.args,
    items: items.slice(0, 4),
  },
};

export const Five: Story = {
  args: {
    ...Default.args,
    items: items.slice(0, 5),
  },
};
