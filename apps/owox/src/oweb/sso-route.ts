import type { IdpProvider } from '@owox/idp-protocol';
import type { Express, Request, Response } from 'express';

import { completeSatelliteLogin } from './complete-satellite-login.js';
import { isOwebSatelliteEnabled } from './constants.js';
import type { QueryableDataSource } from './odm-profile.js';
import { redeemEcosystemLaunchToken } from './redeem-launch-token.js';

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
      const magicLink = await completeSatelliteLogin({
        userId: redeemed.userId,
        accessToken: redeemed.accessToken,
        orgId: redeemed.orgId,
        getIdp,
        getDataSource,
      });
      return res.redirect(magicLink);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SSO failed';
      console.error('[oweb] SSO failed', message);
      return res.status(401).send(ssoErrorPage(message));
    }
  });
}
