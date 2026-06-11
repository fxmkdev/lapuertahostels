import type { I18nClient } from "@payloadcms/translations";
import type { UIFieldServerProps } from "payload";

import { FieldLabel, Link, Pill } from "@payloadcms/ui";

import type { UsagesConfig } from "../../fields/usages/types";
import type {
  TranslationsKey,
  TranslationsObject,
} from "../../translations/types";

import { findUsages } from "../../fields/usages/find-usages";
import { Label } from "../client/labels";
import styles from "./usages-field.module.css";

export async function UsagesField({
  clientField,
  config,
  data,
  i18n,
  path,
  payload,
  req,
}: {
  config: UsagesConfig;
  i18n: I18nClient<TranslationsObject, TranslationsKey>;
} & UIFieldServerProps) {
  if (req.locale === "all") {
    throw new Error("Locale cannot be 'all'");
  }

  const value = await findUsages(config, data.id, payload, req.locale);
  const { t } = i18n;
  return (
    <>
      <div className={styles.header}>
        <FieldLabel
          label={clientField.label}
          localized={clientField.localized}
          path={path}
        />

        <span className={styles.stat}>
          {t("cmsPlugin:usages:numberOfUsages", {
            count: value?.length ?? 0,
          })}
        </span>
      </div>
      <div
        className={["table", "table--appearance-condensed"]
          .filter(Boolean)
          .join(" ")}
      >
        <table cellPadding="0" cellSpacing="0">
          <thead>
            <tr>
              <th>{t("cmsPlugin:usages:type")}</th>
              <th>{t("cmsPlugin:usages:name")}</th>
              <th>{t("cmsPlugin:usages:fieldPath")}</th>
            </tr>
          </thead>
          <tbody>
            {value && value.length > 0 ? (
              value.map((usage, index) => (
                <tr key={index}>
                  <td>
                    <Pill>
                      {usage.type === "collection" ? (
                        <Label>{usage.label}</Label>
                      ) : (
                        t("cmsPlugin:usages:global")
                      )}
                    </Pill>
                  </td>
                  <td>
                    {usage.type === "collection" ? (
                      <Link
                        href={`/admin/collections/${usage.collection}/${usage.id}`}
                      >
                        {usage.title ?? usage.id}
                      </Link>
                    ) : (
                      <Link href={`/admin/globals/${usage.global}`}>
                        <Label>{usage.label}</Label>
                      </Link>
                    )}
                  </td>
                  <td>{usage.fieldPath}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className={styles.emptyStateCell} colSpan={3}>
                  {t("cmsPlugin:usages:noUsages")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
