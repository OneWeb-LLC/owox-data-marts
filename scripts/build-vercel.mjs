#!/usr/bin/env node
/**
 * Bundle the Vercel serverless handler to CommonJS.
 *
 * Nest compiles to CJS and then require()s ESM workspace packages
 * (idp-protocol, better-auth, …). Vercel's Node runtime does not support
 * require(esm), so we convert the graph with esbuild after `npm run build:owox`.
 *
 * Heavy CJS SDKs, native addons, and the connector runner stay external so
 * the function stays under Vercel's size limits and .node files are not parsed.
 */
import { mkdirSync, readFileSync } from 'node:fs';
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
  // TypeORM column metadata is stored on class fields; identifier minification
  // produces invalid SQLite like `CREATE TABLE x ()`.
  minify: false,
  keepNames: true,
  // Native addons, optional Nest/TypeORM drivers, and large CJS SDKs. esbuild
  // cannot load .node kernels; Hugging Face / cloud SDKs bloat the function.
  external: [
    '*.node',
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
    '@aws-sdk/*',
    '@google-cloud/*',
    'googleapis',
    'google-auth-library',
    'google-gax',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'snowflake-sdk',
    '@huggingface/transformers',
    'onnxruntime-node',
    'swagger-ui-express',
    '@nestjs/microservices',
    '@nestjs/websockets',
    '@nestjs/platform-socket.io',
    'class-transformer/storage',
    'fsevents',
    'lz4',
    'cpu-features',
    '@databricks/sql',
    '@databricks/*',
    '@owox/connectors',
    '@owox/connectors/runner',
  ],
  plugins: [
    {
      name: 'polyfill-import-meta-url',
      setup(build) {
        // CJS output blanks import.meta.url; rewrite it before that happens so
        // idp template loaders do not call fileURLToPath(undefined).
        build.onLoad({ filter: /\.[cm]?[jt]s$/ }, args => {
          let contents;
          try {
            contents = readFileSync(args.path, 'utf8');
          } catch {
            return undefined;
          }
          if (!contents.includes('import.meta.url')) {
            return undefined;
          }
          return {
            contents: contents.replaceAll('import.meta.url', JSON.stringify(`file://${args.path}`)),
            loader: args.path.endsWith('.ts') ? 'ts' : 'js',
          };
        });
      },
    },
    {
      name: 'external-native-addons',
      setup(build) {
        build.onResolve({ filter: /\.node$/ }, args => ({
          path: args.path,
          external: true,
        }));
      },
    },
  ],
});

console.log(`Wrote ${outfile}`);
