import assert from "node:assert/strict";
import { Fly } from "./content-snapshots.mjs";
export const env = {
  FLY_API_TOKEN: "test-token",
  FLY_ORG: "test-org",
  SNAPSHOT_ID: "snapshot-one",
  DEPLOYMENT_ENVIRONMENT: "preview",
  SNAPSHOT_PRODUCTION_APP: "production",
  SNAPSHOT_STAGING_APP: "staging",
  SNAPSHOT_PREVIEW_APP_PREFIX: "preview",
  CMS_APP: "preview-abc",
  FRONTEND_PREVIEW_APP_PREFIX: "web",
};
export function fixture() {
  const machines = new Map(
    [
      "preview-abc",
      "preview-def",
      "production",
      "staging",
      "web-abc",
      "web-def",
    ].map((app, index) => [
      app,
      [
        {
          id: `id-${index}`,
          name: `machine-${index}`,
          state: "started",
          config: {
            image: "image",
            env: {},
            metadata: { fly_process_group: "app" },
            services: [{ autostart: true }],
            restart: { policy: "on-failure" },
          },
        },
      ],
    ]),
  );
  const calls = [];
  const commands = [];
  const fly = new Fly(env, {
    wait: async () => {},
    run: (command, args) => {
      commands.push([command, args]);
      if (args[0] === "apps")
        return JSON.stringify([...machines.keys()].map((Name) => ({ Name })));
    },
    fetcher: async (url, options) => {
      assert.equal(options.headers.Authorization, "Bearer test-token");
      const [, app, , id, action] = new URL(url).pathname.slice(4).split("/");
      calls.push({
        app,
        id,
        action,
        method: options.method,
        body: options.body && JSON.parse(options.body),
      });
      const list = machines.get(app);
      let result = list;
      if (id) {
        const machine = list.find((machine) => machine.id === id);
        if (options.method === "POST") {
          if (action === "stop") machine.state = "stopped";
          else if (action === "start") machine.state = "started";
          else machine.config = JSON.parse(options.body).config;
        }
        result = machine;
      }
      return {
        ok: true,
        status: 200,
        json: async () => structuredClone(result),
      };
    },
  });
  return { fly, machines, calls, commands };
}
