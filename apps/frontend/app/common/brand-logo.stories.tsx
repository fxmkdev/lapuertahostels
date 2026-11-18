import type { Meta, StoryObj } from "@storybook/react";

import { BrandLogo } from "./brand-logo";
import type { Brand } from "@lapuertahostels/payload-types";
import { media } from "./cms-data.builders";

const meta = {
  title: "common/Brand Logo",
  component: BrandLogo,
  argTypes: {},
} satisfies Meta<typeof BrandLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Large: Story = {
  args: {
    size: "large",
    brand: {
      id: "puerta",
      logo: media("logo-puerta-simple.png", "La Puerta Hostels Logo"),
      name: "La Puerta Hostels",
    } as Brand,
    type: "with-wordmark",
  },
};

export const Small: Story = {
  args: {
    ...Large.args,
    size: "small",
  },
};

export const Simple: Story = {
  args: {
    ...Large.args,
    type: "simple",
  },
};

export const Aqua: Story = {
  args: {
    ...Large.args,
    brand: {
      id: "aqua",
      logo: media("logo-aqua-simple.png", "Puerta Aqua Logo"),
      name: "Puerta Aqua",
    } as Brand,
  },
};

export const Azul: Story = {
  args: {
    ...Large.args,
    brand: {
      id: "azul",
      logo: media("logo-azul-simple.png", "La Puerta Azul Logo"),
      name: "La Puerta Azul",
    } as Brand,
  },
};
