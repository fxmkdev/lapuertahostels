import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { FlyMachines } from "./fly-machines.mjs";
import * as maintenance from "./snapshot-maintenance.mjs";
import { publish, cleanupPublisher } from "./snapshot-publisher.mjs";
export {
  allowedApp,
  isAppMachine,
  immutableImage,
} from "./snapshot-policy.mjs";
export class Fly extends FlyMachines {
  maintenanceApps() {
    return maintenance.maintenanceApps(this);
  }
  pin() {
    return maintenance.pin(this);
  }
  resume() {
    return maintenance.resume(this);
  }
  halt() {
    return maintenance.halt(this);
  }
  invalidate() {
    return maintenance.invalidate(this);
  }
  pause(bestEffort = false) {
    return maintenance.pause(this, bestEffort);
  }
  publish() {
    return publish(this);
  }
  cleanupPublisher() {
    return cleanupPublisher(this);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const fly = new Fly(process.env);
  const command =
    process.argv[2] === "cleanup-publisher"
      ? "cleanupPublisher"
      : process.argv[2];
  assert(
    [
      "publish",
      "cleanupPublisher",
      "pin",
      "pause",
      "resume",
      "halt",
      "invalidate",
    ].includes(command),
    "Unknown snapshot deployment command",
  );
  await fly[command]();
}
