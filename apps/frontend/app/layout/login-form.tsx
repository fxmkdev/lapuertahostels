import { Form } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/common/button";
import { Input } from "~/common/input";

export function LoginForm({
  actionData,
  preview = false,
}: {
  actionData?: { errorMessage: string; values: { email: string } };
  preview?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Form
      method="POST"
      onSubmit={preview ? (event) => event.preventDefault() : undefined}
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-8"
    >
      <Input
        placeholder={t("login.email")}
        type="email"
        name="email"
        defaultValue={actionData?.values.email}
      />
      <Input
        placeholder={t("login.password")}
        type="password"
        name="password"
      />
      {actionData && (
        <p className="text-accent-negative-800 text-sm">
          {actionData.errorMessage}
        </p>
      )}
      <Button type="submit" size="small" variant="primary">
        {t("login.submit")}
      </Button>
    </Form>
  );
}
