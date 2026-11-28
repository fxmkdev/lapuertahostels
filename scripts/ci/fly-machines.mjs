import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { required } from "./snapshot-policy.mjs";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export class FlyMachines {
  constructor(
    env,
    { fetcher = fetch, wait = sleep, run = execFileSync, now = Date.now } = {},
  ) {
    this.env = env;
    this.fetcher = fetcher;
    this.wait = wait;
    this.run = run;
    this.now = now;
  }
  async request(path, method = "GET", body) {
    const response = await this.fetcher(`https://api.machines.dev/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${required(this.env, "FLY_API_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Object.assign(
        new Error(`Fly Machines API ${method} failed (${response.status})`),
        { status: response.status },
      );
    return response.status === 204 ? undefined : response.json();
  }
  machines(app) {
    return this.request(`/apps/${app}/machines`);
  }
  machine(app, id) {
    return this.request(`/apps/${app}/machines/${id}`);
  }
  update(app, machine, config) {
    return this.request(`/apps/${app}/machines/${machine.id}`, "POST", {
      config,
      skip_launch: true,
    });
  }
  async stopped(app, id) {
    const deadline = this.now() + 180000;
    while (this.now() < deadline) {
      const machine = await this.machine(app, id);
      if (["stopped", "destroyed"].includes(machine.state)) return machine;
      await this.wait(2000);
    }
    throw new Error(`Timed out stopping ${app}/${id}`);
  }
  async stop(app, machine) {
    if (machine.state !== "stopped") {
      await this.transition(app, machine.id, "stop", {
        signal: "SIGTERM",
        timeout: "30s",
      });
      await this.stopped(app, machine.id);
    }
  }
  async transition(app, id, action, body = {}) {
    const deadline = this.now() + 180000;
    while (this.now() < deadline) {
      try {
        return await this.request(
          `/apps/${app}/machines/${id}/${action}`,
          "POST",
          body,
        );
      } catch (error) {
        // A config update is asynchronous. Fly returns 412 while the old
        // instance is being replaced, even when its visible state is stopped.
        if (![409, 412].includes(error.status)) throw error;
        await this.wait(2000);
      }
    }
    throw new Error(`Timed out waiting to ${action} ${app}/${id}`);
  }
  async start(app, id) {
    const machine = await this.machine(app, id);
    if (machine.state !== "started") await this.transition(app, id, "start");
    const deadline = this.now() + 180000;
    while (this.now() < deadline) {
      if ((await this.machine(app, id)).state === "started") return;
      await this.wait(2000);
    }
    throw new Error(`Timed out starting ${app}/${id}`);
  }
  apps() {
    return JSON.parse(
      this.run(
        "flyctl",
        ["apps", "list", "--org", required(this.env, "FLY_ORG"), "--json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
      ),
    ).map((app) => app.Name ?? app.ID);
  }
  async completed(app, id) {
    const deadline = this.now() + 30 * 60 * 1000;
    while (this.now() < deadline) {
      const machine = await this.machine(app, id);
      if (machine.state === "stopped") {
        const event = machine.events?.find((event) => event.type === "exit");
        assert(
          event?.request?.exit_event?.exit_code === 0,
          `Publisher failed; inspect Fly logs for ${app}/${id}`,
        );
        return;
      }
      assert(
        machine.state !== "destroyed",
        "Publisher disappeared before completion",
      );
      await this.wait(2000);
    }
    throw new Error("Snapshot publisher exceeded 30 minutes");
  }
}
