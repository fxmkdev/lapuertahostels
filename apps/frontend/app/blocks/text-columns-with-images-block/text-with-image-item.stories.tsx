import { Meta, StoryObj } from "@storybook/react";
import {
  TextWithImageItem,
  TextWithImageItemProps,
} from "./text-with-image-item";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { callToAction, media } from "~/common/cms-data.builders";
import { createId } from "@paralleldrive/cuid2";

const meta = {
  title: "blocks/Text Columns with Images Block/Text with Image Item",
  component: TextWithImageItem,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="my-8 grid grid-cols-1 gap-x-8 gap-y-16 px-8 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TextWithImageItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: createId(),
    image: media("_DSC0320.jpg"),
    heading: "Example Heading",
    headingLevel: 3,
    text: richTextRoot(
      paragraph(
        text("Lorem ipsum dolor sit amet, consectetur adipiscing elit."),
      ),
    ) as unknown as TextWithImageItemProps["text"],
    cta: callToAction("Learn More"),
    size: "full",
    imageWidth: 430,
    imageSizes: "(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw",
  },
};

export const WithSizeMedium = {
  args: {
    ...Default.args,
    size: "medium",
  },
};

export const WithSizeSmall = {
  args: {
    ...Default.args,
    size: "small",
  },
};

export const WithoutCallToAction = {
  args: {
    ...Default.args,
    cta: undefined,
  },
};

export const WithoutImage = {
  args: {
    ...Default.args,
    image: undefined,
  },
};

export const WithoutText = {
  args: {
    ...Default.args,
    text: undefined,
  },
};

export const WithoutHeading = {
  args: {
    ...Default.args,
    heading: undefined,
  },
};
