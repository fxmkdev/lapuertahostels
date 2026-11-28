import assert from "node:assert/strict";
export const marker = "content_snapshot_maintenance";
export const required = (env, key) => {
  assert(env[key], `Missing ${key}`);
  return env[key];
};
export function allowedApp(app, env) {
  const production = required(env, "SNAPSHOT_PRODUCTION_APP");
  if (app === production) return false;
  if (env.DEPLOYMENT_ENVIRONMENT === "staging")
    return app === required(env, "SNAPSHOT_STAGING_APP");
  assert(
    env.DEPLOYMENT_ENVIRONMENT === "preview",
    "Invalid maintenance environment",
  );
  const prefix = `${required(env, "SNAPSHOT_PREVIEW_APP_PREFIX")}-`;
  return app.startsWith(prefix) && /^[a-f0-9]+$/.test(app.slice(prefix.length));
}
export function isReleaseMachine(machine) {
  return (
    machine.config?.env?.RELEASE_COMMAND === "1" ||
    machine.config?.metadata?.fly_process_group === "fly_app_release_command"
  );
}
export function isAppMachine(machine) {
  return (
    !isReleaseMachine(machine) &&
    (machine.config?.metadata?.fly_process_group === "app" ||
      machine.config?.services?.length > 0)
  );
}
export function immutableImage(machine) {
  const image = machine.image_ref;
  assert(
    image?.registry && image.repository && image.digest,
    "Deployed image has no immutable digest",
  );
  return `${image.registry}/${image.repository}@${image.digest}`;
}
export function quoteCommandArgument(value) {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}
