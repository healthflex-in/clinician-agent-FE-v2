export const API_KEY =
  import.meta.env.VITE_API_KEY || '';

export const API_URL =
  import.meta.env.VITE_API_URL || 'https://devapi.stance.health/graphql';

export function getApiUrl(): string {
  return API_URL;
}
