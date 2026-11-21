import { cp, readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(here, '../../packages/icons/generated/svg');

/**
 * Serve the generated icon SVGs at /icons/* in dev and copy them into dist/icons at build.
 * Icons are long-cache static assets; Caddy sets immutable caching in production.
 */
function iconsPlugin(): Plugin {
  return {
    name: 'archboard-icons',
    configureServer(server) {
      server.middlewares.use('/icons', async (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '').split('?')[0] ?? ''));
        if (!rel.endsWith('.svg') || rel.includes('..')) return next();
        try {
          const file = join(iconsDir, rel);
          await stat(file);
          res.setHeader('Content-Type', 'image/svg+xml');
          res.end(await readFile(file));
        } catch {
          next();
        }
      });
    },
    async writeBundle(options) {
      const outDir = options.dir ?? resolve(here, 'dist');
      await cp(iconsDir, join(outDir, 'icons'), { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), iconsPlugin()],
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': { target: 'ws://localhost:4000', ws: true },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
