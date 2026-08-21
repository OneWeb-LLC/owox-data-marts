export const DEFAULT_OWEB_APP_ID = 'owox';
export const DEFAULT_OWEB_APP_URL = 'https://oweb.one';
export const DEFAULT_ACTIVATION_KIND = 'session';

export function getOwebAppId(): string {
  return (process.env.OWEB_APP_ID || DEFAULT_OWEB_APP_ID).trim();
}

export function getOwebAppUrl(): string {
  const fromEnv = process.env.OWEB_APP_URL || process.env.VITE_OWEB_APP_URL || DEFAULT_OWEB_APP_URL;
  return fromEnv.replace(/\/$/, '');
}

export function isOwebSatelliteEnabled(): boolean {
  return Boolean(process.env.OWEB_APP_ID?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
