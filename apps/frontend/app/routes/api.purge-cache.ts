import type { ActionFunctionArgs } from "react-router";
import { purgeCache } from "~/cms-data.server";
import { isAuthenticated } from "~/common/auth";

export async function action({ request }: ActionFunctionArgs) {
  if (!(await isAuthenticated(request))) {
    return new Response(null, { status: 401 });
  }

  console.log(`Purging cache`);
  await purgeCache();
  console.log(`Cache purged`);

  return new Response(null, { status: 204 });
}
