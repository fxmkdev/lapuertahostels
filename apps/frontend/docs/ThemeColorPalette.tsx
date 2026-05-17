import { ColorPalette, ColorItem } from "@storybook/addon-docs/blocks";

// explicitly mention all color variables to ensure they are included in the Tailwind build
const colors = {
  puerta: {
    50: "var(--color-puerta-50)",
    100: "var(--color-puerta-100)",
    200: "var(--color-puerta-200)",
    300: "var(--color-puerta-300)",
    400: "var(--color-puerta-400)",
    500: "var(--color-puerta-500)",
    600: "var(--color-puerta-600)",
    700: "var(--color-puerta-700)",
    800: "var(--color-puerta-800)",
    900: "var(--color-puerta-900)",
    950: "var(--color-puerta-950)",
  },
  azul: {
    50: "var(--color-azul-50)",
    100: "var(--color-azul-100)",
    200: "var(--color-azul-200)",
    300: "var(--color-azul-300)",
    400: "var(--color-azul-400)",
    500: "var(--color-azul-500)",
    600: "var(--color-azul-600)",
    700: "var(--color-azul-700)",
    800: "var(--color-azul-800)",
    900: "var(--color-azul-900)",
    950: "var(--color-azul-950)",
  },
  aqua: {
    50: "var(--color-aqua-50)",
    100: "var(--color-aqua-100)",
    200: "var(--color-aqua-200)",
    300: "var(--color-aqua-300)",
    400: "var(--color-aqua-400)",
    500: "var(--color-aqua-500)",
    600: "var(--color-aqua-600)",
    700: "var(--color-aqua-700)",
    800: "var(--color-aqua-800)",
    900: "var(--color-aqua-900)",
    950: "var(--color-aqua-950)",
  },
  neutral: {
    50: "var(--color-neutral-50)",
    100: "var(--color-neutral-100)",
    200: "var(--color-neutral-200)",
    300: "var(--color-neutral-300)",
    400: "var(--color-neutral-400)",
    500: "var(--color-neutral-500)",
    600: "var(--color-neutral-600)",
    700: "var(--color-neutral-700)",
    800: "var(--color-neutral-800)",
    900: "var(--color-neutral-900)",
    950: "var(--color-neutral-950)",
  },
  "accent-positive": {
    50: "var(--color-accent-positive-50)",
    100: "var(--color-accent-positive-100)",
    200: "var(--color-accent-positive-200)",
    300: "var(--color-accent-positive-300)",
    400: "var(--color-accent-positive-400)",
    500: "var(--color-accent-positive-500)",
    600: "var(--color-accent-positive-600)",
    700: "var(--color-accent-positive-700)",
    800: "var(--color-accent-positive-800)",
    900: "var(--color-accent-positive-900)",
    950: "var(--color-accent-positive-950)",
  },
  "accent-negative": {
    50: "var(--color-accent-negative-50)",
    100: "var(--color-accent-negative-100)",
    200: "var(--color-accent-negative-200)",
    300: "var(--color-accent-negative-300)",
    400: "var(--color-accent-negative-400)",
    500: "var(--color-accent-negative-500)",
    600: "var(--color-accent-negative-600)",
    700: "var(--color-accent-negative-700)",
    800: "var(--color-accent-negative-800)",
    900: "var(--color-accent-negative-900)",
    950: "var(--color-accent-negative-950)",
  },
};

export function ThemeColorPalette() {
  const styles = getComputedStyle(document.documentElement);
  return (
    <ColorPalette>
      {Object.entries(colors).map(([name, colorSteps]) => (
        <ColorItem
          key={name}
          title={name}
          subtitle=""
          colors={Object.fromEntries(
            Object.entries(colorSteps).map(([step, cssVar]) => [
              step,
              styles.getPropertyValue(extractCSSVar(cssVar)),
            ]),
          )}
        />
      ))}
    </ColorPalette>
  );
}

function extractCSSVar(cssVar: string) {
  const match = cssVar.match(/var\((.*)\)/);
  return match ? match[1] : "";
}
