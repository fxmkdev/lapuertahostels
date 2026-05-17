import type { Meta, StoryObj } from "@storybook/react";

import { Heading, HeadingHighlight } from "./heading";
import { cn } from "./cn";
import { allModes } from "../../.storybook/modes";
import { themesByBrand } from "~/themes";
import { BrandId } from "~/brands";

const meta = {
  title: "common/Heading",
  component: Heading,
  argTypes: {
    as: { control: "select", options: ["h1", "h2", "h3", "h4", "h5", "h6"] },
    size: { control: "radio", options: ["medium", "large", "extra-large"] },
    variant: { control: "radio", options: ["brand", "white", "inherit"] },
    children: { control: false },
  },
  parameters: {
    layout: "fullscreen",
    chromatic: {
      modes: {
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
  },
  decorators: [
    (Story, { parameters, globals }) => (
      <div
        className={cn("h-screen px-8 py-2 text-neutral-900", {
          [themesByBrand[globals.brand as BrandId].bannerBackgroundColor]:
            parameters.background === "brand",
        })}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Heading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    as: "h1",
    children: "Discover the Colombian Costa Caribe",
    size: "extra-large",
  },
};

export const VariantInherit: Story = {
  args: {
    ...Default.args,
    variant: "inherit",
  },
};

export const VariantWhiteWithHighlight: Story = {
  args: {
    ...Default.args,
    children: (
      <>
        Discover the <HeadingHighlight>Colombian Costa Caribe</HeadingHighlight>
      </>
    ),
    variant: "white",
  },
  parameters: {
    background: "brand",
  },
};

export const WithTextShadow: Story = {
  args: {
    ...Default.args,
    children: (
      <>
        Discover the <HeadingHighlight>Colombian Costa Caribe</HeadingHighlight>
      </>
    ),
    variant: "white",
    textShadow: true,
  },
  parameters: {
    background: "brand",
  },
};

export const SizeLarge: Story = {
  args: {
    ...Default.args,
    size: "large",
  },
};

export const SizeMedium: Story = {
  args: {
    ...Default.args,
    size: "medium",
  },
};

export const SizeSmall: Story = {
  args: {
    ...Default.args,
    size: "small",
  },
};

export const SizeExtraSmall: Story = {
  args: {
    ...Default.args,
    size: "extra-small",
  },
};
