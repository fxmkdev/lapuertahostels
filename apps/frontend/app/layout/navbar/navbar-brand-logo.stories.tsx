import type { Meta, StoryObj } from "@storybook/react";

import { NavbarBrandLogo } from "./navbar-brand-logo";
import { brand, internalLink, media } from "~/common/cms-data.builders";

const meta = {
  title: "layout/Navbar/Navbar Brand Logo",
  component: NavbarBrandLogo,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof NavbarBrandLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

const puertaBrand = brand({
  id: "puerta",
  homeLink: internalLink("/"),
  rootPath: "/",
  logo: media("logo-puerta-simple.png"),
  name: "La Puerta Hostels",
});

export const Default: Story = {
  args: {
    allBrands: [puertaBrand],
    brand: puertaBrand,
  },
};
