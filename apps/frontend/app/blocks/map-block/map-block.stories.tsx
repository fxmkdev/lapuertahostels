import type { Meta, StoryObj } from "@storybook/react";
import type { MapBlockProps } from "./map-block";
import { MapBlock } from "./map-block";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useEnvironment } from "~/common/environment";
import { useSettings } from "~/common/common";
import { allModes } from "../../../.storybook/modes";

const meta = {
  title: "blocks/Map Block",
  component: MapBlock,
  parameters: {
    layout: "fullscreen",
    // give Map some time to load
    chromatic: {
      delay: 1_000,
      modes: {
        "brand-puerta": { brand: "puerta", viewport: "desktop" },
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
        mobile: allModes["viewport-small-mobile"],
      },
    },
  },
  decorators: [
    (Story) => {
      const { googleMapsApiKey } = useEnvironment();
      const { maps } = useSettings();
      return (
        <APIProvider
          apiKey={googleMapsApiKey}
          region={maps?.region ?? undefined}
        >
          <Story />
        </APIProvider>
      );
    },
  ],
} satisfies Meta<typeof MapBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    blockType: "Map",
    address:
      "Puerta Aqua By La Puerta Hostels, Calle 18, Comuna 2, Santa Marta, Magdalena, Colombia",
    zoomLevel: 14.5,
    overlayTextBox: {
      heading: "Visit Us",
      text: richTextRoot(
        paragraph(
          text(
            "We're located in Santa Marta, Colombia. Come say hi! This is a longer text.",
          ),
        ),
        paragraph(text("We're looking forward to meeting you!")),
      ) as unknown as NonNullable<MapBlockProps["overlayTextBox"]>["text"],
      callToActionLabel: "Get Directions",
    },
  },
};

export const LegacySingleLocation: Story = Default;

export const SingleLocation: Story = {
  args: {
    blockType: "Map",
    zoomLevel: 14.5,
    locations: [
      {
        name: "Aqua Hostel",
        address: Default.args!.address!,
        overlayTextBox: {
          ...Default.args!.overlayTextBox!,
          heading: "Stay with us at Puerta Aqua",
          text: Default.args!.overlayTextBox!.text!,
        },
      },
    ],
  },
};

export const MultipleLocations: Story = {
  args: {
    ...SingleLocation.args,
    locations: [
      ...SingleLocation.args!.locations!,
      {
        name: "Parque de los Novios",
        address: "Parque de los Novios, Santa Marta, Colombia",
        overlayTextBox: {
          heading: "Explore our neighborhood",
          text: richTextRoot(
            paragraph(text("Explore the heart of Santa Marta.")),
          ),
          callToActionLabel: "Get Directions",
          position: "top-right",
        },
      },
    ],
  },
};
