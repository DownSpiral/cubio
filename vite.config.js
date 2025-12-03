import { defineConfig } from 'vite';
import { resolve } from 'path';

// Get base path from environment variable, default to /cubio/
const basePath = process.env.GITHUB_PAGES_BASE || '/cubio/';
console.log('Vite base path:', basePath);

export default defineConfig({
  base: basePath,
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      'gan-web-bluetooth': resolve(__dirname, 'node_modules/gan-web-bluetooth/src/index.ts')
    }
  },
  optimizeDeps: {
    exclude: ['gan-web-bluetooth'],
    include: ['aes-js', 'rxjs'],
    esbuildOptions: {
      loader: {
        '.ts': 'ts'
      }
    }
  },
  ssr: {
    noExternal: ['gan-web-bluetooth']
  }
});

