import type { NestExpressApplication } from '@nestjs/platform-express';
import type { BootstrapOptions, HealthProbeAware } from '@owox/backend';
import { BetterAuthProvider } from '@owox/idp-better-auth';
import type { IdpProvider } from '@owox/idp-protocol';
import { IdpProtocolMiddleware } from '@owox/idp-protocol';
import cors from 'cors';
import express, { type Express } from 'express';

import { createIdpFactoryHost, IdpFactory, type IdpFactoryHost } from './idp/factory.js';
import { registerOwebSsoRoute } from './oweb/sso-route.js';
import { applyServerlessEnvDefaults } from './oweb/serverless-env.js';
import {
  buildCorsConfig,
  registerHealthRoutes,
  registerPublicFlagsRoute,
  setupWebStaticAssets,
} from './web/index.js';

export type CreateOwoxAppOptions = {
  listen?: boolean;
  webEnabled?: boolean;
  host?: IdpFactoryHost;
  isShuttingDown?: () => boolean;
  log?: (message: string) => void;
  warn?: (message: string) => void;
};

export type OwoxApp = {
  express: Express;
  nestApp: NestExpressApplication;
  idpProvider: IdpProvider;
};

/**
 * Assemble the Express + IDP + Nest application used by `owox serve` and Vercel.
 */
export async function createOwoxApp(options: CreateOwoxAppOptions = {}): Promise<OwoxApp> {
  applyServerlessEnvDefaults();

  const listen = options.listen !== false;
  const webEnabled = options.webEnabled !== false;
  const log = options.log ?? ((message: string) => console.log(message));
  const warn = options.warn ?? ((message: string) => console.warn(message));

  const { bootstrap, createHealthProbe, getMainDataSource, registerPluginCollectionsBodyParser } =
    await import('@owox/backend');

  const expressApp = express();
  // Must precede IDP middleware: some providers install Express's default 100 KiB
  // JSON parser globally, while plugin collection documents are allowed up to 1 MiB.
  registerPluginCollectionsBodyParser(expressApp);
  expressApp.set('trust proxy', 1);

  const corsConfig = buildCorsConfig();
  expressApp.use(cors(corsConfig));

  let currentIdp: IdpProvider | null = null;
  let currentBackendApp: HealthProbeAware | null = null;
  let nestApp: NestExpressApplication | undefined;
  registerHealthRoutes(
    expressApp,
    () => currentIdp,
    () => currentBackendApp,
    () => options.isShuttingDown?.() ?? false
  );

  const idpProvider = await IdpFactory.createFromEnvironment(
    options.host ?? createIdpFactoryHost()
  );
  await idpProvider.initialize();
  const idpProtocolMiddleware = new IdpProtocolMiddleware(idpProvider);
  idpProtocolMiddleware.register(expressApp);
  expressApp.set('idp', idpProvider);
  currentIdp = idpProvider;

  registerOwebSsoRoute(expressApp, () => currentIdp, () => {
    if (!nestApp) {
      return undefined;
    }

    try {
      return getMainDataSource(nestApp);
    } catch {
      return undefined;
    }
  });

  registerPublicFlagsRoute(expressApp);

  if (webEnabled) {
    const staticAssetsConfigured = setupWebStaticAssets(expressApp);
    if (staticAssetsConfigured) {
      log('Web interface static assets configured');
    } else {
      warn(' Web static assets not found, continuing without web interface');
    }
  } else {
    log('Web interface disabled');
  }

  nestApp = await bootstrap({ express: expressApp, listen } as BootstrapOptions);
  currentBackendApp = createHealthProbe(nestApp);

  return { express: expressApp, nestApp, idpProvider };
}

export function isBetterAuthProvider(provider: IdpProvider): provider is BetterAuthProvider {
  return typeof (provider as BetterAuthProvider).signInWithOwebUser === 'function';
}
