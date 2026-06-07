import type { Decorator, Preview } from "@storybook/react";
import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { createRoutesStub } from "react-router";
import "../app/global.css";
import i18n from "./i18next";
import { ThemeProvider } from "../app/themes";

import { allModes } from "./modes";
import { I18nextProvider } from "react-i18next";

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
      options: {
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
        <ThemeProvider themeColor={globals.brand}>
          <Story />
        </ThemeProvider>
      </I18nextProvider>
    ),
  ],
};

export default preview;
