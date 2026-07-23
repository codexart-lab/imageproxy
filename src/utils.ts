/**
 * Utility functions for Cloudflare Image Proxy
 */

import type { ErrorResponse } from './types';

/**
 * Creates a JSON error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 400,
  code?: string,
  details?: Record<string, unknown>
): Response {
  const body: ErrorResponse = {
    success: false,
    error: message,
    ...(code && { code }),
    ...(details && { details }),
  };

  return new Response(JSON.stringify(body, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/**
 * Creates a JSON success response
 */
export function createSuccessResponse<T>(data: T, statusCode: number = 200): Response {
  return new Response(JSON.stringify({ success: true, data }, null, 2), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Parses a number from query parameter safely
 */
export function parseQueryParamNumber(
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
 * Validates and parses image format
 */
export function parseImageFormat(format?: string): 'avif' | 'webp' | 'jpeg' | 'png' | undefined {
  if (!format) return undefined;
  const validFormats = ['avif', 'webp', 'jpeg', 'png', 'jpg'];
  const normalized = format.toLowerCase();
  if (validFormats.includes(normalized)) {
    return normalized === 'jpg' ? 'jpeg' : (normalized as 'avif' | 'webp' | 'jpeg' | 'png');
  }
  return undefined;
}

/**
 * Validates and parses fit parameter
 */
export function parseFitParameter(fit?: string): ImageTransformParams['fit'] {
  const validFits = ['scale-down', 'contain', 'cover', 'crop', 'pad'];
  if (fit && validFits.includes(fit)) {
    return fit as ImageTransformParams['fit'];
  }
  return undefined;
}

/**
 * Validates and parses gravity parameter
 */
export function parseGravityParameter(gravity?: string): ImageTransformParams['gravity'] {
  const validGravities = ['center', 'left', 'right', 'top', 'bottom', 'auto'];
  if (gravity && validGravities.includes(gravity)) {
    return gravity as ImageTransformParams['gravity'];
  }
  return undefined;
}

/**
 * Validates and parses rotation parameter
 */
export function parseRotationParameter(rotate?: string): ImageTransformParams['rotate'] {
  if (!rotate) return undefined;
  const validRotations = [0, 90, 180, 270];
  const num = parseInt(rotate, 10);
  if (validRotations.includes(num)) {
    return num as ImageTransformParams['rotate'];
  }
  return undefined;
}

/**
 * Clamps a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generates a cache key from request URL and parameters
 */
export function generateCacheKey(url: URL, params: URLSearchParams): string {
  const baseUrl = url.pathname + url.search;
  const sortedParams = new URLSearchParams(params.toString());
  sortedParams.sort();
  return `image-proxy:${baseUrl}:${sortedParams.toString()}`;
}

/**
 * Formats bytes to human readable format
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Calculates request duration in milliseconds
 */
export function calculateDuration(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Sanitizes URL for logging (removes query parameters)
 */
export function sanitizeUrlForLogging(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Checks if response is an image based on content type
 */
export function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const imageTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'image/bmp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];
  return imageTypes.some((type) => contentType.includes(type));
}

/**
 * Creates headers with CORS support
 */
export function createCORSHeaders(allowedOrigin?: string): Headers {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', allowedOrigin || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

/**
 * Validates rotation angle
 */
export function isValidRotation(angle: number): boolean {
  return [0, 90, 180, 270].includes(angle);
}
