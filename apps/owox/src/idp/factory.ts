import {
  BetterAuthProvider,
  CustomDatabaseConfig,
  MySqlConfig,
  SqliteConfig,
} from '@owox/idp-better-auth';
import { loadBetterAuthProviderConfigFromEnv, OwoxBetterAuthIdp } from '@owox/idp-owox-better-auth';
import { IdpConfig, IdpProvider, NullIdpProvider } from '@owox/idp-protocol';
import { parseMysqlSslEnv } from '@owox/internal-helpers';

import { resolvePublicOrigin } from '../utils/public-origin.js';

/**
 * Minimal host used by {@link IdpFactory} to report fatal configuration errors.
 * CLI commands pass `this` (oclif `Command.error`); serverless uses {@link createIdpFactoryHost}.
 */
export interface IdpFactoryHost {
  error(input: Error | string, options?: { code?: string; exit?: false | number }): never;
}

export function createIdpFactoryHost(): IdpFactoryHost {
  return {
    error(input: Error | string): never {
      throw typeof input === 'string' ? new Error(input) : input;
    },
  };
}

export enum IdpProviderType {
  BetterAuth = 'better-auth',
  None = 'none',
  OwoxBetterAuth = 'owox-better-auth',
}

export interface IdpFactoryOptions {
  config?: Partial<IdpConfig>;
  provider: IdpProviderType;
}

/**
 * Factory for creating IDP providers based on configuration
 */
export class IdpFactory {
  static async createFromEnvironment(host: IdpFactoryHost): Promise<IdpProvider> {
    const providerType = (process.env.IDP_PROVIDER || IdpProviderType.None) as IdpProviderType;
    return this.createProvider(
      {
        provider: providerType,
      },
      host
    );
  }

  /**
   * Create an IDP provider instance based on the provider type
   */
  static async createProvider(
    options: IdpFactoryOptions,
    host: IdpFactoryHost
  ): Promise<IdpProvider> {
    const { provider } = options;

    switch (provider) {
      case IdpProviderType.BetterAuth: {
        return this.createBetterAuthProvider(host);
      }

      case IdpProviderType.None: {
        return this.createNullProvider();
      }

      case IdpProviderType.OwoxBetterAuth: {
        return this.createOwoxBetterAuthProvider(host);
      }

      default: {
        throw new Error(`Unknown IDP provider: ${provider}`);
      }
    }
  }

  /**
   * Build BetterAuth MySQL config using prioritized environment variables.
   * Priority: IDP_BETTER_AUTH_MYSQL_*, DB_*.
   */
  private static buildBetterAuthMySqlConfig(): MySqlConfig {
    const ssl = parseMysqlSslEnv(process.env.IDP_BETTER_AUTH_MYSQL_SSL || process.env.DB_MYSQL_SSL);

    const host = process.env.IDP_BETTER_AUTH_MYSQL_HOST || process.env.DB_HOST;
    const user = process.env.IDP_BETTER_AUTH_MYSQL_USER || process.env.DB_USERNAME;
    const password = process.env.IDP_BETTER_AUTH_MYSQL_PASSWORD || process.env.DB_PASSWORD;
    const databaseName = process.env.IDP_BETTER_AUTH_MYSQL_DATABASE || process.env.DB_DATABASE;
    const port = Number.parseInt(
      (process.env.IDP_BETTER_AUTH_MYSQL_PORT || process.env.DB_PORT) as string,
      10
    );

    return {
      database: databaseName as string,
      host: host as string,
      password: password as string,
      port,
      type: 'mysql',
      user: user as string,
      ...(ssl === undefined ? {} : { ssl }),
    } satisfies MySqlConfig as MySqlConfig;
  }

  private static async createBetterAuthProvider(host: IdpFactoryHost): Promise<BetterAuthProvider> {
    if (!process.env.IDP_BETTER_AUTH_SECRET) {
      host.error('IDP_BETTER_AUTH_SECRET is not set');
    }

    // Database configuration
    const databaseType = (process.env.IDP_BETTER_AUTH_DATABASE_TYPE ||
      process.env.DB_TYPE ||
      'sqlite') as 'custom' | 'mysql' | 'sqlite';

    let database: CustomDatabaseConfig | MySqlConfig | SqliteConfig;
    switch (databaseType) {
      case 'custom': {
        database = {
          adapter: undefined,
          type: 'custom' as const,
        };
        break;
      }

      case 'mysql': {
        database = this.buildBetterAuthMySqlConfig();
        break;
      }

      case 'sqlite': {
        database = {
          filename: process.env.IDP_BETTER_AUTH_SQLITE_DB_PATH,
          type: 'sqlite' as const,
        };
        break;
      }

      default: {
        host.error(`Unsupported database type: ${databaseType}`);
      }
    }

    const baseURL = process.env.IDP_BETTER_AUTH_BASE_URL || resolvePublicOrigin();

    const trustedOrigins = (() => {
      const list = process.env.IDP_BETTER_AUTH_TRUSTED_ORIGINS;
      if (list && list.trim() !== '') {
        return list
          .split(',')
          .map(origin => origin.trim())
          .filter(Boolean);
      }

      const fallback = baseURL;
      return fallback && fallback.trim() !== '' ? [fallback] : undefined;
    })();

    return BetterAuthProvider.create({
      baseURL,
      database,
      magicLinkTtl: Number.parseInt(
        (process.env.IDP_BETTER_AUTH_MAGIC_LINK_TTL || '3600') as string,
        10
      ),
      primaryAdminEmail: process.env.IDP_BETTER_AUTH_PRIMARY_ADMIN_EMAIL,
      secret: process.env.IDP_BETTER_AUTH_SECRET,
      session: {
        maxAge: Number.parseInt(
          (process.env.IDP_BETTER_AUTH_SESSION_MAX_AGE || '604800') as string,
          10
        ),
      },
      trustedOrigins,
    });
  }

  /**
   * Create NULL IDP provider for single-user deployments
   */
  private static async createNullProvider(): Promise<NullIdpProvider> {
    return new NullIdpProvider();
  }

  /**
   * Creates and initializes an OwoxBetterAuth provider using configuration
   * loaded from the environment. On error, logs it and exits the command.
   *
   * @param {IdpFactoryHost} host - Host used to report fatal configuration errors.
   * @returns {Promise<OwoxBetterAuthIdp>} Promise resolving to an initialized OwoxBetterAuth provider.
   */
  private static async createOwoxBetterAuthProvider(
    host: IdpFactoryHost
  ): Promise<OwoxBetterAuthIdp> {
    try {
      const config = loadBetterAuthProviderConfigFromEnv();
      return OwoxBetterAuthIdp.create(config);
    } catch (error: unknown) {
      if (error instanceof Error) {
        host.error(error, { exit: 1 });
      }

      host.error(new Error(String(error)), { exit: 1 });
    }
  }
}
