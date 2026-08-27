import { BetterAuthProvider } from '@owox/idp-better-auth';
import type { IdpProvider } from '@owox/idp-protocol';

import { activateOwoxApp } from './activate.js';
import { upsertOdmProfile, type QueryableDataSource } from './odm-profile.js';
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

/**
 * Shared post-auth steps for SSO and native OneID login:
 * activate app (D13), upsert local profile, bridge into Better Auth session.
 */
export async function completeSatelliteLogin(params: {
  userId: string;
  accessToken: string;
  orgId?: string | null;
  getIdp: () => IdpProvider | null;
  getDataSource: () => QueryableDataSource | undefined;
}): Promise<string> {
  const authUser = await supabaseAuthGetUser<AuthUser>(params.accessToken);
  const email = authUser.email?.trim();
  if (!email) {
    throw new Error('oweb_user_missing_email');
  }

  const userId = params.userId || authUser.id;
  if (!userId) {
    throw new Error('oweb_user_missing_id');
  }

  const fullName =
    authUser.user_metadata?.full_name ||
    authUser.user_metadata?.name ||
    authUser.user_metadata?.one_id ||
    email;
  const oneId = authUser.user_metadata?.one_id ?? null;

  await activateOwoxApp(userId);
  await upsertOdmProfile(params.getDataSource(), {
    id: userId,
    oneId,
    email,
    fullName,
    orgId: params.orgId ?? null,
  });

  const idp = params.getIdp();
  if (!idp || !providerSupportsOwebSignIn(idp)) {
    throw new Error('idp_provider_does_not_support_oweb_sso');
  }

  return idp.signInWithOwebUser(email, fullName);
}
