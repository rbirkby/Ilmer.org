import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * Bundles the browser TypeScript into content-hashed files under assets/dist.
 * Eleventy copies that directory to /assets/dist and looks up entry names in the Vite manifest.
 * Source stays as TypeScript so Node (tests, terrain generators) can import it directly.
 */
export default defineConfig({
  // Bundles are served from /assets/dist/, so worker and asset URLs must include that prefix.
  base: '/assets/dist/',
  publicDir: false,
  build: {
    outDir: 'assets/dist',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    chunkSizeWarningLimit: 800,
    target: 'es2022',
    minify: 'esbuild',
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        'ilmer-1839': 'assets/js/ilmer-1839.ts',
        'st-peters-3d': 'assets/js/st-peters-3d/main.ts',
        'ilmer-fields-embed': 'assets/js/ilmer-fields-embed.ts',
        'colorize-images': 'assets/js/colorize-images.ts',
        'image-lightbox': 'assets/js/image-lightbox.ts',
        'then-now': 'assets/js/then-now.ts',
        'census-summary': 'assets/js/census-summary.ts',
        'poppy-chat': 'assets/js/poppy-chat.ts',
        anniversaries: 'assets/js/anniversaries.ts',
        'weekly-news': 'assets/js/weekly-news.ts'
      },
      external: [/^https?:/],
      output: {
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
        // Share one minified three.js chunk between the two 3D pages.
        manualChunks(id) {
          if (id.includes(`${path.sep}node_modules${path.sep}three${path.sep}`)) return 'three';
        }
      }
    }
  },
  worker: {
    format: 'iife',
    rollupOptions: {
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
