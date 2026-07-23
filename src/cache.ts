/**
 * Cache management for Cloudflare Image Proxy
 * Uses Cloudflare Cache API for edge caching
 */

import type { CacheMetadata, ProxyResult } from './types';

/**
 * Cache configuration
 */
interface CacheConfig {
  defaultTTL: number;
  maxTTL: number;
  respectOriginHeaders: boolean;
}

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  defaultTTL: 86400, // 24 hours
  maxTTL: 31536000, // 1 year
  respectOriginHeaders: true,
};

/**
 * Generates a cache key from request
 */
export function createCacheKey(request: Request, params: URLSearchParams): string {
  const url = new URL(request.url);
  const sortedParams = new URLSearchParams(params.toString());
  sortedParams.sort();

  // Include transformation parameters in cache key
  const cacheKey = `${url.pathname}?${sortedParams.toString()}`;

  return cacheKey;
}

/**
 * Gets cached response from Cloudflare Cache API
 */
export async function getCachedResponse(
  cacheKey: string
): Promise<{ response: Response | null; metadata: CacheMetadata | null }> {
  try {
    const cache = caches.default;
    const request = new Request(`https://cache.internal/${cacheKey}`);
    const response = await cache.match(request);

    if (!response) {
      return { response: null, metadata: null };
    }

    // Extract metadata from headers
    const metadata: CacheMetadata = {
      etag: response.headers.get('etag') || undefined,
      lastModified: response.headers.get('last-modified') || undefined,
      cacheControl: response.headers.get('cache-control') || undefined,
      contentType: response.headers.get('content-type') || undefined,
      contentLength: parseInt(response.headers.get('content-length') || '0', 10),
    };

    return { response, metadata };
  } catch (error) {
    console.error('Cache get error:', error);
    return { response: null, metadata: null };
  }
}

/**
 * Stores response in Cloudflare Cache API
 */
export async function setCachedResponse(
  cacheKey: string,
  response: Response,
  metadata: CacheMetadata,
  config: CacheConfig = DEFAULT_CACHE_CONFIG
): Promise<void> {
  try {
    const cache = caches.default;

    // Calculate TTL
    let ttl = config.defaultTTL;

    if (config.respectOriginHeaders && metadata.cacheControl) {
      const maxAgeMatch = metadata.cacheControl.match(/max-age=(\d+)/);
      if (maxAgeMatch) {
        ttl = Math.min(parseInt(maxAgeMatch[1], 10), config.maxTTL);
      }
    }

    // Clone response to avoid body lock
    const responseToCache = new Response(response.body, response);

    // Add metadata headers
    const headers = new Headers(responseToCache.headers);
    if (metadata.etag) headers.set('etag', metadata.etag);
    if (metadata.lastModified) headers.set('last-modified', metadata.lastModified);
    if (metadata.contentType) headers.set('content-type', metadata.contentType);
    headers.set('cache-control', `public, max-age=${ttl}`);

    const cachedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers,
    });

    const request = new Request(`https://cache.internal/${cacheKey}`);
    await cache.put(request, cachedResponse);
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

/**
 * Purges cached response
 */
export async function purgeCache(cacheKey: string): Promise<boolean> {
  try {
    const cache = caches.default;
    const request = new Request(`https://cache.internal/${cacheKey}`);
    // Cache API doesn't have a delete method, so we can't purge individual items
    // This is a limitation of Cloudflare Cache API
    return false;
  } catch (error) {
    console.error('Cache purge error:', error);
    return false;
  }
}

/**
 * Creates cache response with proper headers
 */
export function createCacheResponse(
  body: ArrayBuffer | ReadableStream<Uint8Array>,
  metadata: CacheMetadata,
  status: number = 200,
  statusText: string = 'OK'
): Response {
  const headers: Record<string, string> = {
    'Content-Type': metadata.contentType || 'application/octet-stream',
  };

  if (metadata.etag) {
    headers['ETag'] = metadata.etag;
  }

  if (metadata.lastModified) {
    headers['Last-Modified'] = metadata.lastModified;
  }

  if (metadata.cacheControl) {
    headers['Cache-Control'] = metadata.cacheControl;
  } else {
    headers['Cache-Control'] = 'public, max-age=86400';
  }

  if (metadata.contentLength) {
    headers['Content-Length'] = metadata.contentLength.toString();
  }

  return new Response(body, {
    status,
    statusText,
    headers,
  });
}

/**
 * Checks if request should use cache based on headers
 */
export function shouldUseCache(request: Request): boolean {
  const cacheControl = request.headers.get('cache-control') || '';

  // Don't cache if no-cache or no-store is set
  if (cacheControl.includes('no-cache') || cacheControl.includes('no-store')) {
    return false;
  }

  // Don't cache HEAD requests
  if (request.method === 'HEAD') {
    return false;
  }

  return true;
}

/**
 * Validates conditional request headers (If-None-Match, If-Modified-Since)
 */
export function checkConditionalRequest(
  request: Request,
  metadata: CacheMetadata
): { shouldReturnNotModified: boolean; status: number } {
  const ifNoneMatch = request.headers.get('if-none-match');
  const ifModifiedSince = request.headers.get('if-modified-since');

  // Check ETag
  if (ifNoneMatch && metadata.etag) {
    if (ifNoneMatch === metadata.etag || ifNoneMatch === `W/"${metadata.etag}"`) {
      return { shouldReturnNotModified: true, status: 304 };
    }
  }

  // Check Last-Modified
  if (ifModifiedSince && metadata.lastModified) {
    const requestTime = new Date(ifModifiedSince).getTime();
    const lastModifiedTime = new Date(metadata.lastModified).getTime();

    if (lastModifiedTime <= requestTime) {
      return { shouldReturnNotModified: true, status: 304 };
    }
  }

  return { shouldReturnNotModified: false, status: 200 };
}

/**
 * Extracts cache metadata from response
 */
export function extractMetadataFromResponse(response: Response): CacheMetadata {
  return {
    etag: response.headers.get('etag') || undefined,
    lastModified: response.headers.get('last-modified') || undefined,
    cacheControl: response.headers.get('cache-control') || undefined,
    contentType: response.headers.get('content-type') || undefined,
    contentLength: parseInt(response.headers.get('content-length') || '0', 10),
  };
}
