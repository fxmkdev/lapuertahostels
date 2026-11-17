import type { Meta, StoryObj } from "@storybook/react";
import { TextHighlight } from "./text-highlight";
import { themesByBrand } from "~/themes";
import type { BrandId } from "~/brands";
import { cn } from "./cn";

const meta = {
  title: "common/TextHighlight",
  component: TextHighlight,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl px-6">
        <Story />
      </div>
    ),
    (Story, { parameters, globals }) => {
      const theme = themesByBrand[globals.brand as BrandId];
      return (
        <div
          className={cn("h-screen py-8", {
            "bg-white": parameters.background === "white",
            [cn(theme.bannerBackgroundColor, "text-white")]:
              parameters.background === "brand",
            [cn(theme.lightBackgroundColor, theme.paragraphTextColor)]:
              parameters.background === "brand-light",
          })}
        >
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof TextHighlight>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Hello World",
  },
};

export const Inherit: Story = {
  args: {
    ...Default.args,
    variant: "inherit",
  },
  parameters: {
    background: "brand-light",
  },
};

export const White: Story = {
  args: {
    ...Default.args,
    variant: "white",
  },
  parameters: {
    background: "brand",
  },
};
