import { Meta, StoryObj } from "@storybook/react";
import { MapBlock, MapBlockProps } from "./map-block";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { APIProvider } from "@vis.gl/react-google-maps";
import { useEnvironment } from "~/common/environment";
import { useSettings } from "~/common/common";

const meta = {
  title: "blocks/Map Block",
  component: MapBlock,
  parameters: {
    layout: "fullscreen",
    // give Map some time to load
    chromatic: { delay: 1_000 },
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
      ) as unknown as MapBlockProps["overlayTextBox"]["text"],
      callToActionLabel: "Get Directions",
    },
  },
};
