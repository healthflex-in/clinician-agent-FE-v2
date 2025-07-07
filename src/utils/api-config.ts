export const API_KEY = import.meta.env.VITE_API_KEY || 'b90718a058accf0130e62c030ef919b3eabbbff85b81bb70985d6ab87995333a';

export const API_URL = import.meta.env.VITE_API_URL || 'https://devapi.stance.health/graphql';

export function getApiUrl(): string {
  return API_URL;
}
