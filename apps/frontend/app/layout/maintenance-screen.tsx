import { useTranslation } from "react-i18next";
import { Button } from "~/common/button";
import { Heading } from "~/common/heading";
import { Link } from "~/common/link";
import type { Settings } from "@lapuertahostels/payload-types";

export type MaintenanceScreenProps = NonNullable<Settings["maintenanceScreen"]>;

export function MaintenanceScreen({ message }: MaintenanceScreenProps) {
  const { t } = useTranslation();
  return (
    <main className="relative flex h-screen flex-col items-center justify-center text-center text-neutral-700">
      <Heading variant="inherit" size="extra-large" as="h1">
        {message}
      </Heading>

      <p className="absolute inset-x-0 top-0 flex w-full justify-end px-4 py-4">
        <Button as={Link} to="/login" size="small" variant="secondary">
          {t("maintenanceScreen.login")}
        </Button>
      </p>
    </main>
  );
}
