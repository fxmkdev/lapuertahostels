import test, { expect } from "@playwright/test";
import { getOrCreateMedia, createPage } from "../common/cms";
import { paragraph, richTextRoot, text } from "@lapuertahostels/rich-text";

test("hero heading block", async ({ page }) => {
  const media = await getOrCreateMedia(
    "mesmerizing-scenery-seascape-with-lush-nature-daytime.jpg",
    "image/jpeg",
    "A serene beach",
  );

  const testPage = await createPage({
    hero: [
      {
        blockType: "HeroHeading",
        heading: "Hero Heading Test",
        image: media.id,
      },
    ],
  });

  await page.goto(testPage.pathname);

  await expect(
    page.getByRole("heading", { level: 2, name: "Hero Heading Test" }),
  ).toBeVisible();

  await expect(
    page
      .getByRole("img", { name: "A serene beach" })
      .and(page.getByTestId("full-image")),
  ).toHaveAttribute(
    "srcset",
    /mesmerizing-scenery-seascape-with-lush-nature-daytime\.jpg/,
  );
});

test("hero slides block", async ({ page }) => {
  const media1 = await getOrCreateMedia(
    "mesmerizing-scenery-seascape-with-lush-nature-daytime.jpg",
    "image/jpeg",
    "A serene beach",
  );

  const media2 = await getOrCreateMedia(
    "david-hertle-3YCkAhD--Ic-unsplash.jpg",
    "image/jpeg",
    "A sunny courtyard sourrounded by lush greenery",
  );

  const media3 = await getOrCreateMedia(
    "datingjungle-Vv4JB0SMfZ4-unsplash.jpg",
    "image/jpeg",
    "A lush green mountainious landscape",
  );

  const testPage = await createPage({
    hero: [
      {
        blockType: "HeroSlides",
        seoPageHeading: "Hero Slides Test",
        slides: [
          {
            image: media1.id,
            overlayTitle: {
              show: true,
              text: richTextRoot(paragraph(text("Slide 1 Text"))),
              position: "bottom-right",
            },
          },
          {
            image: media2.id,
            overlayTitle: {
              show: true,
              text: richTextRoot(paragraph(text("Slide 2 Text"))),
              position: "top-left",
            },
          },
          {
            image: media3.id,
          },
        ],
      },
    ],
  });

  await page.goto(testPage.pathname);

  await expect(
    page.getByRole("heading", { level: 2, name: "Hero Slides Test" }),
  ).toHaveClass("sr-only");

  await expect(
    page.getByRole("heading", { level: 3, name: "Slide 1 Text" }),
  ).toBeVisible();

  await expect(
    page
      .getByRole("img", { name: "A serene beach" })
      .and(page.getByTestId("full-image")),
  ).toHaveAttribute(
    "srcset",
    /mesmerizing-scenery-seascape-with-lush-nature-daytime\.jpg/,
  );

  await page.getByRole("button", { name: "Go to slide 2" }).click();

  await expect(
    page.getByRole("heading", { level: 3, name: "Slide 2 Text" }),
  ).toBeVisible();

  // Need to find out how we can wait for lazily loaded images in Playwright
  // await expect(
  //   page
  //     .getByRole("img", {
  //       // name: "A sunny courtyard sourrounded by lush greenery",
  //     })
  //     .and(page.getByTestId("full-image")),
  // ).toBeVisible();
});
