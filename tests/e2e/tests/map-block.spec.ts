import { expect, test } from "@playwright/test";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";
import { createPage } from "../common/cms";
import { mockGoogleMaps } from "../common/google-maps";

for (const width of [1280, 390]) {
  test(`map location selection and directions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockGoogleMaps(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const testPage = await createPage({
      content: [
        {
          blockType: "Map",
          elementId: "locations",
          zoomLevel: 14.5,
          locations: ["Aqua", "Azul"].map((name) => ({
            id: `location-${name}`,
            address: `${name} test address`,
            overlayTextBox: {
              heading: name,
              text: richTextRoot(paragraph(text(`${name} location details`))),
              callToActionLabel: `Directions to ${name}`,
            },
          })),
        },
      ],
    });
    await page.goto(`/en${testPage.pathname}`);
    const block = page.locator("#locations");
    await expect(
      block.getByRole("heading", { name: "Aqua", exact: true }),
    ).toBeVisible();
    await expect(block.getByTestId("google-map")).toHaveAttribute(
      "data-bounds",
      /11.24.*11.25/,
    );
    await block.getByRole("button", { name: "Pin Azul", exact: true }).click();
    await expect(
      block.getByRole("heading", { name: "Azul", exact: true }),
    ).toBeVisible();
    await expect(block.getByText("Azul location details")).toBeVisible();
    await expect(
      block.getByRole("link", { name: "Directions to Azul" }),
    ).toHaveAttribute("href", "https://maps.example.com/Azul%20test%20address");
    const aqua = block.getByRole("button", { name: "Aqua", exact: true });
    await aqua.focus();
    await page.keyboard.press("Enter");
    await expect(aqua).toHaveAttribute("aria-pressed", "true");
    await expect(
      block.getByRole("heading", { name: "Aqua", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("legacy CMS maps become editable locations and retain translations on save", async ({
  request,
}) => {
  const legacyBlock = {
    blockType: "Map",
    address: "Aqua test address",
    zoomLevel: 14.5,
    overlayTextBox: {
      heading: { en: "Aqua", es: "Visítanos" },
      text: richTextRoot(paragraph(text("Original location details"))),
      callToActionLabel: { en: "Directions", es: "Indicaciones" },
    },
  };
  const testPage = await createPage({
    // Seed the historical database shape, which predates required locations.
    content: [
      legacyBlock as unknown as import("@lapuertahostels/payload-types").Map,
    ],
  });
  const url = new URL(`/api/pages/${testPage.id}`, process.env.CMS_BASE_URL);
  const originalResponse = await request.get(`${url}?locale=en&depth=0`);
  expect(originalResponse.ok()).toBe(true);
  const original = await originalResponse.json();
  const map = original.content[0];
  expect(map.locations).toHaveLength(1);
  expect(map.locations[0].address).toBe(legacyBlock.address);
  const saved = await request.patch(`${url}?locale=en`, {
    data: {
      content: [
        {
          ...map,
          locations: [
            {
              ...map.locations[0],
              overlayTextBox: {
                ...map.locations[0].overlayTextBox,
                heading: "Updated Aqua",
              },
            },
            {
              address: "Azul test address",
              overlayTextBox: {
                heading: "Azul",
                text: richTextRoot(paragraph(text("Second location"))),
              },
            },
          ],
        },
      ],
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  const spanishResponse = await request.get(`${url}?locale=es&depth=0`);
  expect(spanishResponse.ok()).toBe(true);
  const spanish = await spanishResponse.json();
  expect(spanish.content[0].locations).toHaveLength(2);
  expect(spanish.content[0].locations[0].overlayTextBox.heading).toBe(
    "Visítanos",
  );
  expect(spanish.content[0].locations[0].overlayTextBox.callToActionLabel).toBe(
    "Indicaciones",
  );
});
