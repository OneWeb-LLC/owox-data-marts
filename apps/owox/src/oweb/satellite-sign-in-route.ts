import type { IdpProvider } from '@owox/idp-protocol';
import express, { type Express, type Request, type Response } from 'express';

import { completeSatelliteLogin } from './complete-satellite-login.js';
import { isOwebSatelliteEnabled, owebOnboardingUrl } from './constants.js';
import type { QueryableDataSource } from './odm-profile.js';
import { supabaseSignInWithPassword, userHasWorkspace } from './supabase.js';

function signInErrorRedirect(res: Response, message: string): void {
  res.redirect(`/auth/sign-in?error=${encodeURIComponent(message)}`);
}

function isInvalidCredentialsError(message: string): boolean {
  return (
    message.includes('invalid_credentials') ||
    message.includes('Invalid login credentials') ||
    message.includes('supabase_password_400')
  );
}

/**
 * When OWeb satellite env is configured, email/password sign-in uses shared
 * Supabase Auth (D12), gates new users to OWeb onboarding (D14), and records
 * app activation (D13) before bridging into the local Better Auth session.
 */
export function registerOwebSatelliteSignInRoute(
  app: Express,
  getIdp: () => IdpProvider | null,
  getDataSource: () => QueryableDataSource | undefined
): void {
  if (!isOwebSatelliteEnabled()) {
    return;
  }

  const handler = async (req: Request, res: Response): Promise<void> => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      signInErrorRedirect(res, 'Email and password are required.');
      return;
    }

    try {
      const session = await supabaseSignInWithPassword(email, password);
      const userId = session.user.id;

      const hasWorkspace = await userHasWorkspace(userId);
      if (!hasWorkspace) {
        res.redirect(owebOnboardingUrl());
        return;
      }

      const magicLink = await completeSatelliteLogin({
        userId,
        accessToken: session.access_token,
        getDataSource,
        getIdp,
      });

      res.redirect(magicLink);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      if (isInvalidCredentialsError(message)) {
        signInErrorRedirect(
          res,
          'Invalid email or password. Use the same credentials as oweb.one.'
        );
        return;
      }

      console.error('[oweb] satellite sign-in failed', message);
      signInErrorRedirect(res, 'Could not sign in. Please try again or use Continue with OWeb.');
    }
  };

  app.use('/auth/api/sign-in', express.urlencoded({ extended: true }));
  app.post(['/auth/api/sign-in', '/auth/api/sign-in/'], handler);
}
