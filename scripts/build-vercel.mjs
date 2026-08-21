#!/usr/bin/env node
/**
 * Bundle the Vercel serverless handler to CommonJS.
 *
 * Nest compiles to CJS and then require()s ESM workspace packages
 * (idp-protocol, better-auth, …). Vercel's Node runtime does not support
 * require(esm), so we convert the graph with esbuild after `npm run build:owox`.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outfile = join(root, 'api', 'index.js');

mkdirSync(dirname(outfile), { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'scripts', 'vercel-api.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile,
  logLevel: 'info',
  legalComments: 'none',
  sourcemap: false,
  keepNames: true,
  // Native addons and optional Nest/TypeORM packages that esbuild cannot bundle.
  external: [
    'better-sqlite3',
    'mysql2',
    'sqlite3',
    'pg',
    'pg-native',
    'pg-query-stream',
    'oracledb',
    'mssql',
    'mongodb',
    'redis',
    'sql.js',
    'hdb-pool',
    'typeorm-aurora-data-api-driver',
    'react-native-sqlite-storage',
    'nock',
    'mock-aws-s3',
    'aws-sdk',
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
    'class-transformer/storage',
    'fsevents',
    'onnxruntime-node',
    'lz4',
    'cpu-features',
  ],
});

console.log(`Wrote ${outfile}`);
