export const DEFAULT_OWEB_APP_ID = 'owox';

/** OWeb control plane — login, signup, onboarding, App Store SSO mint (not Supabase Auth). */
export const DEFAULT_OWEB_APP_URL = 'https://oweb.one';

/**
 * Shared One OS Supabase Auth custom domain. Set `SUPABASE_URL` / client env to this on
 * constellation satellites (e.g. oMetrics). Corpus / GHI tenants use their own auth project.
 */
export const DEFAULT_ONE_OS_SUPABASE_AUTH_URL = 'https://auth.oweb.one';

export const DEFAULT_ACTIVATION_KIND = 'session';

export function getOwebAppId(): string {
  return (process.env.OWEB_APP_ID || DEFAULT_OWEB_APP_ID).trim();
}

export function getOwebAppUrl(): string {
  const fromEnv = process.env.OWEB_APP_URL || process.env.VITE_OWEB_APP_URL || DEFAULT_OWEB_APP_URL;
  return fromEnv.replace(/\/$/, '');
}

export function owebLoginUrl(options?: { launch?: boolean }): string {
  const url = new URL('/login', getOwebAppUrl());
  if (options?.launch !== false) {
    url.searchParams.set('launch', getOwebAppId());
  }
  return url.toString();
}

export function owebOnboardingUrl(): string {
  const url = new URL('/onboarding', getOwebAppUrl());
  url.searchParams.set('launch', getOwebAppId());
  return url.toString();
}

export function isOwebSatelliteEnabled(): boolean {
  return Boolean(process.env.OWEB_APP_ID?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
