import type { Express, Request, Response } from 'express';
import { expect } from 'chai';

import { registerOwebSatelliteSignInRoute } from '../../src/oweb/satellite-sign-in-route.js';

describe('registerOwebSatelliteSignInRoute', () => {
  const originalAppId = process.env.OWEB_APP_ID;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (originalAppId === undefined) {
      delete process.env.OWEB_APP_ID;
    } else {
      process.env.OWEB_APP_ID = originalAppId;
    }
    if (originalServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
    }
  });

  it('does not register routes when satellite env is missing', () => {
    delete process.env.OWEB_APP_ID;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const calls: unknown[] = [];
    const app = {
      use: (...args: unknown[]) => calls.push(['use', args]),
      post: (...args: unknown[]) => calls.push(['post', args]),
    } as unknown as Express;

    registerOwebSatelliteSignInRoute(app, () => null, () => undefined);

    expect(calls).to.deep.equal([]);
  });

  it('registers POST /auth/api/sign-in and redirects with 303 See Other after success', async () => {
    process.env.OWEB_APP_ID = 'owox';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';

    let postedHandler: ((req: Request, res: Response) => Promise<void>) | undefined;
    const app = {
      use() {},
      post(path: unknown, handler: (req: Request, res: Response) => Promise<void>) {
        expect(path).to.deep.equal(['/auth/api/sign-in', '/auth/api/sign-in/']);
        postedHandler = handler;
      },
    } as unknown as Express;

    registerOwebSatelliteSignInRoute(app, () => null, () => undefined);

    expect(postedHandler).to.be.a('function');

    const redirects: Array<{ status?: number; url: string }> = [];
    const res = {
      redirect(statusOrUrl: number | string, url?: string) {
        if (typeof statusOrUrl === 'number') {
          redirects.push({ status: statusOrUrl, url: url ?? '' });
        } else {
          redirects.push({ url: statusOrUrl });
        }
      },
    } as unknown as Response;

    await postedHandler?.({ body: {} } as Request, res);

    expect(redirects).to.deep.equal([
      { status: 303, url: '/auth/sign-in?error=Email%20and%20password%20are%20required.' },
    ]);
  });
});
