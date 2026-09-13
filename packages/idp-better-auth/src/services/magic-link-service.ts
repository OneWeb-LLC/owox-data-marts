import { betterAuth } from 'better-auth';
import { CryptoService } from './crypto-service.js';

export const MAGIC_LINK_CONFIRM_PATH = '/auth/magic-link';
export const MAGIC_LINK_VERIFY_PATH = '/auth/better-auth/magic-link/verify';

/**
 * The email flow rewrites Better Auth's verify URL to a GET-only confirm page
 * so scanners cannot consume the token. After an already-authenticated login
 * (OWeb satellite / SSO) the confirm step is unnecessary — convert back to
 * the Better Auth verify endpoint so the session can be established.
 */
export function toMagicLinkVerifyUrl(magicLink: string): string {
  try {
    const url = new URL(magicLink);
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    if (pathname === MAGIC_LINK_CONFIRM_PATH) {
      url.pathname = MAGIC_LINK_VERIFY_PATH;
    }
    return url.toString();
  } catch {
    return magicLink;
  }
}

export class MagicLinkService {
  private static readonly DEFAULT_CALLBACK_URL = '/auth/magic-link-success';

  constructor(
    private readonly auth: Awaited<ReturnType<typeof betterAuth>>,
    private readonly cryptoService: CryptoService
  ) {}

  async generateMagicLink(
    email: string,
    role: 'admin' | 'editor' | 'viewer' = 'admin'
  ): Promise<string> {
    // Clear previous magic link
    delete (global as unknown as { lastMagicLink?: string }).lastMagicLink;

    // Generate magic link directly through Better Auth internals
    const baseUrlConfig = this.auth.options.baseURL;
    const baseURL =
      typeof baseUrlConfig === 'string'
        ? baseUrlConfig
        : (baseUrlConfig as { fallback?: string } | undefined)?.fallback || 'http://localhost:3000';
    const encodedRole = await this.cryptoService.encrypt(role);

    const callbackURL = `${baseURL}${MagicLinkService.DEFAULT_CALLBACK_URL}/${encodeURIComponent(
      encodedRole
    )}`;
    // Create a mock Request object for Better Auth
    const mockRequest = new Request(`${baseURL}/auth/better-auth/sign-in/magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email,
        callbackURL: callbackURL,
      }),
    });

    // Call Better Auth handler directly
    const response = await this.auth.handler(mockRequest);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Magic link generation failed: ${response.status} ${errorText}`);
    }

    // Wait a moment for the sendMagicLink callback to be called
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get the generated magic link from global storage
    const magicLink = (global as unknown as { lastMagicLink?: string }).lastMagicLink;

    if (!magicLink) {
      throw new Error('Magic link generation failed - no link received');
    }

    return magicLink;
  }
}
