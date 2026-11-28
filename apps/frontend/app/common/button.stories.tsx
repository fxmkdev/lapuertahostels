import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import { Input } from "./input";
import { useState } from "react";
import { allModes } from "../../.storybook/modes";
import { Cog6ToothIcon } from "@heroicons/react/20/solid";

const meta = {
  title: "common/Button",
  component: Button,
  argTypes: {},
  parameters: {
    chromatic: {
      modes: {
        "viewport-small-mobile": allModes["viewport-small-mobile"],
        "viewport-large-mobile": allModes["viewport-large-mobile"],
        "brand-aqua": allModes["brand-aqua"],
        "brand-azul": allModes["brand-azul"],
      },
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Click Here",
    icon: Cog6ToothIcon,
  },
};

export const Primary: Story = {
  args: {
    ...Default.args,
    variant: "primary",
  },
};

export const PrimaryFloatingActionButton: Story = {
  args: {
    ...Default.args,
    variant: "primary",
    size: "floating-action-button",
  },
};

export const Large: Story = {
  args: {
    ...Default.args,
    size: "large",
  },
};

export const Small: Story = {
  args: {
    ...Default.args,
    size: "small",
  },
};

export const WithoutIcon: Story = {
  args: {
    ...Default.args,
    icon: undefined,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      {(["primary", "secondary"] as const).flatMap((variant) =>
        (
          ["small", "medium", "large", "floating-action-button"] as const
        ).flatMap((size) =>
          [true, false].map((withIcon) => (
            <Button
              key={`${variant}-${size}-${withIcon}`}
              variant={variant}
              size={size}
              icon={withIcon ? Cog6ToothIcon : undefined}
            >
              {size}
            </Button>
          )),
        ),
      )}
      <Button as="a" href="#destination" size="small">
        Go
      </Button>
      <div id="destination">Link destination</div>
    </div>
  ),
};

export const LongLabels: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-4">
      <Button size="large" variant="primary" icon={Cog6ToothIcon}>
        Explore our accommodation and book your next stay
      </Button>
      <Button size="medium" icon={Cog6ToothIcon}>
        Descubre nuestros alojamientos y reserva tu próxima estancia
      </Button>
      <Button size="small">
        Suscríbete para recibir novedades y ofertas especiales
      </Button>
    </div>
  ),
};

export const FormControls: Story = {
  render: function FormControlsStory() {
    const [submitted, setSubmitted] = useState(false);
    return (
      <form
        className="flex flex-col items-start gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <label className="flex max-w-full flex-col gap-2">
          Email
          <Input type="email" name="email" required />
        </label>
        <label className="flex max-w-full flex-col gap-2">
          Password
          <Input type="password" name="password" required />
        </label>
        <Button type="submit" size="small" variant="primary">
          Sign in
        </Button>
        <output>{submitted ? "Submitted" : "Not submitted"}</output>
      </form>
    );
  },
};
