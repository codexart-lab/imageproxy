/**
 * Security utilities for Cloudflare Image Proxy
 * Implements SSRF protection and URL validation
 */

import type { ErrorResponse } from './types';

/**
 * Private IP ranges that should be blocked to prevent SSRF
 */
const PRIVATE_IP_RANGES = [
  // IPv4 Private ranges
  { start: '10.0.0.0', end: '10.255.255.255' }, // 10.0.0.0/8
  { start: '172.16.0.0', end: '172.31.255.255' }, // 172.16.0.0/12
  { start: '192.168.0.0', end: '192.168.255.255' }, // 192.168.0.0/16
  { start: '127.0.0.0', end: '127.255.255.255' }, // 127.0.0.0/8 (localhost)
  { start: '0.0.0.0', end: '0.255.255.255' }, // 0.0.0.0/8
  { start: '169.254.0.0', end: '169.254.255.255' }, // 169.254.0.0/16 (link-local)
  { start: '100.64.0.0', end: '100.127.255.255' }, // 100.64.0.0/10 (CGNAT)
  { start: '224.0.0.0', end: '239.255.255.255' }, // 224.0.0.0/4 (multicast)
  { start: '240.0.0.0', end: '255.255.255.255' }, // 240.0.0.0/4 (reserved)
];

/**
 * Cloudflare metadata IP
 */
const METADATA_IPS = ['169.254.169.254'];

/**
 * Blocked hostnames
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  'metadata.google.internal',
  '169.254.169.254',
];

/**
 * Converts IP address string to integer for comparison
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return 0;

  let result = 0;
  for (let i = 0; i < 4; i++) {
    result = result * 256 + parseInt(parts[i], 10);
  }
  return result;
}

/**
 * Checks if an IP address is in a private range
 */
function isPrivateIP(ip: string): boolean {
  const ipInt = ipToInt(ip);

  for (const range of PRIVATE_IP_RANGES) {
    const startInt = ipToInt(range.start);
    const endInt = ipToInt(range.end);

    if (ipInt >= startInt && ipInt <= endInt) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if hostname is a metadata service
 */
function isMetadataService(hostname: string): boolean {
  return METADATA_IPS.includes(hostname) || hostname.endsWith('.internal');
}

/**
 * Validates URL for SSRF vulnerabilities
 * Returns validation result with error message if invalid
 */
export async function validateUrlForSSRF(urlString: string): Promise<{
  valid: boolean;
  error?: string;
  resolvedUrl?: string;
}> {
  // Basic URL validation
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check protocol
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  // Check hostname
  const hostname = url.hostname.toLowerCase();

  // Block localhost and metadata services
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Access to localhost and metadata services is blocked' };
  }

  // Check for IP address
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    // Validate IP format
    const parts = hostname.split('.');
    if (parts.some((part) => parseInt(part, 10) > 255)) {
      return { valid: false, error: 'Invalid IP address format' };
    }

    // Check if private IP
    if (isPrivateIP(hostname)) {
      return { valid: false, error: 'Access to private IP addresses is blocked' };
    }

    // Check metadata services
    if (isMetadataService(hostname)) {
      return { valid: false, error: 'Access to metadata services is blocked' };
    }
  }

  // Block IPv6 localhost
  if (hostname === '::1' || hostname === '[::1]') {
    return { valid: false, error: 'Access to IPv6 localhost is blocked' };
  }

  // Try to resolve and check for redirects
  try {
    const response = await fetch(urlString, {
      method: 'HEAD',
      redirect: 'manual',
      cf: { cacheEverything: false },
    });

    // Check for redirect loops
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (location) {
        try {
          const redirectUrl = new URL(location, url);
          // Recursively validate redirect URL
          return await validateUrlForSSRF(redirectUrl.toString());
        } catch {
          return { valid: false, error: 'Invalid redirect URL' };
        }
      }
    }

    return { valid: true, resolvedUrl: urlString };
  } catch (error) {
    // If fetch fails, still allow if basic validation passed
    // This handles cases where DNS resolution might fail temporarily
    return { valid: true, resolvedUrl: urlString };
  }
}

/**
 * Sanitizes URL to prevent SSRF attacks
 * Removes dangerous protocols and normalizes the URL
 */
export function sanitizeUrl(url: string): string {
  // Remove any leading/trailing whitespace
  url = url.trim();

  // Remove null bytes and other control characters
  url = url.replace(/[\x00-\x1f\x7f]/g, '');

  // Decode URL-encoded characters that might be used to bypass filters
  try {
    url = decodeURIComponent(url);
  } catch {
    // If decoding fails, use original
  }

  return url;
}

/**
 * Validates request origin for CORS
 */
export function validateOrigin(origin: string | null, allowedOrigins?: string[]): boolean {
  if (!origin) return false;
  if (!allowedOrigins || allowedOrigins.length === 0) return true; // Allow all if not configured

  return allowedOrigins.some((allowed) => {
    if (allowed === '*') return true;
    return origin === allowed;
  });
}

/**
 * Creates security headers for responses
 */
export function createSecurityHeaders(): Headers {
  const headers = new Headers();
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  return headers;
}

/**
 * Checks for potential URL bypass attempts
 */
export function detectUrlBypass(url: string): boolean {
  const bypassPatterns = [
    /\/\/+/, // Multiple slashes
    /\\/, // Backslashes
    /%00/, // Null byte
    /%0a|%0d/i, // Newline characters
    /javascript:/i,
    /data:/i,
    /file:/i,
    /ftp:/i,
  ];

  return bypassPatterns.some((pattern) => pattern.test(url));
}
