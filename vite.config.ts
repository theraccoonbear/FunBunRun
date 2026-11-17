import { defineConfig } from 'vitest/config';

// The production build is served from https://theraccoonbear.github.io/FunBunRun/
// (case-sensitive). PR previews override this with --base=/FunBunRun/pr-<N>/.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/FunBunRun/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'html'],
    },
  },
}));
