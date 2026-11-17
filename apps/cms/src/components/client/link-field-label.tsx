"use client";

import type {
  FieldLabelClientProps,
  GenericLabelProps,
  TextFieldClient,
} from "payload";

import { FieldLabel, useFieldPath, useTranslation } from "@payloadcms/ui";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

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
  const dismissedWithEscape = useRef(false);
  const isOpen = openedBy !== null;

  useLayoutEffect(() => {
    if (!isOpen) return;

    function dismissOutside(event: PointerEvent) {
      if (!helpRef.current?.contains(event.target as Node)) setOpenedBy(null);
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dismissedWithEscape.current = true;
        event.preventDefault();
        event.stopPropagation();
        setOpenedBy(null);
      }
    }

    document.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("keydown", dismissWithEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("keydown", dismissWithEscape, true);
    };
  }, [isOpen]);

  useEffect(() => {
    function consumeEscapeRelease(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissedWithEscape.current) {
        event.preventDefault();
        event.stopPropagation();
        dismissedWithEscape.current = false;
      }
    }
    // Capture before React's portal/editor shortcuts, including after help hides.
    window.addEventListener("keyup", consumeEscapeRelease, true);
    return () =>
      window.removeEventListener("keyup", consumeEscapeRelease, true);
  }, []);

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
          onBlur={() => {
            dismissedWithEscape.current = false;
            setOpenedBy(null);
          }}
          onClick={() =>
            setOpenedBy((current) => (current === "click" ? null : "click"))
          }
          onFocus={() =>
            setOpenedBy((current) => (current === "click" ? current : "focus"))
          }
          onKeyDown={(event) => {
            if (event.key === "Escape" && isOpen) {
              dismissedWithEscape.current = true;
              event.preventDefault();
              event.stopPropagation();
              setOpenedBy(null);
            }
          }}
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
  const path = useFieldPath() || props.path;
  return (
    <LinkFieldLabel
      {...props}
      path={path}
      htmlFor={
        props.htmlFor ??
        (path ? `field-${path.replace(/\./g, "__")}` : undefined)
      }
      label={props.label ?? field?.label}
      localized={props.localized ?? field?.localized}
      required={props.required ?? field?.required}
      helpLabel={t("cmsPlugin:fields:link:queryString:helpLabel")}
      helpText={t("cmsPlugin:fields:link:queryString:help")}
    />
  );
}
