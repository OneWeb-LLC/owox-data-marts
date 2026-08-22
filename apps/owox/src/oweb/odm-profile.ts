export type QueryableDataSource = {
  isInitialized: boolean;
  query: (sql: string, parameters?: unknown[]) => Promise<unknown>;
};

export type OdmProfileInput = {
  id: string;
  oneId?: string | null;
  email?: string | null;
  fullName?: string | null;
  orgId?: string | null;
};

/**
 * Local OneID projection (`odm_profiles`). Namespaced so it never collides with `ao_*`.
 * Uses raw SQL so this CLI package does not depend on backend entity exports.
 */
export async function upsertOdmProfile(
  dataSource: QueryableDataSource | undefined,
  input: OdmProfileInput
): Promise<void> {
  if (!dataSource?.isInitialized) {
    return;
  }

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

  try {
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
  } catch {
    // MySQL uses a different upsert dialect; try that if sqlite conflict syntax fails.
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
  }
}
