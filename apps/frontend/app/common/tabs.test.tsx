import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vitest";
import { ThemeProvider } from "~/themes";
import { Tabs } from "./tabs";

const items = [
  { id: "aqua", label: "Aqua", content: <p>Aqua details</p> },
  { id: "azul", label: "Azul", content: <p>Azul details</p> },
  { id: "puerta", label: "Puerta", content: <p>Puerta details</p> },
];
function Fixture() {
  const [selectedIndex, onChange] = useState(0);
  return (
    <ThemeProvider themeColor="aqua">
      <Tabs
        items={items}
        selectedIndex={selectedIndex}
        onChange={onChange}
        label="Locations"
      />
    </ThemeProvider>
  );
}

test("tabs associate the selected control with its visible panel", () => {
  render(<Fixture />);
  const aqua = screen.getByRole("tab", { name: "Aqua" });
  const panel = screen.getByRole("tabpanel");
  expect(aqua).toHaveAttribute("aria-selected", "true");
  expect(aqua).toHaveAttribute("aria-controls", panel.id);
  expect(panel).toHaveAttribute("aria-labelledby", aqua.id);
  expect(panel).toHaveTextContent("Aqua details");
  fireEvent.click(screen.getByRole("tab", { name: "Azul" }));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Azul details");
});

test("arrow keys wrap, Home and End select, and only the selected tab is in the tab sequence", async () => {
  render(<Fixture />);
  const aqua = screen.getByRole("tab", { name: "Aqua" });
  const azul = screen.getByRole("tab", { name: "Azul" });
  const puerta = screen.getByRole("tab", { name: "Puerta" });
  act(() => aqua.focus());
  fireEvent.keyDown(aqua, { key: "ArrowRight" });
  await waitFor(() => expect(azul).toHaveAttribute("aria-selected", "true"));
  expect(azul).toHaveFocus();
  expect(azul).toHaveAttribute("tabindex", "0");
  expect(aqua).toHaveAttribute("tabindex", "-1");
  expect(puerta).toHaveAttribute("tabindex", "-1");
  fireEvent.keyDown(azul, { key: "End" });
  await waitFor(() => expect(puerta).toHaveFocus());
  fireEvent.keyDown(puerta, { key: "ArrowRight" });
  await waitFor(() => expect(aqua).toHaveFocus());
  fireEvent.keyDown(aqua, { key: "ArrowLeft" });
  await waitFor(() => expect(puerta).toHaveFocus());
  fireEvent.keyDown(puerta, { key: "Home" });
  await waitFor(() => expect(aqua).toHaveAttribute("aria-selected", "true"));
});
