export const API_KEY =
  import.meta.env.VITE_API_KEY ||
  '4e477937c9437478f33e667e835ca735fe9cef5e180b1c0842f1519b90ba5819';

export const API_URL =
  import.meta.env.VITE_API_URL || 'https://devapi.stance.health/graphql';

export function getApiUrl(): string {
  return API_URL;
}
