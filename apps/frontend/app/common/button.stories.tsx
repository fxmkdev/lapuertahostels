import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { allModes } from "../../.storybook/modes";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";

const meta = {
  title: "common/Button",
  component: Button,
  argTypes: {},
  parameters: {
    chromatic: {
      modes: {
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Click Here",
    icon: Cog6ToothIcon,
  },
};

export const Primary: Story = {
  args: {
    ...Default.args,
    variant: "primary",
  },
};

export const PrimaryFloatingActionButton: Story = {
  args: {
    ...Default.args,
    variant: "primary",
    size: "floating-action-button",
  },
};

export const Large: Story = {
  args: {
    ...Default.args,
    size: "large",
  },
};

export const Small: Story = {
  args: {
    ...Default.args,
    size: "small",
  },
};

export const WithoutIcon: Story = {
  args: {
    ...Default.args,
    icon: undefined,
  },
};
