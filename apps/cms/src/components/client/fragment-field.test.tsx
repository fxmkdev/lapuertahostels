import type { ComponentProps } from "react";
import type { TextFieldClientProps } from "payload";
import type { ReactSelect } from "@payloadcms/ui";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FragmentField } from "./fragment-field";

const form = vi.hoisted(() => ({
  fields: {} as Record<string, { value: unknown }>,
  locale: "en",
  value: "legacy-fragment",
  disabled: false,
  currentPath: undefined as string | undefined,
  setValue: vi.fn(),
}));

// Exercise form integration and async loading independently of Payload's providers.
vi.mock("@payloadcms/ui", () => ({
  useConfig: () => ({ config: { serverURL: "", routes: { api: "/cms-api" } } }),
  useLocale: () => ({ code: form.locale }),
  useTranslation: () => ({
    t: (key: string, options?: { fragment: string }) =>
      options ? `Use ${options.fragment}` : key.split(":").at(-1),
  }),
  useField: ({ potentiallyStalePath }: { potentiallyStalePath: string }) => ({
    path: form.currentPath ?? potentiallyStalePath,
    value: form.value,
    setValue: form.setValue,
    disabled: form.disabled,
  }),
  useFormFields: (selector: (state: unknown[]) => unknown) =>
    selector([form.fields]),
  FieldLabel: () => null,
  FieldError: () => null,
  FieldDescription: () => null,
  ReactSelect: ({
    options,
    value,
    onChange,
    onInputChange,
    disabled,
    isLoading,
  }: ComponentProps<typeof ReactSelect>) => {
    const selected = !Array.isArray(value) ? value : undefined;
    return (
      <>
        <input
          aria-label="Search anchors"
          disabled={disabled}
          onChange={(event) => onInputChange?.(event.target.value)}
        />
        <select
          aria-label="Fragment"
          disabled={disabled}
          value={String(selected?.value ?? "")}
          onChange={(event) =>
            onChange?.(
              event.target.value ? { value: event.target.value } : null!,
            )
          }
        >
          <option value="">No fragment</option>
          {selected && (
            <option value={String(selected.value)}>
              {String(selected.label)}
            </option>
          )}
          {options
            .filter((option) => "value" in option)
            .map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {String(option.label)}
              </option>
            ))}
        </select>
        {isLoading && <span>Loading anchors</span>}
      </>
    );
  },
}));

const props = {
  path: "content.2.callToAction.link.fragment",
  field: { name: "fragment", type: "text", label: "Fragment", admin: {} },
} as TextFieldClientProps;

function pageResponse(elementId: string) {
  return {
    ok: true,
    json: async () => ({ content: [{ elementId }] }),
  } as Response;
}

beforeEach(() => {
  form.fields = { "content.2.callToAction.link.doc": { value: "page-a" } };
  form.value = "legacy-fragment";
  form.locale = "en";
  form.disabled = false;
  form.currentPath = undefined;
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(pageResponse("rooms")));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("loads nested target-page anchors without changing an existing fragment", async () => {
  render(<FragmentField {...props} />);
  await screen.findByRole("option", { name: "#rooms" });
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  const request = new URL(String(url), "http://localhost");
  expect(request.pathname).toBe("/cms-api/pages/page-a");
  expect(Object.fromEntries(request.searchParams)).toEqual({
    depth: "0",
    locale: "en",
    "select[hero]": "true",
    "select[content]": "true",
  });
  expect(options?.credentials).toBe("include");
  expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
    "legacy-fragment",
  );
  expect(form.setValue).not.toHaveBeenCalled();
});

it("selects, creates and clears fragments only on explicit input", async () => {
  render(<FragmentField {...props} />);
  await screen.findByRole("option", { name: "#rooms" });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "rooms" },
  });
  expect(form.setValue).toHaveBeenLastCalledWith("rooms");
  fireEvent.change(screen.getByLabelText("Search anchors"), {
    target: { value: "custom-anchor" },
  });
  expect(
    screen.getByRole("option", { name: "Use custom-anchor" }),
  ).toBeTruthy();
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "custom-anchor" },
  });
  expect(form.setValue).toHaveBeenLastCalledWith("custom-anchor");
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
  expect(form.setValue).toHaveBeenLastCalledWith("");
});

it("supports root-level Lexical relationships and refreshes on locale changes", async () => {
  form.fields = {
    doc: { value: { relationTo: "pages", value: { id: "lexical-page" } } },
  };
  const { rerender } = render(<FragmentField {...props} path="fragment" />);
  await screen.findByRole("option", { name: "#rooms" });
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    "/pages/lexical-page?",
  );
  form.locale = "es";
  rerender(<FragmentField {...props} path="fragment" />);
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain("locale=es");
  expect(form.setValue).not.toHaveBeenCalled();
});

it("follows Payload's current field path after block reordering", async () => {
  form.currentPath = "content.0.callToAction.link.fragment";
  form.fields = { "content.0.callToAction.link.doc": { value: "moved-page" } };
  render(<FragmentField {...props} />);
  await screen.findByRole("option", { name: "#rooms" });
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain(
    "/pages/moved-page?",
  );
});

it("ignores stale responses after changing targets and retains the fragment", async () => {
  let resolveOld!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const { rerender } = render(<FragmentField {...props} />);
  const oldSignal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  form.fields["content.2.callToAction.link.doc"].value = "page-b";
  rerender(<FragmentField {...props} />);
  await screen.findByRole("option", { name: "#rooms" });
  await act(async () => resolveOld(pageResponse("stale-anchor")));
  expect(oldSignal?.aborted).toBe(true);
  expect(screen.queryByRole("option", { name: "#stale-anchor" })).toBeNull();
  expect(form.setValue).not.toHaveBeenCalled();
});

it.each([404, 403, 500])(
  "allows custom input after HTTP %s without losing the stored value",
  async (status) => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status } as Response);
    render(<FragmentField {...props} />);
    expect(await screen.findByRole("status")).toBeTruthy();
    expect(form.setValue).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Search anchors"), {
      target: { value: "fallback" },
    });
    expect(screen.getByRole("option", { name: "Use fallback" })).toBeTruthy();
  },
);

it("keeps manual entry available without a target page", () => {
  form.fields = {};
  render(<FragmentField {...props} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Search anchors"), {
    target: { value: "manual" },
  });
  expect(screen.getByRole("option", { name: "Use manual" })).toBeTruthy();
  expect(form.setValue).not.toHaveBeenCalled();
});

it.each(["readOnly", "disabled"])("respects %s", async (mode) => {
  form.disabled = mode === "disabled";
  render(<FragmentField {...props} readOnly={mode === "readOnly"} />);
  await screen.findByRole("option", { name: "#rooms" });
  expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(
    true,
  );
  expect(form.setValue).not.toHaveBeenCalled();
});
