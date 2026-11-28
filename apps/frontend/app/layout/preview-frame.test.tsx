import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { PreviewFrame } from "./preview-frame";

test("keeps toolbar and scrollable content in separate rows and accounts for navigation height", () => {
  const subject = (height: number, scenario: string) => (
    <PreviewFrame
      toolbar={<label>Preview controls</label>}
      headerHeight={height}
      resetKey={scenario}
    >
      <main>Page content</main>
    </PreviewFrame>
  );
  const view = render(subject(80, "notFound"));
  const toolbar = screen.getByText("Preview controls").parentElement!;
  const content = screen.getByRole("main").parentElement!;
  expect(toolbar.parentElement).toBe(content.parentElement);
  expect(toolbar.nextElementSibling).toBe(content);
  expect(content).toHaveClass("overflow-y-auto");
  expect(content.style.scrollPaddingTop).toBe("112px");
  content.scrollTop = 500;
  view.rerender(subject(120, "serverError"));
  expect(content.scrollTop).toBe(0);
  expect(content.style.scrollPaddingTop).toBe("152px");
});
