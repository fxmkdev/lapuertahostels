import type { Decorator, Preview } from "@storybook/react";
import { createRoutesStub } from "react-router";
import "../app/global.css";
import i18n from "./i18next";
import { ThemeProvider } from "../app/themes";

import { allModes } from "./modes";
import { I18nextProvider } from "react-i18next";

const MINIMAL_VIEWPORTS = {
  mobile1: {
    name: "Small mobile",
    styles: {
      width: "320px",
      height: "568px",
    },
    type: "mobile",
  },
  mobile2: {
    name: "Large mobile",
    styles: {
      width: "414px",
      height: "896px",
    },
    type: "mobile",
  },
  tablet: {
    name: "Tablet",
    styles: {
      width: "834px",
      height: "1112px",
    },
    type: "tablet",
  },
} as const;

const withReactRouter: Decorator = (Story) => {
  const ReactRouterStub = createRoutesStub([
    {
      path: "/*",
      Component: Story,
    },
  ]);

  return (
    <ReactRouterStub
      hydrationData={{
        loaderData: {
          root: {
            environment: {
              version: "0.0.0-storybook",
              // @ts-expect-error env exists
              imagekitBaseUrl: import.meta.env.STORYBOOK_IMAGEKIT_BASE_URL,
              payloadCmsBaseUrl: "http://wwww.example.com",
              useImageCacheBuster:
                // @ts-expect-error env exists
                import.meta.env.STORYBOOK_USE_IMAGE_CACHE_BUSTER === "true",
              // @ts-expect-error env exists
              googleMapsApiKey: import.meta.env.STORYBOOK_GOOGLE_MAPS_API_KEY,
            },
            settings: {
              maps: { mapId: "7686c4d7ba62c06", region: "CO" },
            },
          },
        },
      }}
    />
  );
};

const preview: Preview = {
  globalTypes: {
    brand: {
      defaultValue: "puerta",
      toolbar: {
        title: "Brand",
        icon: "verified",
        items: ["puerta", "aqua", "azul"],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    i18n,
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      viewports: {
        ...MINIMAL_VIEWPORTS,
        desktop: {
          name: "Desktop",
          styles: {
            width: "1280px",
            height: "800px",
          },
          type: "desktop",
        },
        "large-desktop": {
          name: "Large desktop",
          styles: {
            width: "1536px",
            height: "1000px",
          },
          type: "desktop",
        },
      },
    },
    chromatic: {
      diffThreshold: 0.8,
      modes: {
        "viewport-small-mobile": allModes["viewport-small-mobile"],
        "viewport-large-mobile": allModes["viewport-large-mobile"],
        "viewport-tablet": allModes["viewport-tablet"],
        "viewport-desktop": allModes["viewport-desktop"],
        "viewport-large-desktop": allModes["viewport-large-desktop"],
      },
    },
  },
  decorators: [
    withReactRouter,
    (Story, { globals, parameters }) => (
      <I18nextProvider i18n={parameters.i18n}>
        <ThemeProvider brandId={globals.brand}>
          <Story />
        </ThemeProvider>
      </I18nextProvider>
    ),
  ],
};

export default preview;
