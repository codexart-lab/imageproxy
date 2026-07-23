/**
 * Type definitions for Cloudflare Image Proxy
 */

export interface ImageTransformParams {
  url: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'avif' | 'webp' | 'json' | 'jpeg' | 'png';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'center' | 'left' | 'right' | 'top' | 'bottom' | 'auto';
  blur?: number;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  rotate?: 0 | 90 | 180 | 270;
  sharpen?: number;
  background?: string;
  dpr?: number;
  anim?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  onerror?: 'redirect' | 'fallback';
  fallback?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface SuccessResponse<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

export interface CacheMetadata {
  etag?: string;
  lastModified?: string;
  cacheControl?: string;
  contentType?: string;
  contentLength?: number;
}

export interface ProxyResult {
  response: Response;
  cached: boolean;
  transformApplied: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface RequestContext {
  request: Request;
  env: Env;
  ctx: ExecutionContext;
  url: URL;
  startTime: number;
}
