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
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_: string, options: { defaultValue: string }) => options.defaultValue,
  }),
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
  heading: "Visit our locations",
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

test("selecting pins and location tabs switches details and directions", async () => {
  render(<MapBlock {...props} />, { wrapper: Wrapper });
  await load();
  expect(screen.getAllByRole("button", { name: /^Pin / })).toHaveLength(2);
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Pin Azul" }));
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(screen.getByText("Azul details")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Directions to Azul" }),
  ).toHaveAttribute("href", place("Azul").url);
  fireEvent.click(screen.getByRole("tab", { name: "Aqua" }));
  expect(screen.getByRole("tab", { name: "Aqua" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
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
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
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
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(screen.queryByText("Aqua details")).not.toBeInTheDocument();
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
  fireEvent.click(screen.getByRole("tab", { name: "Azul" }));
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  rerender(<MapBlock {...props} locations={[location("Changed")]} />);
  unmount();
  await load();
  expect(resolvePlace).toHaveBeenCalledTimes(1);
});

test("incomplete live-preview rows do not hide completed locations", async () => {
  const incomplete = { id: "new-location" } as NonNullable<
    MapBlockProps["locations"]
  >[number];
  const { rerender } = render(
    <MapBlock {...props} locations={[aqua, incomplete]} />,
    { wrapper: Wrapper },
  );
  await load();
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(resolvePlace).toHaveBeenCalledTimes(1);
  rerender(
    <MapBlock
      {...props}
      locations={[aqua, { ...incomplete, address: "Azul address" }]}
    />,
  );
  await load();
  expect(
    screen.getByRole("button", { name: "Pin Azul address" }),
  ).toBeVisible();
});

test("names label tabs and pins independently from headings and stay in sync", async () => {
  const namedAqua = { ...aqua, name: "Aqua Hostel" };
  const namedAzul = { ...azul, name: "Azul Hostel" };
  render(<MapBlock {...props} locations={[namedAqua, namedAzul]} />, {
    wrapper: Wrapper,
  });
  await load();
  expect(screen.getByRole("tab", { name: "Aqua Hostel" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(screen.getByRole("tablist", { name: "Locations" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Pin Azul Hostel" }));
  expect(screen.getByRole("tab", { name: "Azul Hostel" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(
    screen.getByRole("link", { name: "Directions to Azul" }),
  ).toHaveAttribute("href", place("Azul").url);
  fireEvent.click(screen.getByRole("tab", { name: "Aqua Hostel" }));
  const panel = screen.getByRole("tabpanel");
  expect(panel).toHaveAttribute(
    "aria-labelledby",
    screen.getByRole("tab", { name: "Aqua Hostel" }).id,
  );
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
});

test.each([undefined, "", "   "])(
  "blank location name %s falls back to its heading",
  async (name) => {
    render(<MapBlock {...props} locations={[{ ...aqua, name }, azul]} />, {
      wrapper: Wrapper,
    });
    await load();
    expect(screen.getByRole("tab", { name: "Aqua" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Pin Aqua" })).toBeVisible();
  },
);

test("missing name and blank preview heading fall back to the address", async () => {
  render(
    <MapBlock
      {...props}
      locations={[
        {
          ...aqua,
          name: " ",
          overlayTextBox: { ...aqua.overlayTextBox, heading: " " },
        },
        azul,
      ]}
    />,
    { wrapper: Wrapper },
  );
  await load();
  expect(screen.getByRole("tab", { name: aqua.address })).toBeVisible();
  expect(
    screen.getByRole("button", { name: `Pin ${aqua.address}` }),
  ).toBeVisible();
});

test("editing a location name updates labels without another address lookup", async () => {
  const { rerender } = render(<MapBlock {...props} />, { wrapper: Wrapper });
  await load();
  rerender(
    <MapBlock
      {...props}
      locations={[{ ...aqua, name: "Renamed Aqua" }, azul]}
    />,
  );
  expect(screen.getByRole("tab", { name: "Renamed Aqua" })).toBeVisible();
  await load();
  expect(resolvePlace).toHaveBeenCalledTimes(2);
});

test("the shared heading stays above tabs and outside changing panels", async () => {
  render(<MapBlock {...props} />, { wrapper: Wrapper });
  await load();
  const heading = screen.getByRole("heading", { name: props.heading! });
  const tabs = screen.getByRole("tablist");
  expect(
    heading.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(screen.getByRole("tabpanel").querySelector("h3")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Pin Azul" }));
  expect(screen.getByRole("heading", { name: props.heading! })).toBe(heading);
  expect(screen.getByText("Azul details")).toBeVisible();
  expect(screen.getAllByRole("heading")).toHaveLength(1);
});

test.each([null, "", "   "])(
  "an explicitly cleared heading %s suppresses old headings",
  async (heading) => {
    render(<MapBlock {...props} heading={heading} />, { wrapper: Wrapper });
    await load();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(document.querySelector("h3")).toBeNull();
    expect(screen.getByRole("tab", { name: "Aqua" })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Azul" }));
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  },
);

test("new unnamed locations use their addresses, not the shared heading", async () => {
  const locations = [aqua, azul].map((entry) => ({
    address: entry.address,
    overlayTextBox: {
      text: entry.overlayTextBox.text,
      callToActionLabel: entry.overlayTextBox.callToActionLabel,
    },
  }));
  const { rerender } = render(
    <MapBlock {...props} heading={undefined} locations={locations} />,
    { wrapper: Wrapper },
  );
  await load();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: aqua.address })).toBeVisible();
  rerender(<MapBlock {...props} locations={locations} />);
  expect(screen.getByRole("heading", { name: props.heading! })).toBeVisible();
  expect(screen.getByRole("tab", { name: aqua.address })).toBeVisible();
});

test("cached location headings initialize one stable heading from the first configured location", async () => {
  resolvePlace.mockRejectedValueOnce(new Error("not found"));
  render(<MapBlock {...props} heading={undefined} />, { wrapper: Wrapper });
  await load();
  expect(screen.getByRole("heading", { name: "Aqua" })).toBeVisible();
  expect(screen.getByText("Azul details")).toBeVisible();
});
