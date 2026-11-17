# Fun Bun Run

Browser game: a dog chases a bunny through a 3D park to lick it, with a person dragged along on a leash. The game is TypeScript modules under `src/` rendered with three.js (npm, r187). The original single-file prototype (three.js r128 from a CDN) is kept verbatim at `public/legacy/index.html` and published at `/FunBunRun/legacy/` for side-by-side comparison until parity is confirmed (#1).

## Commands

- `npm run dev` - Vite dev server
- `npm run build` - `tsc --noEmit && vite build` (output in `dist/`, base `/FunBunRun/`)
- `npm run preview` - serve the production build
- `npm run typecheck` / `lint` / `format` / `format:check`
- `npm test` - Vitest; `npm run test:coverage` - with v8 coverage
- `npm run test:e2e` - Playwright tests (chromium) against `vite preview`; the `/legacy/` test needs network for the three.js CDN
- `npm run check` - typecheck + lint + format:check + test (run before every push)

## Branches and PRs

- Branch from `main`. Prefixes: `feature/`, `fix/`, `chore/`, `ci/`, `docs/`, `perf/`.
- Squash-only merges. Branches do not need to be up to date with `main` before merging. Enable auto-merge with `gh pr merge N --auto --squash`. Commit and PR titles use conventional-commit subjects (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `perf:`, `test:`, `build:`).
- Every PR links an issue (`Closes #N`).
- Do not lint or reformat `public/legacy/index.html`; it is excluded from ESLint and Prettier.

## Change control

Merging PRs, pushing to `main`, tags/releases and repository settings need an explicit human go-ahead, each time. Green CI is not proof that a human has played the change; the PR preview must be played before merge.

## Architecture direction

- `src/config.ts`: every tuning constant, named and commented. Changing a value changes game feel.
- `src/core/`: `math` (plain `Vec2`/`Vec3`, segment maths), `events` (typed emitter), `loop` (fixed-step accumulator, frame timer, rAF loop), `rng` (`Rng` interface, seeded `createRng`, `mathRandomRng`).
- `src/sim/`: pure TypeScript, no three.js and no DOM, so it is unit-testable and portable across engines. `world` (prop placement, obstacles), `collision`, `look` (camera yaw/pitch), `dog`, `bunny`, `scent`, `ragdoll` (person and leash, Verlet), `rules`, `game-state` (phases menu/play/over, clock, score), and `game` (the `Game` class that composes them and emits typed events). Randomness comes from an injected `Rng`; the game currently passes `mathRandomRng()` to match the prototype, and #11 switches world generation to a seeded stream.
- `src/input/`: devices write into `Actions` (axes, held buttons, edge-latched jump/lick cleared at frame end). `keyboard`, `pointer`, `touch`, `gamepad`; `joystick` is the pure virtual-stick maths.
- `src/render/`: three.js only here. `scene` (renderer, lights, ground, colour pipeline), `models`, `views` (sync sim state to meshes plus procedural animation), `camera`, `fx` (scent trail, hearts, sniff atmosphere). Colour management is off and output is linear to match the r128 look; light intensities carry a factor of PI for the same reason.
- `src/audio/sfx.ts`, `src/ui/` (`hud`, `menu`), `src/platform/storage.ts` (key-value store; best score under `funbunrun-best`).
- `src/main.ts` wires everything in the prototype's per-frame order; `src/debug.ts` exposes a read-only `window.__fbr.snapshot()` when the URL has `?debug` (used by the e2e tests).
- Coverage thresholds apply to `src/sim/**` and `src/core/**` (`npm run test:coverage`, run in CI).
- three.js is the renderer for now. The engine decision for consoles is revisited once the gameplay loop is proven.
- Port strategy: keep existing behaviour. During the port, fix only bugs whose fix does not change game feel. Feel-changing fixes go in separate PRs so they can be judged on their own.

## Deployment

- Production: https://theraccoonbear.github.io/FunBunRun/ (gh-pages root). Deploys run only after CI is green on `main` (`deploy-pages.yml` is triggered by the CI run), so a red `main` is never published. If `main` goes red after a merge, fix forward or revert promptly.
- PR previews: https://theraccoonbear.github.io/FunBunRun/pr-N/ (published per PR, removed on close)
- Pages source must be "Deploy from a branch" (gh-pages, /root). Publishing goes through `.github/scripts/publish-gh-pages.sh`.
- URL paths are case-sensitive: the base is `/FunBunRun/`.
