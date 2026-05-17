import type { Meta, StoryObj } from "@storybook/react";

import { Banner } from "./banner";
import { allModes } from "../../.storybook/modes";
import { callToAction2 } from "~/common/cms-data.builders";

const meta = {
  title: "layout/Banner",
  component: Banner,
  argTypes: {},
  parameters: {
    chromatic: {
      modes: {
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
    layout: "fullscreen",
  },
} satisfies Meta<typeof Banner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    id: "1",
    createdAt: "2021-09-01T00:00:00Z",
    updatedAt: "2021-09-01T00:00:00Z",
    message: "Travel before 20 September and get 20% off!",
    cta: callToAction2("Book Now"),
  },
};

export const WithoutCallToAction: Story = {
  args: {
    ...Default.args,
    cta: undefined,
  },
};
