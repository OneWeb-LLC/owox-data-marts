import { createHash } from 'node:crypto';

import { supabaseRest } from './supabase.js';
import { getOwebAppId } from './constants.js';

export type RedeemLaunchTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  orgId: string;
  userId: string;
};

type LaunchTokenRow = {
  id: string;
  app_id: string;
  org_id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  consumed_at: string | null;
};

export function hashLaunchToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Redeem a one-time OWeb ecosystem launch token (server-only). */
export async function redeemEcosystemLaunchToken(
  launchToken: string
): Promise<RedeemLaunchTokenResult> {
  const trimmed = launchToken.trim();
  if (!trimmed) {
    throw new Error('missing_launch_token');
  }

  const tokenHash = hashLaunchToken(trimmed);
  const now = new Date().toISOString();
  const appId = getOwebAppId();

  const rows = await supabaseRest<LaunchTokenRow[]>('ao_ecosystem_launch_tokens', {
    method: 'GET',
    search: {
      select: 'id,app_id,org_id,user_id,access_token,refresh_token,expires_at,consumed_at',
      token_hash: `eq.${tokenHash}`,
      limit: '1',
    },
  });

  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) {
    throw new Error('invalid_launch_token');
  }

  if (row.consumed_at) {
    throw new Error('launch_token_consumed');
  }

  if (row.expires_at <= now) {
    throw new Error('launch_token_expired');
  }

  if (row.app_id !== appId) {
    throw new Error('launch_token_wrong_app');
  }

  await supabaseRest(
    `ao_ecosystem_launch_tokens?id=eq.${encodeURIComponent(row.id)}&consumed_at=is.null`,
    {
      method: 'PATCH',
      body: JSON.stringify({ consumed_at: now }),
    }
  );

  return {
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    orgId: row.org_id,
    userId: row.user_id,
  };
}
