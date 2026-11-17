import type { Meta, StoryObj } from "@storybook/react";
import { PreviewBar } from "./preview-bar";

const meta = {
  title: "layout/Preview Bar",
  component: PreviewBar,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof PreviewBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    adminLocale: "en",
  },
};

export const Spanish: Story = {
  args: {
    ...Default.args,
    adminLocale: "es",
  },
};
