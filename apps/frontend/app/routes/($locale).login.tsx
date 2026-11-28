import type {
  MetaFunction,
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "react-router";
import { Form, useActionData, data, redirect } from "react-router";
import { useTranslation } from "react-i18next";
import { Button } from "~/common/button";
import { Input } from "~/common/input";
import { handleIncomingRequest } from "~/common/routing.server";
import { commitSession, getSession } from "~/sessions.server";

export const meta: MetaFunction<typeof loader> = ({ matches }) => {
  const parentMeta = matches.flatMap((match) => match.meta ?? []);
  return [...parentMeta, { name: "robots", content: "noindex, nofollow" }];
};

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return data(
      { message: "Method not allowed" },
      { status: 405, statusText: "Method Not Allowed" },
    );
  }

  const session = await getSession(request.headers.get("Cookie"));

  const form = await request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const result = await fetch(
    `${process.env.PAYLOAD_CMS_BASE_URL}/api/users/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email, password }),
    },
  );

  if (!result.ok) {
    const errorDetails = await result.json();

    return data(
      {
        errorMessage: errorDetails.errors
          .map((e: { message: string }) => e.message)
          .join("; ") as string,
        values: { email },
      },
      {
        status: 401,
        statusText: "Unauthorized",
      },
    );
  }

  session.set("userId", (await result.json()).user.id);

  return redirect("/", {
    headers: {
      "Set-Cookie": await commitSession(session),
    },
  });
}

export async function loader({ request, url }: LoaderFunctionArgs) {
  await handleIncomingRequest(request, url);

  const session = await getSession(request.headers.get("Cookie"));
  if (session.has("userId")) {
    throw redirect("/");
  }

  return null;
}

export default function Route() {
  const { t } = useTranslation();
  // This seems to return incorrect types
  // const actionData = useActionData<typeof action}>();
  const actionData = useActionData<{
    errorMessage: string;
    values: { email: string };
  }>();
  return (
    <Form
      method="POST"
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
