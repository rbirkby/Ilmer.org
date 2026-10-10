import { bindings, defineConfig, exports } from 'cf/config';

const worker = 'ilmer-poppy';
const local = process.env.ILMER_POPPY_LOCAL === 'true';

// Built and run by the cf CLI through @cloudflare/vite-plugin (see vite.config.ts).
export default defineConfig({
  worker: {
    name: worker,
    entrypoint: 'src/index.ts',
    compatibilityDate: '2026-10-09',
    compatibilityFlags: ['nodejs_compat'],
    // poppy.ilmer.org is attached as a Workers custom domain by cf-config (modules/ilmer-org).
    workersDev: false,
    previewUrls: false,
    // Everything else is a static asset (Vite's dev server locally). '/' runs the Worker to set the visitor
    // cookie; /corpus.json runs it so the knowledge corpus is not served publicly.
    assets: {
      runWorkerFirst: ['/', '/api/*', '/oauth/*', '/poppy/*', '/.well-known/*', '/robots.txt', '/corpus.json']
    },
    observability: { enabled: true, headSamplingRate: 1 },
    exports: {
      HistoryAgent: exports.durableObject({ storage: 'sqlite' }),
      PoppyClient: exports.durableObject({ storage: 'sqlite' }),
      Guard: exports.durableObject({ storage: 'sqlite' })
    },
    env: {
      ASSETS: bindings.assets(),
      ORIGIN: bindings.text(local ? 'http://localhost:8787' : 'https://poppy.ilmer.org'),
      SITE_URL: bindings.text('https://www.ilmer.org'),
      LOCAL_DEV: bindings.text(local ? 'true' : 'false'),
      MODEL: bindings.text(process.env.ILMER_POPPY_MODEL ?? '@cf/moonshotai/kimi-k2.7-code'),
      DAILY_PROMPT_LIMIT: bindings.text(process.env.ILMER_POPPY_DAILY_PROMPT_LIMIT ?? '500'),
      AGENTS: bindings.durableObject({ worker, exportName: 'HistoryAgent' }),
      CLIENTS: bindings.durableObject({ worker, exportName: 'PoppyClient' }),
      GUARDS: bindings.durableObject({ worker, exportName: 'Guard' }),
      // Workers AI always runs remotely. ILMER_POPPY_OFFLINE=true leaves it out so dev starts without a
      // Cloudflare login: everything works except model answers.
      ...(process.env.ILMER_POPPY_OFFLINE === 'true' ? {} : { AI: bindings.ai({ dev: { remote: true } }) })
    }
  }
});
