// _middleware.js — SHARED SECURITY MIDDLEWARE
// Import this from each API route to add auth + rate limiting + CORS.
//
// IMPORTANT: This file goes in /api/_middleware.js (the underscore prefix
// prevents Vercel from treating it as a route).
//
// Required Vercel environment variables:
//   API_SECRET       — random string your app sends in X-API-Secret header
//   ALLOWED_ORIGIN   — optional; defaults to allowing all (leave unset for Expo Go)
//
// If you want to lock ALLOWED_ORIGIN later, set it to your production app URL.

// ============================================================
// RATE LIMITING (in-memory, per IP)
// ============================================================
// Resets when Vercel cold-starts the serverless function (every ~15 min of idle).
// This is "good enough" for early-stage abuse prevention without needing Redis.
//
// Limits are intentionally generous for legit users but stop bots/scrapers cold.

const rateLimitStore = new Map();

// Clean up old entries every 5 minutes to prevent memory leak
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupOldEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, data] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - data.firstRequest > 60 * 60 * 1000) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check rate limit for a given key (usually IP).
 * @param {string} key - Identifier for the requester (IP address)
 * @param {number} maxRequests - Max requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean, remaining: number, resetMs: number }}
 */
function checkRateLimit(key, maxRequests, windowMs) {
  cleanupOldEntries();

  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || now - existing.firstRequest > windowMs) {
    // New window
    rateLimitStore.set(key, { firstRequest: now, count: 1 });
    return { allowed: true, remaining: maxRequests - 1, resetMs: windowMs };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: windowMs - (now - existing.firstRequest),
    };
  }

  existing.count++;
  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetMs: windowMs - (now - existing.firstRequest),
  };
}

// ============================================================
// MAIN MIDDLEWARE FUNCTION
// ============================================================

/**
 * Apply security checks to an API request.
 * Call this at the top of each API handler.
 *
 * Returns { ok: true } if request should proceed, or { ok: false, response: ... }
 * if it should be rejected (in which case the caller should return immediately).
 *
 * @param {object} req - Vercel request object
 * @param {object} res - Vercel response object
 * @param {object} options
 * @param {number} options.rateLimit - Max requests per IP per hour (default 30)
 * @param {number} options.rateLimitWindowMs - Rate limit window (default 1 hour)
 * @param {number} options.maxBodySize - Max body size in bytes (default 5MB)
 */
export function applySecurity(req, res, options = {}) {
  const {
    rateLimit = 30,
    rateLimitWindowMs = 60 * 60 * 1000, // 1 hour
    maxBodySize = 5 * 1024 * 1024, // 5 MB
  } = options;

  // ---------- CORS ----------
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Secret');
  res.setHeader('Access-Control-Max-Age', '86400');

  // ---------- Preflight (CORS OPTIONS) ----------
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return { ok: false, handled: true };
  }

  // ---------- Method check ----------
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return { ok: false, handled: true };
  }

  // ---------- API Secret Auth ----------
  // Only enforced if API_SECRET is set in Vercel env vars.
  // This lets you deploy the new code without breaking existing clients,
  // then flip it on by setting the env var.
  if (process.env.API_SECRET) {
    const providedSecret = req.headers['x-api-secret'];
    if (providedSecret !== process.env.API_SECRET) {
      res.status(401).json({ error: 'Unauthorized' });
      return { ok: false, handled: true };
    }
  }

  // ---------- Body size check ----------
  // Content-Length isn't always accurate but it's a fast first-line check.
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > maxBodySize) {
    res.status(413).json({ error: 'Request body too large' });
    return { ok: false, handled: true };
  }

  // ---------- Rate Limit ----------
  // Vercel forwards the real IP in x-forwarded-for. Fallback to connection IP.
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? forwarded.split(',')[0].trim() : '') ||
             req.headers['x-real-ip'] ||
             req.connection?.remoteAddress ||
             'unknown';

  const limit = checkRateLimit(ip, rateLimit, rateLimitWindowMs);
  res.setHeader('X-RateLimit-Limit', String(rateLimit));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(limit.resetMs / 1000)));

  if (!limit.allowed) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retryAfterSeconds: Math.ceil(limit.resetMs / 1000),
    });
    return { ok: false, handled: true };
  }

  return { ok: true };
}
