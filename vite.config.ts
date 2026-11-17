import { defineConfig } from 'vitest/config';

// The production build is served from https://theraccoonbear.github.io/FunBunRun/
// (case-sensitive). PR previews override this with --base=/FunBunRun/pr-<N>/.
// `vite preview` (used by the e2e tests) serves the build, so it needs the same base.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/FunBunRun/' : '/',
  build: {
    // The three.js chunk alone is about 540 kB minified (135 kB gzipped).
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // three.js in its own chunk: it changes rarely, so it stays cached across deploys.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
}));
