import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

declare global {
  // eslint-disable-next-line no-var -- serverless warm-start cache
  var __owoxExpressHandler: Promise<ExpressHandler> | undefined;
}

async function getHandler(): Promise<ExpressHandler> {
  if (!globalThis.__owoxExpressHandler) {
    globalThis.__owoxExpressHandler = (async () => {
      const { applyServerlessEnvDefaults } = await import(
        '../apps/owox/dist/oweb/serverless-env.js'
      );
      applyServerlessEnvDefaults();
      const { createOwoxApp } = await import('../apps/owox/dist/create-app.js');
      const { express } = await createOwoxApp({ listen: false, webEnabled: true });
      return express as unknown as ExpressHandler;
    })().catch((error: unknown) => {
      globalThis.__owoxExpressHandler = undefined;
      throw error;
    });
  }

  return globalThis.__owoxExpressHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const app = await getHandler();
    await Promise.resolve(app(req, res));
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('OWOX serverless handler failed', err.stack ?? err.message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(`${err.name}: ${err.message}\n${err.stack ?? ''}`);
    }
  }
}
