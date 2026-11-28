import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Tabs } from "./tabs";
import { allModes } from "../../.storybook/modes";

const meta = {
  title: "common/Tabs",
  component: Tabs,
  parameters: {
    chromatic: {
      modes: {
        "brand-puerta": { brand: "puerta", viewport: "desktop" },
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
        mobile: allModes["viewport-small-mobile"],
      },
    },
  },
  render: function ControlledTabs(args) {
    const [selectedIndex, setSelectedIndex] = useState(args.selectedIndex);
    return (
      <div className="max-w-sm p-4">
        <Tabs
          {...args}
          selectedIndex={selectedIndex}
          onChange={setSelectedIndex}
        />
      </div>
    );
  },
} satisfies Meta<typeof Tabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Locations",
    selectedIndex: 0,
    onChange: () => {},
    items: [
      {
        id: "aqua",
        label: "Aqua Hostel",
        content: <p>Stay with us at Puerta Aqua.</p>,
      },
      {
        id: "azul",
        label: "Azul Hostel",
        content: <p>Discover Puerta Azul.</p>,
      },
    ],
  },
};

export const WrappingLabels: Story = {
  args: {
    ...Default.args,
    items: [
      ...Default.args!.items!,
      {
        id: "park",
        label: "Parque de los Novios",
        content: <p>Explore our neighborhood.</p>,
      },
    ],
  },
};
