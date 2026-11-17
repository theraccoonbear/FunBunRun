# Fun Bun Run

A small 3D browser game. Play a very good dog chasing a bunny through a park. The goal is to **lick** the bunny, not eat it. A person is attached to the other end of the leash and gets dragged along for the whole round.

Golden bones refill stamina, lick streaks multiply points, and the bunny tires out if the pressure is kept up. A round lasts 90 seconds.

## Play

Live: <https://theraccoonbear.github.io/FunBunRun/>

### Keyboard and mouse

| Input                 | Action                         |
| --------------------- | ------------------------------ |
| W A S D / arrow keys  | Run                            |
| Mouse (click to lock) | Swing the camera               |
| Shift                 | Sprint                         |
| Space                 | Jump over logs                 |
| E / F / mouse click   | Lick                           |
| Q (hold)              | Sniff, to track the bunny      |
| Enter                 | Start or restart from the menu |
| M                     | Mute or unmute (remembered)    |

### Touch

- Left thumb: run. Pushing past the ring sprints (the knob turns yellow).
- Right side of the screen: drag to swing the camera.
- LICK glows when the bunny is within reach.
- JUMP clears logs. Hold SNIFF to track the bunny.
- The ♪ button (top right) mutes. If the browser kept sound off, a "Tap for sound" button appears below it.

### Gamepad

| Button      | Action                    |
| ----------- | ------------------------- |
| Left stick  | Run                       |
| Right stick | Camera                    |
| A           | Jump (or start from menu) |
| Start       | Start from menu           |
| X / RT      | Lick                      |
| B / LT      | Sniff                     |
| LB / L3     | Sprint                    |

## Status

The game is written in TypeScript with three.js; see `CLAUDE.md` for the module layout and [issue #1](https://github.com/theraccoonbear/FunBunRun/issues/1) for the port from the original prototype.

The original single-file prototype is still published for side-by-side comparison: <https://theraccoonbear.github.io/FunBunRun/legacy/> (and at `/legacy/` on every PR preview). It will be removed once parity is confirmed.

Bugs and ideas: [issues](https://github.com/theraccoonbear/FunBunRun/issues).

## Development

Requires Node 22 or newer (`.nvmrc` pins 24).

```sh
npm ci
npm run dev          # dev server
npm run check        # typecheck, lint, format check, unit tests
npm run build        # production build into dist/
npm run test:e2e     # Playwright tests (run `npx playwright install chromium` once)
```

Appending `?debug` to the game URL exposes a read-only `window.__fbr.snapshot()` with the current game state, for tests and debugging.

Every pull request gets a live preview at `https://theraccoonbear.github.io/FunBunRun/pr-N/` (N is the PR number), posted as a comment by the preview workflow. Previews are removed when the PR closes. See `CLAUDE.md` for branch and review conventions.

## License

[MIT](LICENSE)
