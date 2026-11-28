import type { Meta, StoryObj } from "@storybook/react";

import { Navbar } from "./navbar";
import {
  brand,
  banner,
  customLink,
  internalLink,
  media,
} from "~/common/cms-data.builders";
import { Header } from "../header";

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
      id: "accommodations",
      label: "Accommodations",
      link: internalLink("/accommodations"),
    },
    {
      id: "santa-marta",
      label: "Santa Marta",
      link: internalLink("/santa-marta"),
    },
    {
      id: "about-us",
      label: "About Us",
      link: internalLink("/about-us"),
    },
    {
      id: "contact",
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

export const Scrollable: Story = {
  args: {
    ...Default.args,
    brand: {
      ...puertaBrand,
      banner: banner("Travel before 20 September and get 20% off!", "Book now"),
    },
  },
  render: (args) => (
    <>
      <Header {...args} />
      <main className="min-h-[300vh] bg-neutral-50 p-8">
        <h2 className="text-2xl font-bold">Scroll to try the navbar</h2>
        <p className="mt-4">
          Scroll down past 100px to hide the navbar, then scroll up to reveal
          it. On desktop, the booking button stays in place at the top right as
          the rest of the navbar slides away. On mobile, booking is always
          available at the bottom right.
        </p>
        <button className="mt-8 rounded-md border p-3" type="button">
          Focus outside the navbar
        </button>
      </main>
    </>
  ),
};
