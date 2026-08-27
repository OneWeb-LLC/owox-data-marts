export type QueryableDataSource = {
  isInitialized: boolean;
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>;
};

export type OdmProfileInput = {
  email?: null | string;
  fullName?: null | string;
  id: string;
  oneId?: null | string;
  orgId?: null | string;
};

function isMysqlDialect(): boolean {
  return (process.env.DB_TYPE ?? 'sqlite').toLowerCase() === 'mysql';
}

function isMissingTableError(message: string): boolean {
  return (
    message.includes('no such table') ||
    message.includes("doesn't exist") ||
    message.includes('does not exist')
  );
}

/** Ensure the local OneID projection table exists (Vercel skips file migrations). */
export async function ensureOdmProfilesTable(dataSource: QueryableDataSource): Promise<void> {
  if (isMysqlDialect()) {
    await dataSource.query(
      `CREATE TABLE IF NOT EXISTS odm_profiles (
         id varchar(255) NOT NULL PRIMARY KEY,
         one_id varchar(255) NULL,
         email varchar(255) NULL,
         full_name varchar(255) NULL,
         org_id varchar(255) NULL,
         createdAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
         modifiedAt datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
       )`
    );
    return;
  }

  await dataSource.query(
    `CREATE TABLE IF NOT EXISTS odm_profiles (
       id varchar PRIMARY KEY NOT NULL,
       one_id varchar,
       email varchar,
       full_name varchar,
       org_id varchar,
       createdAt datetime NOT NULL DEFAULT (datetime('now')),
       modifiedAt datetime NOT NULL DEFAULT (datetime('now'))
     )`
  );
}

async function upsertOdmProfileRow(
  dataSource: QueryableDataSource,
  input: OdmProfileInput
): Promise<void> {
  const now = new Date().toISOString();
  const params = [
    input.id,
    input.oneId ?? null,
    input.email ?? null,
    input.fullName ?? null,
    input.orgId ?? null,
    now,
    now,
  ];

  if (isMysqlDialect()) {
    await dataSource.query(
      `INSERT INTO odm_profiles (id, one_id, email, full_name, org_id, createdAt, modifiedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         one_id = VALUES(one_id),
         email = VALUES(email),
         full_name = VALUES(full_name),
         org_id = VALUES(org_id),
         modifiedAt = VALUES(modifiedAt)`,
      params
    );
    return;
  }

  await dataSource.query(
    `INSERT INTO odm_profiles (id, one_id, email, full_name, org_id, createdAt, modifiedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       one_id = excluded.one_id,
       email = excluded.email,
       full_name = excluded.full_name,
       org_id = excluded.org_id,
       modifiedAt = excluded.modifiedAt`,
    params
  );
}

/**
 * Local OneID projection (`odm_profiles`). Namespaced so it never collides with `ao_*`.
 * Uses raw SQL so this CLI package does not depend on backend entity exports.
 * Failures are non-fatal so sign-in is not blocked by profile sync.
 */
export async function upsertOdmProfile(
  dataSource: QueryableDataSource | undefined,
  input: OdmProfileInput
): Promise<void> {
  if (!dataSource?.isInitialized) {
    return;
  }

  try {
    await upsertOdmProfileRow(dataSource, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isMissingTableError(message)) {
      console.warn(`[oweb] odm profile upsert failed: ${message}`);
      return;
    }

    try {
      await ensureOdmProfilesTable(dataSource);
      await upsertOdmProfileRow(dataSource, input);
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError);
      console.warn(`[oweb] odm profile upsert failed: ${retryMessage}`);
    }
  }
}
