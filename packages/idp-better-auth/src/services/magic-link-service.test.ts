import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CryptoService } from './crypto-service.js';
import {
  MAGIC_LINK_VERIFY_PATH,
  MagicLinkService,
  toMagicLinkVerifyUrl,
} from './magic-link-service.js';

describe('MagicLinkService', () => {
  beforeEach(() => {
    delete (global as unknown as { lastMagicLink?: string }).lastMagicLink;
  });

  it('carries the encrypted role in the callback path so Better Auth callback query normalization cannot strip it', async () => {
    let capturedBody: { callbackURL: string } | undefined;
    const auth = {
      options: { baseURL: 'http://127.0.0.1:3130' },
      handler: jest.fn(async (request: Request) => {
        const body = (await request.json()) as { callbackURL: string };
        capturedBody = body;
        (global as unknown as { lastMagicLink?: string }).lastMagicLink =
          `${body.callbackURL}?token=generated`;
        return new Response(null, { status: 200 });
      }),
    } as unknown as ConstructorParameters<typeof MagicLinkService>[0];
    const cryptoService = {
      encrypt: jest
        .fn<CryptoService['encrypt']>()
        .mockResolvedValue('encrypted.role_segment-token'),
    } as unknown as CryptoService;

    await new MagicLinkService(auth, cryptoService).generateMagicLink('admin@example.com', 'admin');

    expect(capturedBody?.callbackURL).toBe(
      'http://127.0.0.1:3130/auth/magic-link-success/encrypted.role_segment-token'
    );
    expect(capturedBody?.callbackURL).not.toContain('?role=');
  });
});

describe('toMagicLinkVerifyUrl', () => {
  it('rewrites the pre-confirm page to Better Auth verify while keeping token and callback', () => {
    const confirm =
      'https://owox-data-marts-oweb.vercel.app/auth/magic-link?token=abc&callbackURL=https%3A%2F%2Fowox-data-marts-oweb.vercel.app%2Fauth%2Fmagic-link-success%2Frole';

    const verify = toMagicLinkVerifyUrl(confirm);
    const url = new URL(verify);

    expect(url.pathname).toBe(MAGIC_LINK_VERIFY_PATH);
    expect(url.searchParams.get('token')).toBe('abc');
    expect(url.searchParams.get('callbackURL')).toBe(
      'https://owox-data-marts-oweb.vercel.app/auth/magic-link-success/role'
    );
  });

  it('is idempotent for an already-verify URL', () => {
    const verify =
      'https://example.test/auth/better-auth/magic-link/verify?token=t&callbackURL=%2F';
    expect(toMagicLinkVerifyUrl(verify)).toBe(verify);
  });

  it('returns the original string when the value is not a URL', () => {
    expect(toMagicLinkVerifyUrl('not a url')).toBe('not a url');
  });
});
