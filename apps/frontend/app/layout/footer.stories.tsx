import type { Meta, StoryObj } from "@storybook/react";

import { Footer } from "./footer";
import { allModes } from "../../.storybook/modes";
import {
  brand,
  customLink,
  internalLink,
  media,
} from "~/common/cms-data.builders";
import { paragraph, richTextRoot, text } from "@fxmk/common";

const meta = {
  title: "layout/Footer",
  component: Footer,
  argTypes: {},
  parameters: {
    layout: "fullscreen",
    chromatic: {
      modes: {
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
  },
} satisfies Meta<typeof Footer>;

export default meta;
type Story = StoryObj<typeof meta>;

const puertaBrand = brand({
  id: "puerta",
  logo: media("logo-puerta-simple.png"),
  name: "La Puerta Hostels",
  footer: {
    linkGroups: [
      {
        title: "Hotel",
        links: [
          {
            label: "About Us",
            link: internalLink("/about-us"),
          },
          {
            label: "Puerta Aqua",
            link: internalLink("/aqua"),
          },
          {
            label: "La Puerta Azul",
            link: internalLink("/azul"),
          },
          {
            label: "Contact",
            link: internalLink("/contact"),
          },
        ],
      },
      {
        title: "Experiences",
        links: [
          {
            label: "Santa Marta",
            link: internalLink("/santa-marta"),
          },
          {
            label: "Lost City",
            link: internalLink("/lost-city"),
          },
          {
            label: "Tayrona Park",
            link: internalLink("/tayrona-park"),
          },
          {
            label: "Minca",
            link: internalLink("/minca"),
          },
        ],
      },
      {
        title: "Legal",
        links: [
          {
            label: "Terms",
            link: internalLink("/terms"),
          },
          {
            label: "Cancelation",
            link: internalLink("/cancelation"),
          },
          {
            label: "Privacy",
            link: internalLink("/privacy"),
          },
          {
            label: "FAQ",
            link: internalLink("/faq"),
          },
        ],
      },
    ],
  },
});

export const Default: Story = {
  args: {
    content: {
      id: "footer",
      address: richTextRoot(
        paragraph(
          text(`La Puerta Hostels S.A.S.
Calle 18 #5-66
Santa Marta 470004
Colombia`),
        ),
      ),
      copyright: richTextRoot(
        paragraph(text("La Puerta Hostels S.A.S. All rights reserved.")),
      ),
      socialLinks: [
        {
          platform: "facebook",
          link: customLink("http://example.com"),
        },
        {
          platform: "instagram",
          link: customLink("http://example.com"),
        },
        {
          platform: "whatsapp",
          link: customLink("http://example.com"),
        },
      ],
      newsletter: {
        show: true,
        title: "Subscribe to our newsletter",
        description:
          "Don’t miss out on new experiences, discounts, or any other news from us!",
        emailPlaceholder: "Enter your email",
        buttonLabel: "Subscribe",
      },
    },
    allBrands: [puertaBrand],
    brand: puertaBrand,
  },
};
