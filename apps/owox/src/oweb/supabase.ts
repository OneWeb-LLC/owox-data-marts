function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value.replace(/\/$/, '');
}

function getSupabaseUrl(): string {
  return requireEnv('SUPABASE_URL');
}

function getServiceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

function getPublishableKey(): string {
  return (
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    getServiceRoleKey()
  );
}

function adminHeaders(): Record<string, string> {
  const serviceRole = getServiceRoleKey();
  return {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    'Content-Type': 'application/json',
  };
}

export async function supabaseRest<T>(
  path: string,
  init: RequestInit & { search?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(`${getSupabaseUrl()}/rest/v1/${path.replace(/^\//, '')}`);
  for (const [key, value] of Object.entries(init.search ?? {})) {
    url.searchParams.set(key, value);
  }

  const { search: _search, ...requestInit } = init;
  const response = await fetch(url, {
    ...requestInit,
    headers: {
      ...adminHeaders(),
      Prefer: 'return=representation',
      ...(requestInit.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_rest_${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function supabaseAuthAdmin<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getSupabaseUrl()}/auth/v1/${path.replace(/^\//, '')}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_auth_${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export async function supabaseAuthGetUser<T>(accessToken: string): Promise<T> {
  const url = `${getSupabaseUrl()}/auth/v1/user`;
  const response = await fetch(url, {
    headers: {
      apikey: getPublishableKey(),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_user_${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export type SupabasePasswordSession = {
  access_token: string;
  refresh_token?: string;
  user: { id: string; email?: string };
};

/** Authenticate against shared One OS Supabase Auth (D12). */
export async function supabaseSignInWithPassword(
  email: string,
  password: string
): Promise<SupabasePasswordSession> {
  const url = `${getSupabaseUrl()}/auth/v1/token?grant_type=password`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: getPublishableKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`supabase_password_${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    user: { id: string; email?: string };
  };

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user: { id: data.user.id, email: data.user.email },
  };
}

/** True when the OneID has at least one active workspace membership (D14). */
export async function userHasWorkspace(userId: string): Promise<boolean> {
  try {
    const rows = await supabaseRest<{ org_id: string }[]>('ao_org_members', {
      method: 'GET',
      search: {
        select: 'org_id',
        user_id: `eq.${userId}`,
        left_at: 'is.null',
        limit: '1',
      },
    });
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[oweb] workspace check failed: ${message}`);
    return false;
  }
}
