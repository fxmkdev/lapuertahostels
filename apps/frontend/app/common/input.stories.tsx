import { allModes } from "../../.storybook/modes";
import { Input } from "./input";
import { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "common/Input",
  component: Input,
  argTypes: {},
  parameters: {
    chromatic: {
      modes: {
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
  },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    type: "email",
    name: "email",
    autoComplete: "email",
    required: true,
    placeholder: "Enter your email",
  },
};
