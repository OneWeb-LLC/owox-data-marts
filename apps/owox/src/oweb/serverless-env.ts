/**
 * Apply Vercel / serverless defaults so the Nest + better-auth stack can boot
 * without a writable home directory or a pre-set PUBLIC_ORIGIN.
 */
export function applyServerlessEnvDefaults(): void {
  if (!process.env.PUBLIC_ORIGIN?.trim()) {
    const host =
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      process.env.VERCEL_URL ||
      process.env.VERCEL_BRANCH_URL;
    if (host) {
      process.env.PUBLIC_ORIGIN = host.startsWith('http') ? host : `https://${host}`;
    }
  }

  if (!process.env.PORT) {
    process.env.PORT = '3000';
  }

  if (!process.env.LOG_FORMAT) {
    process.env.LOG_FORMAT = 'json';
  }

  if (process.env.VERCEL) {
    process.env.SQLITE_DB_PATH ||= '/tmp/owox/app.db';
    process.env.PLUGIN_COLLECTIONS_SQLITE_DB_PATH ||= '/tmp/owox/plugin-collections.db';
    process.env.IDP_BETTER_AUTH_SQLITE_DB_PATH ||= '/tmp/owox/idp.db';
    process.env.SCHEDULER_EXECUTION_ENABLED ||= 'false';
    process.env.OWOX_TELEMETRY_DISABLED ||= '1';
  }
}
