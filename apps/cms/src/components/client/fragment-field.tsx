"use client";

import type { TextFieldClientProps, Validate } from "payload";

import {
  FieldDescription,
  FieldError,
  FieldLabel,
  ReactSelect,
  useConfig,
  useField,
  useFormFields,
  useLocale,
  useTranslation,
} from "@payloadcms/ui";
import { useCallback, useEffect, useId, useState } from "react";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

import { getPageFragmentOptions, getTargetPageId } from "./fragment-options";

type FragmentResult = {
  url: string;
  options: ReturnType<typeof getPageFragmentOptions>;
  failed: boolean;
};

export function FragmentField({
  field,
  path: pathFromProps,
  readOnly,
  validate,
}: TextFieldClientProps) {
  const validateFragment: Validate = useCallback(
    (value, options) =>
      validate
        ? validate(value, {
            ...options,
            type: "text",
            name: field.name,
            required: field.required,
            minLength: field.minLength,
            maxLength: field.maxLength,
          })
        : true,
    [validate, field.name, field.required, field.minLength, field.maxLength],
  );
  const { disabled, path, setValue, showError, value } = useField<string>({
    potentiallyStalePath: pathFromProps,
    validate: validateFragment,
  });
  const docPath = `${path.slice(0, path.lastIndexOf(".") + 1)}doc`;
  const pageId = useFormFields(([fields]) =>
    getTargetPageId(fields[docPath]?.value),
  );
  const { config } = useConfig();
  const { code: locale } = useLocale();
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();
  const inputId = useId();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<FragmentResult>();

  const params = new URLSearchParams({
    depth: "0",
    "select[hero]": "true",
    "select[content]": "true",
    ...(locale ? { locale } : {}),
  });
  const url = pageId
    ? `${config.serverURL}${config.routes.api}/pages/${encodeURIComponent(pageId)}?${params}`
    : undefined;

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    async function loadOptions(requestUrl: string) {
      try {
        const response = await fetch(requestUrl, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Unable to load page anchors");
        const page: unknown = await response.json();
        if (!controller.signal.aborted) {
          setResult({
            url: requestUrl,
            options: getPageFragmentOptions(page),
            failed: false,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({ url: requestUrl, options: [], failed: true });
        }
      }
    }

    void loadOptions(url);
    return () => controller.abort();
  }, [url]);

  const currentResult = result?.url === url ? result : undefined;
  const options = currentResult?.options ?? [];
  // Payload's isCreatable adapter assumes array values. Offer a custom option
  // through the single-select so this field continues to store a plain string.
  const selectableOptions =
    input.trim() && !options.some((option) => option.value === input)
      ? [
          ...options,
          {
            label: t("cmsPlugin:fields:link:fragment:useCustom", {
              fragment: input,
            }),
            value: input,
          },
        ]
      : options;
  const isReadOnly = Boolean(readOnly || disabled);

  return (
    <div
      className={["field-type", "text", showError && "error"]
        .filter(Boolean)
        .join(" ")}
    >
      <FieldLabel
        htmlFor={inputId}
        label={field.label}
        localized={field.localized}
        path={path}
        required={field.required}
      />
      <FieldError path={path} showError={showError} />
      <ReactSelect
        disabled={isReadOnly}
        inputId={inputId}
        isClearable
        isLoading={Boolean(url && !currentResult)}
        isSearchable
        noOptionsMessage={() => t("cmsPlugin:fields:link:fragment:noAnchors")}
        onChange={(selected) => {
          if (!isReadOnly) {
            setValue(
              selected && !Array.isArray(selected) ? selected.value : "",
            );
          }
        }}
        onInputChange={setInput}
        options={selectableOptions}
        placeholder={t("cmsPlugin:fields:link:fragment:placeholder")}
        showError={showError}
        value={value ? { label: `#${value}`, value } : []}
      />
      <FieldDescription description={field.admin?.description} path={path} />
      {currentResult?.failed && (
        <p role="status">{t("cmsPlugin:fields:link:fragment:loadError")}</p>
      )}
    </div>
  );
}
