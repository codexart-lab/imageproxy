/**
 * Rate limiting for Cloudflare Image Proxy
 * Simple IP-based rate limiting using KV store or in-memory Map
 */

import type { RateLimitEntry } from './types';
import { createErrorResponse } from './utils';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000, // 1 minute
};

/**
 * In-memory rate limit storage (for development)
 * In production, use Cloudflare KV for distributed rate limiting
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Gets client IP from request
 */
function getClientIP(request: Request): string {
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  const trueClientIP = request.headers.get('True-Client-IP');

  return cfConnectingIP || xForwardedFor?.split(',')[0].trim() || trueClientIP || 'unknown';
}

/**
 * Checks rate limit for a client
 */
export async function checkRateLimit(
  request: Request,
  env: Env,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const clientIP = getClientIP(request);
  const now = Date.now();

  // Try to use KV store if available
  if (env.RATE_LIMIT_KV) {
    return checkRateLimitKV(clientIP, env.RATE_LIMIT_KV, config, now);
  }

  // Fallback to in-memory store
  return checkRateLimitMemory(clientIP, config, now);
}

/**
 * Checks rate limit using KV store
 */
async function checkRateLimitKV(
  clientIP: string,
  kv: KVNamespace,
  config: RateLimitConfig,
  now: number
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const key = `rate:${clientIP}`;
  const data = await kv.get<RateLimitEntry>(key, 'json');

  if (!data) {
    // First request
    await kv.put(key, JSON.stringify({ count: 1, firstRequest: now }), {
      expirationTtl: Math.ceil(config.windowMs / 1000),
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if window has expired
  if (now - data.firstRequest >= config.windowMs) {
    // Reset window
    await kv.put(key, JSON.stringify({ count: 1, firstRequest: now }), {
      expirationTtl: Math.ceil(config.windowMs / 1000),
    });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (data.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: data.firstRequest + config.windowMs,
    };
  }

  // Increment count
  await kv.put(
    key,
    JSON.stringify({
      count: data.count + 1,
      firstRequest: data.firstRequest,
    }),
    {
      expirationTtl: Math.ceil(config.windowMs / 1000),
    }
  );

  return {
    allowed: true,
    remaining: config.maxRequests - data.count - 1,
    resetTime: data.firstRequest + config.windowMs,
  };
}

/**
 * Checks rate limit using in-memory store
 */
function checkRateLimitMemory(
  clientIP: string,
  config: RateLimitConfig,
  now: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const entry = rateLimitStore.get(clientIP);

  if (!entry) {
    // First request
    rateLimitStore.set(clientIP, { count: 1, firstRequest: now });

    // Clean up old entries periodically
    if (rateLimitStore.size > 10000) {
      cleanupOldEntries(now, config.windowMs);
    }

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if window has expired
  if (now - entry.firstRequest >= config.windowMs) {
    rateLimitStore.set(clientIP, { count: 1, firstRequest: now });

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.firstRequest + config.windowMs,
    };
  }

  // Increment count
  rateLimitStore.set(clientIP, {
    count: entry.count + 1,
    firstRequest: entry.firstRequest,
  });

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count - 1,
    resetTime: entry.firstRequest + config.windowMs,
  };
}

/**
 * Cleans up old entries from in-memory store
 */
function cleanupOldEntries(now: number, windowMs: number): void {
  for (const [key, value] of rateLimitStore.entries()) {
    if (now - value.firstRequest >= windowMs) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Creates rate limit exceeded response
 */
export function createRateLimitResponse(resetTime: number): Response {
  const resetSeconds = Math.ceil((resetTime - Date.now()) / 1000);

  return createErrorResponse(
    'Rate limit exceeded. Too many requests.',
    429,
    'RATE_LIMIT_EXCEEDED',
    {
      retryAfter: resetSeconds,
    }
  );
}

/**
 * Adds rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  remaining: number,
  resetTime: number,
  limit: number
): Response {
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
