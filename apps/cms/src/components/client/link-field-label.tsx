"use client";

import type {
  FieldLabelClientProps,
  GenericLabelProps,
  TextFieldClient,
} from "payload";

import { FieldLabel, useTranslation } from "@payloadcms/ui";
import { useEffect, useId, useRef, useState } from "react";

import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

import styles from "./link-field-label.module.css";

type LinkFieldLabelProps = GenericLabelProps & {
  helpLabel: string;
  helpText: string;
};

export function LinkFieldLabel({
  helpLabel,
  helpText,
  ...labelProps
}: LinkFieldLabelProps) {
  const [openedBy, setOpenedBy] = useState<"hover" | "focus" | "click" | null>(
    null,
  );
  const helpId = useId();
  const helpRef = useRef<HTMLSpanElement>(null);
  const isOpen = openedBy !== null;

  useEffect(() => {
    if (!isOpen) return;

    function dismissOutside(event: PointerEvent) {
      if (!helpRef.current?.contains(event.target as Node)) setOpenedBy(null);
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpenedBy(null);
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape, true);
    };
  }, [isOpen]);

  return (
    <div className={styles.labelRow}>
      <FieldLabel {...labelProps} />
      <span
        className={styles.help}
        onMouseEnter={() => setOpenedBy((current) => current ?? "hover")}
        onMouseLeave={() =>
          setOpenedBy((current) => (current === "hover" ? null : current))
        }
        ref={helpRef}
      >
        <button
          aria-describedby={isOpen ? helpId : undefined}
          aria-expanded={isOpen}
          aria-label={helpLabel}
          className={styles.helpButton}
          onBlur={() => setOpenedBy(null)}
          onClick={() =>
            setOpenedBy((current) => (current === "click" ? null : "click"))
          }
          onFocus={() =>
            setOpenedBy((current) => (current === "click" ? current : "focus"))
          }
          type="button"
        >
          <svg aria-hidden="true" fill="none" viewBox="0 0 20 20">
            <circle
              cx="10"
              cy="10"
              r="8"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10 9v5m0-8v.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>
        {isOpen && (
          <span className={styles.tooltip} id={helpId} role="tooltip">
            {helpText}
          </span>
        )}
      </span>
    </div>
  );
}

export function QueryStringLabel({
  field,
  ...props
}: FieldLabelClientProps<TextFieldClient>) {
  const { t } = useTranslation<TranslationsObject, TranslationsKey>();
  return (
    <LinkFieldLabel
      {...props}
      label={props.label ?? field?.label}
      localized={props.localized ?? field?.localized}
      required={props.required ?? field?.required}
      helpLabel={t("cmsPlugin:fields:link:queryString:helpLabel")}
      helpText={t("cmsPlugin:fields:link:queryString:help")}
    />
  );
}
