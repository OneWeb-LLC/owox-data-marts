import { BetterAuthProvider } from '@owox/idp-better-auth';
import type { IdpProvider } from '@owox/idp-protocol';
import type { Express, Request, Response } from 'express';

import { activateOwoxApp } from './activate.js';
import { isOwebSatelliteEnabled } from './constants.js';
import { upsertOdmProfile, type QueryableDataSource } from './odm-profile.js';
import { redeemEcosystemLaunchToken } from './redeem-launch-token.js';
import { supabaseAuthGetUser } from './supabase.js';

type AuthUser = {
  id?: string;
  email?: string | null;
  user_metadata?: {
    one_id?: string;
    full_name?: string;
    name?: string;
  };
};

function providerSupportsOwebSignIn(provider: IdpProvider): provider is BetterAuthProvider {
  return typeof (provider as BetterAuthProvider).signInWithOwebUser === 'function';
}

function ssoErrorPage(message: string): string {
  const escaped = message.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>SSO</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <div style="max-width:28rem;text-align:center">
    <h1>Could not sign you in</h1>
    <p>${escaped}</p>
    <p><a href="/auth/sign-in">Back to sign in</a></p>
  </div>
</body></html>`;
}

/**
 * Register GET /sso?launch_token= for OWeb App Store handoff.
 * No-ops when satellite env is not configured (local CLI).
 */
export function registerOwebSsoRoute(
  app: Express,
  getIdp: () => IdpProvider | null,
  getDataSource: () => QueryableDataSource | undefined
): void {
  app.get('/sso', async (req: Request, res: Response) => {
    if (!isOwebSatelliteEnabled()) {
      return res.status(404).send(ssoErrorPage('OWeb satellite SSO is not configured.'));
    }

    const launchToken = typeof req.query.launch_token === 'string' ? req.query.launch_token : '';
    if (!launchToken) {
      return res
        .status(400)
        .send(
          ssoErrorPage(
            'Missing launch token. Open OWOX Data Marts from the OWeb App Store or Continue with OWeb.'
          )
        );
    }

    try {
      const redeemed = await redeemEcosystemLaunchToken(launchToken);
      const authUser = await supabaseAuthGetUser<AuthUser>(redeemed.accessToken);
      const email = authUser.email?.trim();
      if (!email) {
        throw new Error('oweb_user_missing_email');
      }

      const fullName =
        authUser.user_metadata?.full_name ||
        authUser.user_metadata?.name ||
        authUser.user_metadata?.one_id ||
        email;
      const oneId = authUser.user_metadata?.one_id ?? null;

      await activateOwoxApp(redeemed.userId);
      await upsertOdmProfile(getDataSource(), {
        id: redeemed.userId,
        oneId,
        email,
        fullName,
        orgId: redeemed.orgId,
      });

      const idp = getIdp();
      if (!idp || !providerSupportsOwebSignIn(idp)) {
        throw new Error('idp_provider_does_not_support_oweb_sso');
      }

      const magicLink = await idp.signInWithOwebUser(email, fullName);
      return res.redirect(magicLink);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SSO failed';
      console.error('[oweb] SSO failed', message);
      return res.status(401).send(ssoErrorPage(message));
    }
  });
}
