import Redis from "ioredis";

// ─── Redis Client Singleton ───────────────────────────────────
let redisClient: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      // Fallback: koneksi lokal untuk development
      console.warn("⚠️  REDIS_URL tidak ditemukan, menggunakan localhost:6379");
      redisClient = new Redis({
        host: "127.0.0.1",
        port: 6379,
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 3,
      });
    } else {
      redisClient = new Redis(redisUrl, {
        lazyConnect: true,
        retryStrategy: (times) => Math.min(times * 100, 3000),
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        reconnectOnError: () => true,
      });
    }

    redisClient.on("connect", () => console.log("✅ Redis terhubung!"));
    redisClient.on("error", (err) => console.error("❌ Redis error:", err.message));
    redisClient.on("close", () => console.warn("⚠️  Redis koneksi tertutup"));
  }

  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    console.log("✅ Redis connection closed.");
  }
};

// ─── TTL Constants (seconds) ──────────────────────────────────
export const TTL = {
  RECONNECT_DATA: 90,       // Data reconnect player: 90 detik
  GAME_LOCK: 30,            // Lock endQuestion: 30 detik
  TIMER_STATE: 120,         // State timer soal: 2 menit
  SESSION_STATE: 3600,      // Cache state session: 1 jam
};

// ─── Key Helpers ──────────────────────────────────────────────
export const keys = {
  // Lock untuk mencegah double endQuestion
  questionLock: (token: string, qIdx: number) =>
    `qlock:${token}:${qIdx}`,

  // Data reconnect player (normal mode)
  playerReconnect: (token: string, username: string) =>
    `reconnect:${token}:${username.toLowerCase()}`,

  // Data reconnect player (duel mode)
  duelReconnect: (token: string, username: string) =>
    `duelrecon:${token}:${username.toLowerCase()}`,

  // State session untuk API /state
  sessionState: (token: string) =>
    `session-state:${token}`,

  // State duel room untuk API /state
  duelState: (token: string) =>
    `duel-state:${token}`,
};

// ─── Redis Helpers ────────────────────────────────────────────

/**
 * Set key hanya jika belum ada (distributed lock).
 * Return true jika berhasil lock, false jika sudah ada.
 */
export const acquireLock = async (
  key: string,
  ttlSeconds: number
): Promise<boolean> => {
  const redis = getRedis();
  const result = await redis.set(key, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
};

/**
 * Simpan data JSON dengan TTL
 */
export const setJSON = async (
  key: string,
  data: object,
  ttlSeconds: number
): Promise<void> => {
  const redis = getRedis();
  await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
};

/**
 * Ambil data JSON, return null jika tidak ada
 */
export const getJSON = async <T>(key: string): Promise<T | null> => {
  const redis = getRedis();
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Hapus key dari Redis
 */
export const delKey = async (key: string): Promise<void> => {
  const redis = getRedis();
  await redis.del(key);
};

/**
 * Perpanjang TTL key yang sudah ada
 */
export const refreshTTL = async (
  key: string,
  ttlSeconds: number
): Promise<void> => {
  const redis = getRedis();
  await redis.expire(key, ttlSeconds);
};
