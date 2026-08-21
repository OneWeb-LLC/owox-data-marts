import type { IncomingMessage, ServerResponse } from 'node:http';

type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

declare global {
  // eslint-disable-next-line no-var -- serverless warm-start cache
  var __owoxExpressHandler: Promise<ExpressHandler> | undefined;
}

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 300,
};

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
    })();
  }

  return globalThis.__owoxExpressHandler;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getHandler();
  app(req, res);
}
