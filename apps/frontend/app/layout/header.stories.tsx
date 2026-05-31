import { Meta, StoryObj } from "@storybook/react";
import { Header } from "./header";
import { banner, brand, internalLink, media } from "~/common/cms-data.builders";

const meta = {
  title: "layout/Header",
  component: Header,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Header>;

export default meta;
type Story = StoryObj<typeof meta>;

const puertaBrand = brand({
  id: "puerta",
  name: "La Puerta Hostels",
  logo: media("logo-puerta-simple.png"),
  homeLink: internalLink("/"),
  rootPath: "/",
  navLinks: [
    {
      label: "Puerta Aqua",
      link: internalLink("/aqua"),
    },
    {
      label: "La Puerta Azul",
      link: internalLink("/azul"),
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
  banner: banner("Travel before 20 September and get 20% off!", "Book now"),
});

export const Default: Story = {
  args: {
    brand: puertaBrand,
    allBrands: [puertaBrand],
    onHeightChanged: () => {},
    publishedLocales: [
      { id: "en", displayLabel: "English" },
      { id: "es", displayLabel: "Español" },
    ],
  },
};
