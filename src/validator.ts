/**
 * Input validation utilities for Cloudflare Image Proxy
 */

import type { ImageTransformParams } from './types';

/**
 * Validates image transformation parameters
 */
export function validateTransformParams(params: ImageTransformParams): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate URL
  if (!params.url) {
    errors.push('URL parameter is required');
  } else {
    try {
      new URL(params.url);
    } catch {
      errors.push('Invalid URL format');
    }
  }

  // Validate width
  if (params.width !== undefined) {
    if (params.width < 1 || params.width > 10000) {
      errors.push('Width must be between 1 and 10000 pixels');
    }
  }

  // Validate height
  if (params.height !== undefined) {
    if (params.height < 1 || params.height > 10000) {
      errors.push('Height must be between 1 and 10000 pixels');
    }
  }

  // Validate quality
  if (params.quality !== undefined) {
    if (params.quality < 1 || params.quality > 100) {
      errors.push('Quality must be between 1 and 100');
    }
  }

  // Validate blur
  if (params.blur !== undefined) {
    if (params.blur < 0 || params.blur > 100) {
      errors.push('Blur must be between 0 and 100');
    }
  }

  // Validate brightness
  if (params.brightness !== undefined) {
    if (params.brightness < -100 || params.brightness > 100) {
      errors.push('Brightness must be between -100 and 100');
    }
  }

  // Validate contrast
  if (params.contrast !== undefined) {
    if (params.contrast < -100 || params.contrast > 100) {
      errors.push('Contrast must be between -100 and 100');
    }
  }

  // Validate gamma
  if (params.gamma !== undefined) {
    if (params.gamma < 0.01 || params.gamma > 10) {
      errors.push('Gamma must be between 0.01 and 10');
    }
  }

  // Validate sharpen
  if (params.sharpen !== undefined) {
    if (params.sharpen < 0 || params.sharpen > 100) {
      errors.push('Sharpen must be between 0 and 100');
    }
  }

  // Validate DPR
  if (params.dpr !== undefined) {
    if (params.dpr < 1 || params.dpr > 3) {
      errors.push('DPR must be between 1 and 3');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates URL format and protocol
 */
export function validateUrlFormat(url: string): { valid: boolean; error?: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, error: 'URL is required' };
  }

  if (url.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum length of 2048 characters' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
  }

  return { valid: true };
}

/**
 * Validates content type is an image
 */
export function validateImageContentType(contentType: string | null): {
  valid: boolean;
  error?: string;
} {
  if (!contentType) {
    return { valid: false, error: 'No content type specified' };
  }

  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/svg+xml',
    'image/bmp',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];

  const normalizedType = contentType.toLowerCase().split(';')[0].trim();

  if (!allowedTypes.includes(normalizedType)) {
    return { valid: false, error: `Unsupported content type: ${contentType}` };
  }

  return { valid: true };
}

/**
 * Validates file extension from URL
 */
export function validateFileExtension(url: string): { valid: boolean; error?: string } {
  const allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.avif',
    '.svg',
    '.bmp',
    '.ico',
  ];

  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname.toLowerCase();
    const hasValidExtension = allowedExtensions.some((ext) => pathname.endsWith(ext));

    if (!hasValidExtension) {
      // Some URLs might not have extensions but still serve images
      // This is a warning, not a hard error
      return { valid: true };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }
}
