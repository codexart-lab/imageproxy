/**
 * Image proxy logic for Cloudflare Image Proxy
 * Handles fetching, transforming, and caching images
 */

import type { ImageTransformParams, ProxyResult } from './types';
import { validateTransformParams } from './validator';
import { validateUrlForSSRF } from './security';
import {
  getCachedResponse,
  setCachedResponse,
  createCacheKey,
  extractMetadataFromResponse,
  shouldUseCache,
  checkConditionalRequest,
} from './cache';
import { createErrorResponse } from './utils';

/**
 * Builds Cloudflare Image Resizing options
 * Based on Cloudflare Image Resizing API [[6]]
 */
function buildImageResizingOptions(params: ImageTransformParams): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (params.width) options.width = params.width;
  if (params.height) options.height = params.height;
  if (params.quality) options.quality = params.quality;
  if (params.format) options.format = params.format;
  if (params.fit) options.fit = params.fit;
  if (params.gravity) options.gravity = params.gravity;
  if (params.blur !== undefined) options.blur = params.blur;
  if (params.brightness !== undefined) options.brightness = params.brightness;
  if (params.contrast !== undefined) options.contrast = params.contrast;
  if (params.gamma !== undefined) options.gamma = params.gamma;
  if (params.rotate) options.rotate = params.rotate;
  if (params.sharpen !== undefined) options.sharpen = params.sharpen;
  if (params.background) options.background = params.background;
  if (params.dpr) options.dpr = params.dpr;
  if (params.anim !== undefined) options.anim = params.anim;

  return options;
}

/**
 * Fetches image with Cloudflare Image Resizing
 */
async function fetchWithResizing(
  url: string,
  params: ImageTransformParams,
  timeout: number
): Promise<Response> {
  const options = buildImageResizingOptions(params);

  // Use Cloudflare Image Resizing via fetch subrequest [[6]]
  const response = await fetch(url, {
    method: 'GET',
    cf: {
      image: options,
    },
  });

  return response;
}

/**
 * Proxies image request with transformations
 */
export async function proxyImage(
  request: Request,
  params: ImageTransformParams,
  env: Env,
  ctx: ExecutionContext
): Promise<ProxyResult> {
  const startTime = Date.now();
  const timeout = parseInt(env.REQUEST_TIMEOUT_MS || '30000', 10);

  // Validate parameters
  const validation = validateTransformParams(params);
  if (!validation.valid) {
    return {
      response: createErrorResponse(validation.errors.join(', '), 400, 'INVALID_PARAMS'),
      cached: false,
      transformApplied: false,
    };
  }

  // Validate URL for SSRF
  const ssrfValidation = await validateUrlForSSRF(params.url);
  if (!ssrfValidation.valid) {
    return {
      response: createErrorResponse(ssrfValidation.error || 'Invalid URL', 403, 'SSRF_BLOCKED'),
      cached: false,
      transformApplied: false,
    };
  }

  // Check cache
  const cacheKey = createCacheKey(request, new URLSearchParams());
  const useCache = shouldUseCache(request);

  if (useCache) {
    const { response: cachedResponse, metadata } = await getCachedResponse(cacheKey);

    if (cachedResponse) {
      // Check conditional request
      const conditional = checkConditionalRequest(request, metadata || {});
      if (conditional.shouldReturnNotModified) {
        return {
          response: new Response(null, {
            status: 304,
            headers: cachedResponse.headers,
          }),
          cached: true,
          transformApplied: false,
        };
      }

      return {
        response: cachedResponse,
        cached: true,
        transformApplied: false,
      };
    }
  }

  try {
    // Fetch image with transformations
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;

    try {
      response = await fetchWithResizing(params.url, params, timeout);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return {
        response: createErrorResponse(
          `Failed to fetch image: ${response.status} ${response.statusText}`,
          response.status === 404 ? 404 : 502,
          'FETCH_FAILED'
        ),
        cached: false,
        transformApplied: false,
      };
    }

    // Extract metadata
    const metadata = extractMetadataFromResponse(response);

    // Get response body
    const body = await response.arrayBuffer();

    // Create response
    const proxyResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Cache the response
    if (useCache && response.ok) {
      ctx.waitUntil(setCachedResponse(cacheKey, proxyResponse, metadata));
    }

    return {
      response: proxyResponse,
      cached: false,
      transformApplied: Object.keys(buildImageResizingOptions(params)).length > 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        response: createErrorResponse('Request timeout', 408, 'TIMEOUT'),
        cached: false,
        transformApplied: false,
      };
    }

    console.error('Proxy error:', error);
    return {
      response: createErrorResponse('Failed to process image', 500, 'INTERNAL_ERROR'),
      cached: false,
      transformApplied: false,
    };
  }
}

/**
 * Fetches image without transformations (direct proxy)
 */
export async function directProxy(
  url: string,
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<ProxyResult> {
  const timeout = parseInt(env.REQUEST_TIMEOUT_MS || '30000', 10);

  // Validate URL for SSRF
  const ssrfValidation = await validateUrlForSSRF(url);
  if (!ssrfValidation.valid) {
    return {
      response: createErrorResponse(ssrfValidation.error || 'Invalid URL', 403, 'SSRF_BLOCKED'),
      cached: false,
      transformApplied: false,
    };
  }

  // Check cache
  const cacheKey = createCacheKey(request, new URLSearchParams());
  const useCache = shouldUseCache(request);

  if (useCache) {
    const { response: cachedResponse, metadata } = await getCachedResponse(cacheKey);

    if (cachedResponse) {
      const conditional = checkConditionalRequest(request, metadata || {});
      if (conditional.shouldReturnNotModified) {
        return {
          response: new Response(null, {
            status: 304,
            headers: cachedResponse.headers,
          }),
          cached: true,
          transformApplied: false,
        };
      }

      return {
        response: cachedResponse,
        cached: true,
        transformApplied: false,
      };
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;

    try {
      response = await fetch(url, {
        method: request.method,
        headers: request.headers,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return {
        response: createErrorResponse(
          `Failed to fetch: ${response.status} ${response.statusText}`,
          response.status === 404 ? 404 : 502,
          'FETCH_FAILED'
        ),
        cached: false,
        transformApplied: false,
      };
    }

    const metadata = extractMetadataFromResponse(response);
    const body = await response.arrayBuffer();

    const proxyResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    if (useCache && response.ok) {
      ctx.waitUntil(setCachedResponse(cacheKey, proxyResponse, metadata));
    }

    return {
      response: proxyResponse,
      cached: false,
      transformApplied: false,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        response: createErrorResponse('Request timeout', 408, 'TIMEOUT'),
        cached: false,
        transformApplied: false,
      };
    }

    console.error('Direct proxy error:', error);
    return {
      response: createErrorResponse('Failed to fetch image', 500, 'INTERNAL_ERROR'),
      cached: false,
      transformApplied: false,
    };
  }
}
