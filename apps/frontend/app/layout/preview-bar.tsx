import {
  ArrowRightStartOnRectangleIcon,
  WrenchIcon,
} from "@heroicons/react/16/solid";
import { Form } from "react-router";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "~/common/button";
import { cn } from "~/common/cn";
import { Link } from "~/common/link";
import { Paragraph } from "~/common/paragraph";
import { useEnvironment } from "~/common/environment";

export type PreviewBarProps = {
  className?: string;
  adminLocale: string;
};

export function PreviewBar({ className, adminLocale }: PreviewBarProps) {
  const { t } = useTranslation("admin", { lng: adminLocale });
  const { payloadCmsBaseUrl, version } = useEnvironment();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-4 border-t border-neutral-300 bg-neutral-800 px-4 py-4 max-md:flex-wrap sm:flex-row",
        className,
      )}
    >
      <Paragraph size="small" variant="white">
        <Trans i18nKey="previewBar.message" t={t} />
      </Paragraph>
      <div className="flex items-center gap-4 max-md:max-w-full max-md:flex-wrap max-md:justify-center">
        <Paragraph size="small" variant="white">
          {t("previewBar.versionInfo", { version })}
        </Paragraph>
        <Button
          size="small"
          as={Link}
          to={payloadCmsBaseUrl}
          variant="primary"
          icon={WrenchIcon}
        >
          {t("previewBar.manageContent")}
        </Button>
        <Form action="/logout" className="contents" method="POST">
          <Button
            type="submit"
            size="small"
            icon={ArrowRightStartOnRectangleIcon}
          >
            {t("previewBar.logOut")}
          </Button>
        </Form>
      </div>
    </div>
  );
}
