import { expect } from 'chai';

import {
  ensureOdmProfilesTable,
  type QueryableDataSource,
  upsertOdmProfile,
} from '../../src/oweb/odm-profile.js';

type QueryMock = QueryableDataSource['query'] & {
  calls: Array<{ params?: unknown[]; sql: string }>;
};

function createQueryMock(
  implementation?: (sql: string, parameters?: unknown[]) => Promise<unknown>
): QueryMock {
  const calls: Array<{ params?: unknown[]; sql: string }> = [];
  const query = (async (sql: string, parameters?: unknown[]) => {
    calls.push({ params: parameters, sql });
    if (implementation) {
      return implementation(sql, parameters);
    }
  }) as QueryMock;
  query.calls = calls;
  return query;
}

function createDataSource(query: QueryMock): QueryableDataSource {
  return {
    isInitialized: true,
    query,
  };
}

describe('odm-profile', () => {
  describe('upsertOdmProfile', () => {
    const originalDbType = process.env.DB_TYPE;
    let warnMessages: string[] = [];
    let originalWarn: typeof console.warn;

    beforeEach(() => {
      warnMessages = [];
      originalWarn = console.warn.bind(console);
      console.warn = ((message?: unknown, ...args: unknown[]) => {
        warnMessages.push(String(message));
        originalWarn(message, ...args);
      }) as typeof console.warn;
    });

    afterEach(() => {
      console.warn = originalWarn;
      if (originalDbType === undefined) {
        delete process.env.DB_TYPE;
      } else {
        process.env.DB_TYPE = originalDbType;
      }
    });

    it('uses sqlite upsert syntax by default', async () => {
      const query = createQueryMock();
      await upsertOdmProfile(createDataSource(query), {
        email: 'user@example.com',
        fullName: 'User',
        id: 'user-1',
      });

      expect(query.calls).to.have.length(1);
      expect(query.calls[0]?.sql).to.contain('ON CONFLICT(id) DO UPDATE SET');
      expect(query.calls[0]?.sql).to.not.contain('ON DUPLICATE KEY UPDATE');
    });

    it('uses mysql upsert syntax when DB_TYPE=mysql', async () => {
      process.env.DB_TYPE = 'mysql';
      const query = createQueryMock();
      await upsertOdmProfile(createDataSource(query), {
        email: 'user@example.com',
        id: 'user-1',
      });

      expect(query.calls).to.have.length(1);
      expect(query.calls[0]?.sql).to.contain('ON DUPLICATE KEY UPDATE');
    });

    it('creates the table and retries when sqlite reports a missing table', async () => {
      let attempt = 0;
      const query = createQueryMock(async _sql => {
        attempt += 1;
        if (attempt === 1) {
          throw new Error('SQLITE_ERROR: no such table: odm_profiles');
        }
      });

      await upsertOdmProfile(createDataSource(query), {
        email: 'user@example.com',
        id: 'user-1',
      });

      expect(query.calls).to.have.length(3);
      expect(query.calls[1]?.sql).to.contain('CREATE TABLE IF NOT EXISTS odm_profiles');
      expect(query.calls[2]?.sql).to.contain('ON CONFLICT(id) DO UPDATE SET');
      expect(warnMessages).to.have.length(0);
    });

    it('does not throw when profile sync ultimately fails', async () => {
      const query = createQueryMock(async () => {
        throw new Error('database locked');
      });

      await upsertOdmProfile(createDataSource(query), {
        email: 'user@example.com',
        id: 'user-1',
      });

      expect(warnMessages).to.have.length(1);
      expect(warnMessages[0]).to.contain('[oweb] odm profile upsert failed: database locked');
    });
  });

  describe('ensureOdmProfilesTable', () => {
    it('creates sqlite table DDL when DB_TYPE is not mysql', async () => {
      delete process.env.DB_TYPE;
      const query = createQueryMock();

      await ensureOdmProfilesTable(createDataSource(query));

      expect(query.calls[0]?.sql).to.contain('CREATE TABLE IF NOT EXISTS odm_profiles');
      expect(query.calls[0]?.sql).to.contain("datetime('now')");
    });
  });
});
