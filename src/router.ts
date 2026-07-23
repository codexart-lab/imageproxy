/**
 * Router for Cloudflare Image Proxy
 * Handles request routing and endpoint handling
 */

import type { RequestContext, ImageTransformParams, HttpMethod } from './types';
import { proxyImage, directProxy } from './proxy';
import { checkRateLimit, createRateLimitResponse, addRateLimitHeaders } from './rateLimit';
import { createErrorResponse, createSuccessResponse, createCORSHeaders } from './utils';
import { createSecurityHeaders, validateOrigin } from './security';

/**
 * Parses image transformation parameters from URL
 */
function parseTransformParams(url: URL): ImageTransformParams {
  const params = url.searchParams;

  return {
    url: params.get('url') || '',
    width: parseQueryParamNumber(params, 'w', 1, 10000),
    height: parseQueryParamNumber(params, 'h', 1, 10000),
    quality: parseQueryParamNumber(params, 'q', 1, 100),
    format: parseImageFormat(params.get('format')),
    fit: parseFitParameter(params.get('fit')),
    gravity: parseGravityParameter(params.get('gravity')),
    blur: parseQueryParamNumber(params, 'blur', 0, 100),
    brightness: parseQueryParamNumber(params, 'brightness', -100, 100),
    contrast: parseQueryParamNumber(params, 'contrast', -100, 100),
    gamma: parseFloat(params.get('gamma') || ''),
    rotate: parseRotationParameter(params.get('rotate')),
    sharpen: parseQueryParamNumber(params, 'sharpen', 0, 100),
    background: params.get('background') || undefined,
    dpr: parseFloat(params.get('dpr') || ''),
    anim: params.get('anim') === 'true',
  };
}

/**
 * Helper function to parse number from query params
 */
function parseQueryParamNumber(
  params: URLSearchParams,
  key: string,
  min?: number,
  max?: number
): number | undefined {
  const value = params.get(key);
  if (!value) return undefined;

  const num = parseInt(value, 10);
  if (isNaN(num)) return undefined;

  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;

  return num;
}

/**
 * Helper function to parse image format
 */
function parseImageFormat(format?: string): 'avif' | 'webp' | 'jpeg' | 'png' | undefined {
  if (!format) return undefined;
  const validFormats = ['avif', 'webp', 'jpeg', 'png', 'jpg'];
  const normalized = format.toLowerCase();
  if (validFormats.includes(normalized)) {
    return normalized === 'jpg' ? 'jpeg' : (normalized as 'avif' | 'webp' | 'jpeg' | 'png');
  }
  return undefined;
}

/**
 * Helper function to parse fit parameter
 */
function parseFitParameter(fit?: string): ImageTransformParams['fit'] {
  const validFits = ['scale-down', 'contain', 'cover', 'crop', 'pad'];
  if (fit && validFits.includes(fit)) {
    return fit as ImageTransformParams['fit'];
  }
  return undefined;
}

/**
 * Helper function to parse gravity parameter
 */
function parseGravityParameter(gravity?: string): ImageTransformParams['gravity'] {
  const validGravities = ['center', 'left', 'right', 'top', 'bottom', 'auto'];
  if (gravity && validGravities.includes(gravity)) {
    return gravity as ImageTransformParams['gravity'];
  }
  return undefined;
}

/**
 * Helper function to parse rotation parameter
 */
function parseRotationParameter(rotate?: string): ImageTransformParams['rotate'] {
  if (!rotate) return undefined;
  const validRotations = [0, 90, 180, 270];
  const num = parseInt(rotate, 10);
  if (validRotations.includes(num)) {
    return num as ImageTransformParams['rotate'];
  }
  return undefined;
}

/**
 * Handles proxy endpoint
 */
async function handleProxy(context: RequestContext): Promise<Response> {
  const { request, env, ctx, url } = context;

  // Check rate limit
  const rateLimit = await checkRateLimit(request, env);
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetTime);
  }

  // Parse transformation parameters
  const params = parseTransformParams(url);

  // Validate URL parameter
  if (!params.url) {
    const response = createErrorResponse('URL parameter is required', 400, 'MISSING_URL');
    return addRateLimitHeaders(
      response,
      rateLimit.remaining,
      rateLimit.resetTime,
      parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
    );
  }

  // Check if transformations are requested
  const hasTransformations =
    params.width !== undefined ||
    params.height !== undefined ||
    params.quality !== undefined ||
    params.format !== undefined;

  let result;

  if (hasTransformations) {
    // Use Cloudflare Image Resizing
    result = await proxyImage(request, params, env, ctx);
  } else {
    // Direct proxy without transformations
    result = await directProxy(params.url, request, env, ctx);
  }

  // Add rate limit headers
  const responseWithHeaders = addRateLimitHeaders(
    result.response,
    rateLimit.remaining,
    rateLimit.resetTime,
    parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  );

  // Add cache status header
  const headers = new Headers(responseWithHeaders.headers);
  headers.set('X-Cache-Status', result.cached ? 'HIT' : 'MISS');
  headers.set('X-Transform-Applied', result.transformApplied ? 'true' : 'false');

  return new Response(responseWithHeaders.body, {
    status: responseWithHeaders.status,
    statusText: responseWithHeaders.statusText,
    headers,
  });
}

/**
 * Handles health check endpoint
 */
async function handleHealthCheck(): Promise<Response> {
  return createSuccessResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
}

/**
 * Handles API info endpoint
 */
async function handleAPIInfo(): Promise<Response> {
  return createSuccessResponse({
    name: 'Cloudflare Image Proxy',
    version: '1.0.0',
    endpoints: {
      proxy: '/?url=<image_url>&w=<width>&h=<height>&q=<quality>&format=<format>',
      health: '/health',
      info: '/api/info',
    },
    parameters: {
      url: 'Source image URL (required)',
      w: 'Width in pixels (1-10000)',
      h: 'Height in pixels (1-10000)',
      q: 'Quality (1-100)',
      format: 'Output format (avif, webp, jpeg, png)',
      fit: 'Fit mode (scale-down, contain, cover, crop, pad)',
      gravity: 'Gravity (center, left, right, top, bottom, auto)',
      blur: 'Blur amount (0-100)',
      brightness: 'Brightness adjustment (-100 to 100)',
      contrast: 'Contrast adjustment (-100 to 100)',
      gamma: 'Gamma correction (0.01-10)',
      rotate: 'Rotation (0, 90, 180, 270)',
      sharpen: 'Sharpen amount (0-100)',
      background: 'Background color (hex)',
      dpr: 'Device pixel ratio (1-3)',
    },
  });
}

/**
 * Main router function
 */
export async function router(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const startTime = Date.now();

  const context: RequestContext = {
    request,
    env,
    ctx,
    url,
    startTime,
  };

  try {
    // Add security headers
    const securityHeaders = createSecurityHeaders();

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const corsHeaders = createCORSHeaders();
      return new Response(null, {
        status: 204,
        headers: { ...Object.fromEntries(corsHeaders), ...Object.fromEntries(securityHeaders) },
      });
    }

    // Only allow GET method
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(securityHeaders),
        },
      });
    }

    let response: Response;

    // Route handling
    if (url.pathname === '/health') {
      response = await handleHealthCheck();
    } else if (url.pathname === '/api/info') {
      response = await handleAPIInfo();
    } else if (url.pathname === '/' || url.pathname === '/proxy') {
      response = await handleProxy(context);
    } else if (env.ASSETS) {
      // Serve static assets
      response = await env.ASSETS.fetch(request);
    } else {
      response = createErrorResponse('Not found', 404, 'NOT_FOUND');
    }

    // Add security headers to response
    const finalHeaders = new Headers(response.headers);
    for (const [key, value] of securityHeaders.entries()) {
      if (!finalHeaders.has(key)) {
        finalHeaders.set(key, value);
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
  } catch (error) {
    console.error('Router error:', error);
    return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
