// lib/rate-limit.js
// Fixed-window counters in Postgres. In-memory counters are useless on
// serverless hosting (every instance starts empty), so the count lives in the
// rate_limits table and one upsert both reads and increments it atomically.

async function allow(pool, key, max, windowMs) {
  try {
    const result = await pool.query(
      `INSERT INTO rate_limits (key, count, window_start) VALUES ($1, 1, NOW())
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2)
                      THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start < NOW() - make_interval(secs => $2)
                             THEN NOW() ELSE rate_limits.window_start END
       RETURNING count`,
      [key, windowMs / 1000]
    );

    // Occasionally clear out old rows so the table stays small.
    if (Math.random() < 0.02) {
      pool.query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'`).catch(() => {});
    }

    return result.rows[0].count <= max;
  } catch (err) {
    // Fail open: a database hiccup should not lock residents out.
    console.error('Rate limit check failed:', err.message);
    return true;
  }
}

/** Client IP. Vercel sets x-real-ip; locally fall back to the socket address. */
function clientIp(req) {
  return req.headers['x-real-ip'] || req.ip || 'unknown';
}

/** Express middleware: max requests per window per IP for this bucket. */
function limit(pool, bucket, max, windowMs, message) {
  return async (req, res, next) => {
    if (await allow(pool, `${bucket}:${clientIp(req)}`, max, windowMs)) {
      return next();
    }
    res.status(429).json({ error: message || 'Too many requests. Please try again later.' });
  };
}

module.exports = { allow, limit, clientIp };
