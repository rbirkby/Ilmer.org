import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';

/** Writes public/corpus.json from the built Ilmer site before Vite copies public/ into the assets. */
function corpus(): Plugin {
  return {
    name: 'ilmer-corpus',
    applyToEnvironment: (environment) => environment.name === 'client',
    buildStart() {
      execFileSync(process.execPath, ['scripts/build-corpus.mjs'], { stdio: 'inherit' });
    }
  };
}

export default defineConfig({
  plugins: [corpus(), react(), tailwindcss(), cloudflare()],
  build: { chunkSizeWarningLimit: 1100 },
  // Matches ORIGIN in cloudflare.config.ts for local dev (CSRF and DPoP checks use it).
  server: { port: 8787, strictPort: true }
});
