import { describe, expect, it } from "vitest";

import { getPageFragmentOptions, getTargetPageId } from "./fragment-options";

describe("target page relationships", () => {
  it.each([
    ["page-a", "page-a"],
    [{ id: "page-a" }, "page-a"],
    [{ relationTo: "pages", value: "page-a" }, "page-a"],
    [{ relationTo: "pages", value: { id: "page-a" } }, "page-a"],
    [12, "12"],
    [null, undefined],
    [undefined, undefined],
    ["", undefined],
    [{ relationTo: "media", value: "image-a" }, undefined],
    [{ value: "page-a" }, undefined],
  ])("resolves %j to %s", (relationship, expected) => {
    expect(getTargetPageId(relationship)).toBe(expected);
  });
});

describe("page anchor suggestions", () => {
  it("lists unique nonblank anchors in page order without traversing relationships", () => {
    expect(
      getPageFragmentOptions({
        hero: [{ elementId: "welcome" }],
        content: [
          { elementId: "rooms" },
          { elementId: "welcome" },
          { elementId: "" },
          { elementId: "   " },
          { elementId: null },
          {
            elementId: "original ID",
            link: { doc: { content: [{ elementId: "other-page" }] } },
          },
        ],
      }),
    ).toEqual([
      { label: "#welcome", value: "welcome" },
      { label: "#rooms", value: "rooms" },
      { label: "#original ID", value: "original ID" },
    ]);
  });

  it.each([null, {}, { content: null }, { hero: [], content: [null, {}] }])(
    "handles empty or incomplete page data: %j",
    (page) => expect(getPageFragmentOptions(page)).toEqual([]),
  );
});
