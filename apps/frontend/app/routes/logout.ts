import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { destroySession, getSession } from "~/sessions.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return {
      status: 405,
      statusText: "Method Not Allowed",
      headers: {
        Allow: "POST",
      },
    };
  }

  const session = await getSession(request.headers.get("Cookie"));

  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}
