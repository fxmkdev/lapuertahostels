import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

type RedisState = {
  client?: RedisClient;
  connectPromise?: Promise<RedisClient>;
  signalHandlersRegistered?: boolean;
};

const REDIS_CONNECT_TIMEOUT_IN_MS = 5000;
const REDIS_RECONNECT_DELAY_CAP_IN_MS = 3000;
const TRANSIENT_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "ENETUNREACH",
  "ECONNABORTED",
]);
const TRANSIENT_ERROR_MESSAGES = [
  "Socket closed unexpectedly",
  "The client is closed",
  "connection timeout",
  "connect timeout",
  "offline",
];

const redisState = getRedisState();

export async function runRedisCommand<T>(
  command: (client: RedisClient) => Promise<T>,
) {
  try {
    return await command(await getRedisClient());
  } catch (error) {
    if (!isTransientRedisError(error)) throw error;

    console.warn(
      `Redis command failed with a transient error. Reconnecting and retrying once: ${formatRedisError(error)}`,
    );
    await resetRedisClient();

    return await command(await getRedisClient());
  }
}

export function isTransientRedisError(error: unknown) {
  const errorCode = getErrorCode(error);
  if (errorCode && TRANSIENT_ERROR_CODES.has(errorCode)) return true;

  const message = getErrorMessage(error);
  return TRANSIENT_ERROR_MESSAGES.some((transientMessage) =>
    message.toLowerCase().includes(transientMessage.toLowerCase()),
  );
}

export async function closeRedisClient() {
  const client = redisState.client;
  redisState.client = undefined;
  redisState.connectPromise = undefined;

  if (!client) return;

  if (client.isOpen) {
    await client.quit();
  } else {
    client.destroy();
  }
}

async function getRedisClient() {
  if (redisState.client?.isReady) {
    return redisState.client;
  }

  if (redisState.connectPromise) {
    return redisState.connectPromise;
  }

  if (redisState.client) {
    await resetRedisClient();
  }

  redisState.client = createRedisClient();
  redisState.connectPromise = redisState.client
    .connect()
    .then(() => {
      if (!redisState.client) {
        throw new Error("Redis client was reset while connecting");
      }

      return redisState.client;
    })
    .finally(() => {
      redisState.connectPromise = undefined;
    });

  return redisState.connectPromise;
}

function createRedisClient() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is not defined");

  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_IN_MS,
      reconnectStrategy: (retries) => {
        const jitter = Math.floor(Math.random() * 100);
        const delay = Math.min(
          Math.pow(2, retries) * 50,
          REDIS_RECONNECT_DELAY_CAP_IN_MS,
        );

        return delay + jitter;
      },
    },
  });

  client.on("error", (err) => console.error("Redis Client Error", err));
  client.on("reconnecting", () => console.warn("Redis client reconnecting"));
  client.on("ready", () => console.log("Redis client ready"));
  client.on("end", () => console.log("Redis client connection closed"));

  return client;
}

async function resetRedisClient() {
  const client = redisState.client;
  redisState.client = undefined;
  redisState.connectPromise = undefined;

  if (!client) return;

  try {
    client.destroy();
  } catch (error) {
    console.warn(
      `Failed to destroy stale Redis client: ${formatRedisError(error)}`,
    );
  }
}

function registerRedisSignalHandlers() {
  if (redisState.signalHandlersRegistered) return;

  redisState.signalHandlersRegistered = true;

  process.on("SIGINT", async () => {
    console.log("SIGINT received. Closing Redis connection...");
    try {
      await closeRedisClient();
    } finally {
      process.exit(0);
    }
  });

  process.on("SIGTERM", async () => {
    console.log("SIGTERM received. Closing Redis connection...");
    try {
      await closeRedisClient();
    } finally {
      process.exit(0);
    }
  });
}

function getRedisState() {
  globalThis.lapuertahostelsRedisState ??= {};
  return globalThis.lapuertahostelsRedisState;
}

function getErrorCode(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function formatRedisError(error: unknown) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error);

  return code ? `${code}: ${message}` : message;
}

declare global {
  var lapuertahostelsRedisState: RedisState | undefined;
}

registerRedisSignalHandlers();
