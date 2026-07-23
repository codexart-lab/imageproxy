/**
 * Cloudflare Image Proxy - Main Entry Point
 * A production-ready image proxy with transformations, caching, and security
 */

import { router } from './router';

/**
 * Environment variables interface
 */
export interface Env {
  // Cloudflare bindings
  ASSETS?: Fetcher;
  RATE_LIMIT_KV?: KVNamespace;

  // Configuration variables
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
  MAX_URL_LENGTH?: string;
  REQUEST_TIMEOUT_MS?: string;

  // Optional: Allowed origins for CORS
  ALLOWED_ORIGINS?: string;
}

/**
 * Main Worker handler
 */
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    try {
      return await router(request, env, ctx);
    } catch (error) {
      console.error('Unhandled error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
          code: 'UNHANDLED_ERROR',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }
  },
};
