import { createClient, type RedisClientType } from "redis";

function createRedisClient(): RedisClientType | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const parsed = new URL(url);
  const host = parsed.hostname;

  // Only enable TLS when explicitly specified via `rediss://` protocol.
  // This respects the user's Redis configuration instead of guessing based on hostname.
  const shouldUseTls = parsed.protocol === "rediss:";

  const client: RedisClientType = createClient({
    url,
    // RESP3 is supported by Redis Cloud; node-redis will negotiate. This is fine for RESP2 as well.
    socket: shouldUseTls
      ? {
          tls: true,
          servername: host,
        }
      : undefined,
  });

  client.on("error", (err) => {
    // Keep noisy connection errors out of request logs; callers should treat Redis as best-effort.
    console.warn("Redis client error:", err);
  });

  return client;
}

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: RedisClientType | null | undefined;
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (globalThis.__redisClient === undefined) {
    globalThis.__redisClient = createRedisClient();
  }

  const client = globalThis.__redisClient;
  if (!client) return null;

  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (err) {
      console.warn("Failed to connect to Redis:", err);
      return null;
    }
  }

  return client;
}

export function slotLockKey(doctorId: string, scheduledStartAtMs: number) {
  return `slotlock:${doctorId}:${scheduledStartAtMs}`;
}
