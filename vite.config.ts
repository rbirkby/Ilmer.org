import { cpSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { build, defineConfig, type Plugin } from 'vite';
import { viteEmptiesOutput } from './scripts/dev-process.ts';

const ROOT = path.resolve('.');
const STABLE_DIR = path.join(ROOT, 'assets/.stable-build');

/**
 * Third-party embeds and the colourise service worker need URLs that do not change
 * between deploys. The app build content-hashes everything under assets/dist, which
 * is cached as immutable, so these two files are written beside it.
 * The field-map file keeps its `init` export. The service worker is a classic script
 * so an existing registration at this URL can update in place.
 */
function stableBrowserFiles(): Plugin {
  return {
    name: 'stable-browser-files',
    apply: 'build',
    async closeBundle() {
      rmSync(STABLE_DIR, { recursive: true, force: true });
      mkdirSync(STABLE_DIR, { recursive: true });
      await build({
        configFile: false,
        publicDir: false,
        logLevel: 'warn',
        build: {
          outDir: STABLE_DIR,
          emptyOutDir: true,
          sourcemap: false,
          minify: 'oxc',
          lib: {
            entry: path.join(ROOT, 'assets/js/ilmer-fields-embed.ts'),
            formats: ['es'],
            fileName: () => 'ilmer-fields-embed.js'
          },
          rolldownOptions: {
            output: { codeSplitting: false }
          }
        }
      });
      await build({
        configFile: false,
        publicDir: false,
        logLevel: 'warn',
        build: {
          outDir: STABLE_DIR,
          emptyOutDir: false,
          sourcemap: false,
          minify: 'oxc',
          lib: {
            entry: path.join(ROOT, 'assets/js/colorize-sw.ts'),
            formats: ['iife'],
            name: 'ilmerColouriseSw',
            fileName: () => 'colorize-sw.js'
          }
        }
      });
      const jsDir = path.join(ROOT, 'assets/js');
      cpSync(path.join(STABLE_DIR, 'ilmer-fields-embed.js'), path.join(jsDir, 'ilmer-fields-embed.js'));
      cpSync(path.join(STABLE_DIR, 'colorize-sw.js'), path.join(jsDir, 'colorize-sw.js'));
      rmSync(STABLE_DIR, { recursive: true, force: true });
    }
  };
}

/**
 * Bundles the browser TypeScript into content-hashed files under assets/dist.
 * Eleventy copies that directory to /assets/dist and looks up entry names in the Vite manifest.
 * Source stays as TypeScript so Node (tests, terrain generators) can import it directly.
 */
export default defineConfig({
  // Bundles are served from /assets/dist/, so worker and asset URLs must include that prefix.
  base: '/assets/dist/',
  publicDir: false,
  plugins: [stableBrowserFiles()],
  build: {
    outDir: 'assets/dist',
    emptyOutDir: viteEmptiesOutput(process.argv),
    manifest: true,
    // Sourcemaps are off. The TypeScript is in the repository, and a published map would
    // ship that source to every visitor. Under the immutable /assets/dist/ header it would
    // also stay cached for a year. A sourceMappingURL comment pointing at an unpublished
    // map makes the browser request a 404.
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    target: 'es2022',
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: {
      input: {
        'ilmer-1839': 'assets/js/ilmer-1839.ts',
        'st-peters-3d': 'assets/js/st-peters-3d/main.ts',
        'ilmer-fields-embed': 'assets/js/ilmer-fields-embed.ts',
        'colorize-images': 'assets/js/colorize-images.ts',
        timeline: 'assets/js/timeline.ts',
        'then-now': 'assets/js/then-now.ts',
        'census-summary': 'assets/js/census-summary.ts',
        'poppy-chat': 'assets/js/poppy-chat.ts',
        anniversaries: 'assets/js/anniversaries.ts',
        'weekly-news': 'assets/js/weekly-news.ts'
      },
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
        // Share one minified three.js chunk between the two 3D pages.
        codeSplitting: {
          groups: [
            {
              name: 'three',
              test: /[\\/]node_modules[\\/]three[\\/]/
            }
          ]
        }
      }
    }
  },
  worker: {
    format: 'iife',
    rolldownOptions: {
      output: {
        entryFileNames: '[name]-[hash].js'
      }
    }
  },
  resolve: {
    alias: {
      '/assets': path.resolve('assets')
    }
  }
});
