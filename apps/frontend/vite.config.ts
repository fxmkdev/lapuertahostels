import { reactRouter } from "@react-router/dev/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { reactRouterDevTools } from "react-router-devtools";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    ...(!isVitest() && !isStorybook()
      ? [reactRouterDevTools(), reactRouter()]
      : []),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts",
  },
});

function isStorybook() {
  return process.argv[1]?.includes("storybook");
}

function isVitest() {
  return !!process.env.VITEST;
}
