import type { GenericLabelProps } from "payload";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { LinkFieldLabel, QueryStringLabel } from "./link-field-label";

vi.mock("@payloadcms/ui", () => ({
  FieldLabel: ({ label, htmlFor }: GenericLabelProps) => (
    <label htmlFor={htmlFor}>{String(label)}</label>
  ),
  useTranslation: () => ({ t: (key: string) => key.split(":").at(-1) }),
}));

afterEach(cleanup);

it("uses the label from Payload's client field config", () => {
  render(
    <QueryStringLabel
      field={{ name: "queryString", type: "text", label: "Query string" }}
      path="link.queryString"
    />,
  );
  expect(screen.getByText("Query string")).toBeTruthy();
});

function renderLabel() {
  const submit = vi.fn((event) => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <LinkFieldLabel
        label="Anchor"
        htmlFor="anchor"
        helpLabel="About anchors"
        helpText="Choose an Element ID from the saved target page."
      />
      <input id="anchor" />
    </form>,
  );
  return {
    button: screen.getByRole("button", { name: "About anchors" }),
    submit,
  };
}

it("shows help on hover and closes when the pointer leaves", () => {
  const { button } = renderLabel();
  expect(screen.queryByRole("tooltip")).toBeNull();
  fireEvent.mouseEnter(button);
  expect(screen.getByRole("tooltip").textContent).toContain(
    "saved target page",
  );
  fireEvent.mouseLeave(button);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

it("connects keyboard help to its button and dismisses Escape without losing focus", () => {
  const { button } = renderLabel();
  act(() => button.focus());
  expect(button.getAttribute("aria-describedby")).toBe(
    screen.getByRole("tooltip").id,
  );
  expect(button.getAttribute("aria-expanded")).toBe("true");
  fireEvent.keyDown(button, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(button.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(button);
});

it("opens on the first tap, toggles on the second, and never submits the form", () => {
  const { button, submit } = renderLabel();
  fireEvent.pointerDown(button);
  act(() => button.focus());
  fireEvent.click(button);
  expect(screen.getByRole("tooltip")).toBeTruthy();
  fireEvent.click(button);
  expect(screen.queryByRole("tooltip")).toBeNull();
  expect(submit).not.toHaveBeenCalled();
});

it("dismisses help on outside taps and when focus moves away", () => {
  const { button } = renderLabel();
  fireEvent.click(button);
  fireEvent.pointerDown(screen.getByRole("textbox"));
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => button.focus());
  expect(screen.getByRole("tooltip")).toBeTruthy();
  act(() => screen.getByRole("textbox").focus());
  expect(screen.queryByRole("tooltip")).toBeNull();
});
