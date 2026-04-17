'use strict';

const DAILY_LIMIT = {
  default: 50,
  admin:   9999,
};

/**
 * Returns true if the request is within the user's daily limit.
 * Increments the counter atomically.
 */
const checkRateLimit = async (userId, userRole, pool) => {
  if (userRole === 'admin') return true;

  const today = new Date().toISOString().split('T')[0];
  const limit = DAILY_LIMIT.default;

  const result = await pool.query(
    `INSERT INTO chat_rate_limits (user_id, date, count)
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, date)
     DO UPDATE SET count = chat_rate_limits.count + 1
     RETURNING count`,
    [userId, today]
  );

  return result.rows[0].count <= limit;
};

// ---------------------------------------------------------------------------
// In-memory LRU cache for read-only lookup responses (5 min TTL, 200 entries)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX    = 200;

const lruCache = new Map();

const getCached = (key) => {
  const entry = lruCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    lruCache.delete(key);
    return null;
  }
  lruCache.delete(key);
  lruCache.set(key, entry);
  return entry.value;
};

const setCached = (key, value) => {
  if (lruCache.size >= CACHE_MAX) {
    lruCache.delete(lruCache.keys().next().value);
  }
  lruCache.set(key, { value, ts: Date.now() });
};

module.exports = { checkRateLimit, getCached, setCached };
