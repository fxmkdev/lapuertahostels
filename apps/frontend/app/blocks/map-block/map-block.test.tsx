import { act, fireEvent, render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { richTextRoot, paragraph, text } from "@lapuertahostels/rich-text";
import { ThemeProvider } from "~/themes";
import { MapBlock } from "./map-block";
import type { MapBlockProps } from "./map-block";

const { resolvePlace, mapProps, placesLibrary } = vi.hoisted(() => ({
  resolvePlace: vi.fn(),
  mapProps: vi.fn(),
  placesLibrary: {},
}));
vi.mock("~/common/common", () => ({
  useSettings: () => ({ maps: { mapId: "test" } }),
}));
vi.mock("~/common/google-maps", () => ({
  PlaceResolver: class {
    resolvePlace = resolvePlace;
  },
}));
vi.mock("./map-viewport", () => ({ MapViewport: () => null }));
vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: () => placesLibrary,
  Map: ({ children, ...props }: PropsWithChildren) => {
    mapProps(props);
    return <div data-testid="map">{children}</div>;
  },
  AdvancedMarker: ({
    title,
    onClick,
  }: {
    title: string;
    onClick: () => void;
  }) => <button aria-label={`Pin ${title}`} onClick={onClick} />,
  Pin: () => null,
}));
function Wrapper({ children }: PropsWithChildren) {
  return (
    <ThemeProvider themeColor="puerta">
      <MemoryRouter>{children}</MemoryRouter>
    </ThemeProvider>
  );
}
const location = (heading: string) => ({
  address: `${heading} address`,
  overlayTextBox: {
    heading,
    text: richTextRoot(paragraph(text(`${heading} details`))),
    callToActionLabel: `Directions to ${heading}`,
  },
});
const aqua = location("Aqua");
const azul = location("Azul");
const props: MapBlockProps = {
  blockType: "Map",
  zoomLevel: 14.5,
  locations: [aqua, azul],
};
const place = (name: string) => ({
  url: `https://maps.example.com/${name}`,
  location: { lat: 11, lng: -74 },
});

beforeEach(() => {
  vi.useFakeTimers();
  resolvePlace
    .mockReset()
    .mockImplementation(async (query: string) => place(query.split(" ")[0]));
});
afterEach(() => vi.useRealTimers());
async function load() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_000);
  });
}

test("renders legacy single-location content with its zoom and directions", async () => {
  render(<MapBlock blockType="Map" zoomLevel={14.5} {...aqua} />, {
    wrapper: Wrapper,
  });
  await load();
  expect(screen.getByRole("heading", { name: "Aqua" })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Directions to Aqua" }),
  ).toHaveAttribute("href", place("Aqua").url);
  expect(mapProps).toHaveBeenLastCalledWith(
    expect.objectContaining({
      defaultZoom: 14.5,
      maxZoom: 14.5,
      gestureHandling: "none",
    }),
  );
});

test("selecting pins and location buttons switches details and directions", async () => {
  render(<MapBlock {...props} />, { wrapper: Wrapper });
  await load();
  expect(screen.getAllByRole("button", { name: /^Pin / })).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "Aqua" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Pin Azul" }));
  expect(screen.getByRole("heading", { name: "Azul" })).toBeVisible();
  expect(screen.getByText("Azul details")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Directions to Azul" }),
  ).toHaveAttribute("href", place("Azul").url);
  fireEvent.click(screen.getByRole("button", { name: "Aqua" }));
  expect(screen.getByRole("button", { name: "Aqua" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("heading", { name: "Aqua" })).toBeVisible();
});

test("new locations take precedence over legacy fields", async () => {
  render(<MapBlock {...props} {...location("Legacy")} />, { wrapper: Wrapper });
  await load();
  expect(resolvePlace).not.toHaveBeenCalledWith("Legacy address");
});

test("partial failures preserve the first successful location and all failures omit the block", async () => {
  resolvePlace.mockRejectedValueOnce(new Error("not found"));
  const { rerender, container } = render(<MapBlock {...props} />, {
    wrapper: Wrapper,
  });
  await load();
  expect(screen.getByRole("heading", { name: "Azul" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Pin / })).toHaveLength(1);
  resolvePlace.mockRejectedValue(new Error("not found"));
  rerender(<MapBlock {...props} locations={[location("Missing")]} />);
  await load();
  expect(container).toBeEmptyDOMElement();
});

test("late results cannot replace edited addresses and selection resets for new locations", async () => {
  let finish!: (value: ReturnType<typeof place>) => void;
  resolvePlace.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { rerender } = render(<MapBlock {...props} locations={[aqua]} />, {
    wrapper: Wrapper,
  });
  await load();
  rerender(<MapBlock {...props} locations={[azul]} />);
  await load();
  await act(async () => {
    finish(place("Aqua"));
  });
  expect(screen.getByRole("heading", { name: "Azul" })).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Aqua" }),
  ).not.toBeInTheDocument();
});

test("debounces edits, deduplicates lookups, and keeps coincident locations selectable", async () => {
  const { rerender, unmount } = render(<MapBlock {...props} />, {
    wrapper: Wrapper,
  });
  rerender(
    <MapBlock
      {...props}
      locations={[aqua, { ...azul, address: aqua.address }]}
    />,
  );
  await load();
  expect(resolvePlace).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Azul" }));
  expect(screen.getByRole("heading", { name: "Azul" })).toBeVisible();
  rerender(<MapBlock {...props} locations={[location("Changed")]} />);
  unmount();
  await load();
  expect(resolvePlace).toHaveBeenCalledTimes(1);
});
