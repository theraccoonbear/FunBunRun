# Fun Bun Run

Browser game: a dog chases a bunny through a 3D park to lick it, with a person dragged along on a leash. Currently a single-file three.js r128 prototype (`index.html`, served unchanged from the repo root) being ported to TypeScript under `src/`.

## Commands

- `npm run dev` - Vite dev server
- `npm run build` - `tsc --noEmit && vite build` (output in `dist/`, base `/FunBunRun/`)
- `npm run preview` - serve the production build
- `npm run typecheck` / `lint` / `format` / `format:check`
- `npm test` - Vitest; `npm run test:coverage` - with v8 coverage
- `npm run test:e2e` - Playwright smoke test (chromium) against `vite preview`; needs network for the three.js CDN
- `npm run check` - typecheck + lint + format:check + test (run before every push)

## Branches and PRs

- Always branch from an up-to-date `main`. Prefixes: `feature/`, `fix/`, `chore/`, `ci/`, `docs/`, `perf/`.
- Squash merges. Commit and PR titles use conventional-commit subjects (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `perf:`, `test:`, `build:`).
- Every PR links an issue (`Closes #N`).
- Do not lint or reformat the legacy `index.html`; it is excluded from ESLint and Prettier.

## Change control

Merging PRs, pushing to `main`, tags/releases and repository settings need an explicit human go-ahead, each time. Green CI is not proof that a human has played the change; the PR preview must be played before merge.

## Architecture direction

- The simulation layer is pure TypeScript with no three.js and no DOM, so it is unit-testable and portable across engines. Randomness goes through `src/core/rng.ts` (seeded) rather than `Math.random`.
- three.js is the renderer for now. The engine decision for consoles is revisited once the gameplay loop is proven.
- Port strategy: keep existing behaviour. During the port, fix only bugs whose fix does not change game feel. Feel-changing fixes go in separate PRs so they can be judged on their own.

## Deployment

- Production: https://theraccoonbear.github.io/FunBunRun/ (gh-pages root, published on push to `main`)
- PR previews: https://theraccoonbear.github.io/FunBunRun/pr-N/ (published per PR, removed on close)
- Pages source must be "Deploy from a branch" (gh-pages, /root). Publishing goes through `.github/scripts/publish-gh-pages.sh`.
- URL paths are case-sensitive: the base is `/FunBunRun/`.
