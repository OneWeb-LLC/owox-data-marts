// Placeholder overwritten by `npm run build:vercel` (esbuild CJS bundle).
module.exports = function handler(_req, res) {
  res.statusCode = 503;
  res.end('OWOX Data Marts is still building');
};
