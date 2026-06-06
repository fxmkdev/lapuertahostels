import type { Meta, StoryObj } from "@storybook/react";

import { Navbar } from "./navbar";
import {
  brand,
  customLink,
  internalLink,
  media,
} from "~/common/cms-data.builders";

const meta = {
  title: "layout/Navbar",
  component: Navbar,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Navbar>;

export default meta;
type Story = StoryObj<typeof meta>;

const puertaBrand = brand({
  id: "puerta",
  name: "La Puerta Hostels",
  homeLink: internalLink("/"),
  rootPath: "/",
  navLinks: [
    {
      label: "Accommodations",
      link: internalLink("/accommodations"),
    },
    {
      label: "Santa Marta",
      link: internalLink("/santa-marta"),
    },
    {
      label: "About Us",
      link: internalLink("/about-us"),
    },
    {
      label: "Contact",
      link: internalLink("/contact"),
    },
  ],
  bookCta: {
    show: true,
    label: "Book Now",
    link: customLink("https://www.example.com"),
  },
  logo: media("logo-puerta-simple.png"),
});

export const Default: Story = {
  args: {
    allBrands: [puertaBrand],
    brand: puertaBrand,
    onHeightChanged: () => {},
    publishedLocales: [
      { id: "en", displayLabel: "English" },
      { id: "es", displayLabel: "Español" },
    ],
  },
};

export const WithoutBookCta: Story = {
  name: "Without Book CTA",
  args: {
    ...Default.args,
    brand: {
      ...puertaBrand,
      bookCta: { show: false },
    },
  },
};
