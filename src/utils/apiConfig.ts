// src/api/apiConfig.ts

// API key from environment variables or hardcoded for development
export const API_KEY =
  import.meta.env.VITE_API_KEY ||
  '192090f41c5eac71ac2ff52e3ae4b4b80f4a083d71b64f704c0101b5b5d03e20';

// API URL from environment variables or use default
export const API_URL =
  import.meta.env.VITE_API_URL || 'https://devapi.stance.health/graphql';

// Local proxy URL (for development)
export const PROXY_URL = '/api/graphql';

/**
 * Get the appropriate URL for API calls
 * In development, this will use the Vite proxy
 */
export function getApiUrl(): string {
  // Always use the proxy in development
  return PROXY_URL;
}
