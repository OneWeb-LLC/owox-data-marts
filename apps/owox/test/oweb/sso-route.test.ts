import type { Express, Request, Response } from 'express';

import { expect } from 'chai';

import { registerOwebSsoRoute } from '../../src/oweb/sso-route.js';

describe('registerOwebSsoRoute', () => {
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

  it('returns HTML error (not SPA) when launch_token is missing', async () => {
    process.env.OWEB_APP_ID = 'ometrics';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-role-key';

    let handler: ((req: Request, res: Response) => Promise<void>) | undefined;
    const app = {
      get(path: unknown, routeHandler: (req: Request, res: Response) => Promise<void>) {
        expect(path).to.equal('/sso');
        handler = routeHandler;
      },
    } as unknown as Express;

    registerOwebSsoRoute(app, () => null, () => undefined);

    expect(handler).to.be.a('function');

    const sent: { status?: number; body?: string; headers?: Record<string, string> } = {};
    const res = {
      status(code: number) {
        sent.status = code;
        return this;
      },
      send(body: string) {
        sent.body = body;
      },
      redirect() {},
      setHeader(key: string, value: string) {
        sent.headers ??= {};
        sent.headers[key] = value;
      },
    } as unknown as Response;

    await handler?.({ query: {} } as Request, res);

    expect(sent.status).to.equal(400);
    expect(sent.body).to.include('Could not sign you in');
    expect(sent.body).to.include('Missing launch token');
    expect(sent.body).not.to.include('<title>OWOX</title>');
  });
});