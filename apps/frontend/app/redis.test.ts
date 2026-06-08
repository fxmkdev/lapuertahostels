import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { closeRedisClient, runRedisCommand } from "./redis";

const createClient = vi.hoisted(() => vi.fn());

vi.mock("redis", () => ({
  createClient,
}));

type MockRedisClient = {
  isOpen: boolean;
  isReady: boolean;
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
};

beforeEach(async () => {
  await closeRedisClient();
  createClient.mockReset();
  vi.stubEnv("REDIS_URL", "redis://localhost:6379");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runRedisCommand", () => {
  test("connects lazily and shares the same connect promise for concurrent commands", async () => {
    const client = createMockRedisClient();
    createClient.mockReturnValue(client);

    const results = await Promise.all([
      runRedisCommand(async (redis) => redis),
      runRedisCommand(async (redis) => redis),
    ]);

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({
          connectTimeout: 5000,
          reconnectStrategy: expect.any(Function),
        }),
        url: "redis://localhost:6379",
      }),
    );
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(results).toEqual([client, client]);
  });

  test("reconnects and retries once after ECONNRESET", async () => {
    const firstClient = createMockRedisClient();
    const secondClient = createMockRedisClient();
    createClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const command = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
      )
      .mockResolvedValueOnce("ok");

    await expect(runRedisCommand(command)).resolves.toBe("ok");

    expect(command).toHaveBeenCalledTimes(2);
    expect(command).toHaveBeenNthCalledWith(1, firstClient);
    expect(command).toHaveBeenNthCalledWith(2, secondClient);
    expect(firstClient.destroy).toHaveBeenCalledTimes(1);
    expect(secondClient.destroy).not.toHaveBeenCalled();
  });

  test("does not retry non-transient command errors", async () => {
    const client = createMockRedisClient();
    createClient.mockReturnValue(client);
    const error = new Error("WRONGTYPE Operation against a key");
    const command = vi.fn().mockRejectedValue(error);

    await expect(runRedisCommand(command)).rejects.toThrow(error);

    expect(command).toHaveBeenCalledTimes(1);
    expect(client.destroy).not.toHaveBeenCalled();
  });

  test("surfaces repeated transient failures after one retry", async () => {
    const firstClient = createMockRedisClient();
    const secondClient = createMockRedisClient();
    createClient
      .mockReturnValueOnce(firstClient)
      .mockReturnValueOnce(secondClient);
    const error = Object.assign(new Error("Socket closed unexpectedly"), {
      code: "ECONNRESET",
    });
    const command = vi.fn().mockRejectedValue(error);

    await expect(runRedisCommand(command)).rejects.toThrow(error);

    expect(command).toHaveBeenCalledTimes(2);
    expect(firstClient.destroy).toHaveBeenCalledTimes(1);
    expect(secondClient.destroy).not.toHaveBeenCalled();
  });
});

function createMockRedisClient(): MockRedisClient {
  const client: MockRedisClient = {
    isOpen: false,
    isReady: false,
    connect: vi.fn(),
    destroy: vi.fn(),
    quit: vi.fn(),
    on: vi.fn(),
  };

  client.connect.mockImplementation(async () => {
    client.isOpen = true;
    client.isReady = true;
    return client;
  });

  return client;
}
