import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router";
import type { Page } from "@lapuertahostels/payload-types";
import { internalLink, richTextRoot, text } from "@lapuertahostels/rich-text";

import { getPageLinkHref, PageLink } from "./page-link";
import { RichText } from "./rich-text";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "es" } }),
}));

describe("internal fragment links", () => {
  test.each([
    ["", "rooms", undefined, "/stay#rooms"],
    ["es", "rooms", "guests=2", "/es/stay?guests=2#rooms"],
    [
      "en",
      "legacy-anchor",
      "source=menu",
      "/en/stay?source=menu#legacy-anchor",
    ],
    ["es", "", "guests=2", "/es/stay?guests=2"],
  ])(
    "preserves URL construction for %s / %s",
    (locale, fragment, queryString, expected) => {
      expect(
        getPageLinkHref(
          {
            linkType: "internal",
            doc: { pathname: "/stay" } as Page,
            fragment,
            queryString,
          },
          locale,
        ),
      ).toBe(expected);
    },
  );

  test.each(["rooms", "legacy-anchor"])(
    "renders structured and rich-text links with the same saved fragment: %s",
    (fragment) => {
      const node = internalLink("/stay", text("Rich text link"));
      if (node.fields.linkType !== "internal")
        throw new Error("Expected internal link");
      node.fields.fragment = fragment;
      node.fields.queryString = "guests=2";

      render(
        <MemoryRouter>
          <PageLink
            link={{
              linkType: "internal",
              doc: { pathname: "/stay" } as Page,
              fragment,
              queryString: "guests=2",
            }}
          >
            Structured link
          </PageLink>
          <RichText content={richTextRoot(node)} />
        </MemoryRouter>,
      );

      for (const name of ["Structured link", "Rich text link"]) {
        expect(screen.getByRole("link", { name })).toHaveAttribute(
          "href",
          `/es/stay?guests=2#${fragment}`,
        );
      }
    },
  );
});
