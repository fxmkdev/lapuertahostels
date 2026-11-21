import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router";
import {
  customUrlLink,
  richTextRoot,
  text,
  type ExternalLinkOptions,
} from "@lapuertahostels/rich-text";
import { ThemeProvider } from "~/themes";
import { Link } from "./link";
import { PageLink } from "./page-link";
import { RichText } from "./rich-text";
import { LongFormRichText } from "./long-form-rich-text";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "es" } }),
}));

function renderLinks(options?: ExternalLinkOptions | null) {
  const node = customUrlLink("https://example.com", text("Rich link"));
  Object.assign(node.fields, options);
  render(
    <MemoryRouter>
      <ThemeProvider themeColor="puerta">
        <Link to="https://example.com" externalLinkOptions={options}>
          Direct
        </Link>
        <PageLink
          link={{ linkType: "custom", url: "https://example.com", ...options }}
        >
          Structured
        </PageLink>
        <div data-testid="plain">
          <RichText content={richTextRoot(node)} />
        </div>
        <div data-testid="long">
          <LongFormRichText content={richTextRoot(node)} baseHeadingLevel={2} />
        </div>
      </ThemeProvider>
    </MemoryRouter>,
  );
  return [
    screen.getByRole("link", { name: "Direct" }),
    screen.getByRole("link", { name: "Structured" }),
    screen.getByTestId("plain").querySelector("a")!,
    screen.getByTestId("long").querySelector("a")!,
  ];
}

function expectBehavior(
  link: Element,
  newTab: boolean,
  suppressReferrer: boolean,
  noFollow = false,
) {
  if (newTab) expect(link).toHaveAttribute("target", "_blank");
  else expect(link).not.toHaveAttribute("target");
  const rel = link.getAttribute("rel")?.split(" ");
  expect(rel).toContain("noopener");
  expect(rel?.includes("noreferrer")).toBe(suppressReferrer);
  expect(rel?.includes("nofollow")).toBe(noFollow);
  expect(link).not.toHaveAttribute("externalLinkOptions");
  expect(link).not.toHaveAttribute("openInNewTab");
  expect(link).not.toHaveAttribute("suppressReferrer");
  expect(link).not.toHaveAttribute("noFollow");
}

test.each([
  undefined,
  null,
  {},
  { openInNewTab: "default", suppressReferrer: "default" },
  { openInNewTab: null, suppressReferrer: null, noFollow: null },
] satisfies (ExternalLinkOptions | null | undefined)[])(
  "preserves each renderer's legacy defaults for %j",
  (options) => {
    renderLinks(options).forEach((link, index) =>
      expectBehavior(link, index !== 2, index !== 2),
    );
  },
);

describe.each([true, false])("nofollow=%s", (noFollow) => {
  test.each([
    ["yes", "yes"],
    ["yes", "no"],
    ["no", "yes"],
    ["no", "no"],
  ] as const)(
    "applies tab=%s and suppressReferrer=%s in all renderers",
    (openInNewTab, suppressReferrer) => {
      for (const link of renderLinks({
        openInNewTab,
        suppressReferrer,
        noFollow,
      })) {
        expectBehavior(
          link,
          openInNewTab === "yes",
          suppressReferrer === "yes",
          noFollow,
        );
      }
    },
  );
});

test.each([
  "/es/stay?guests=2#rooms",
  "#rooms",
  "mailto:hello@example.com",
  "tel:+12345",
  "about:blank",
])("ignores external settings for %s", (to) => {
  render(
    <MemoryRouter>
      <Link
        to={to}
        externalLinkOptions={{
          openInNewTab: "yes",
          suppressReferrer: "yes",
          noFollow: true,
        }}
      >
        Other
      </Link>
    </MemoryRouter>,
  );
  const link = screen.getByRole("link");
  expect(link).toHaveAttribute("href", to === "#rooms" ? "/#rooms" : to);
  expect(link).not.toHaveAttribute("target");
  expect(link).not.toHaveAttribute("rel");
});

test("nofollow alone preserves the renderer's other defaults", () => {
  renderLinks({ noFollow: true }).forEach((link, index) =>
    expectBehavior(link, index !== 2, index !== 2, true),
  );
});
