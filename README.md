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

### Touch

- Left thumb: run. Pushing past the ring sprints (the knob turns yellow).
- Right side of the screen: drag to swing the camera.
- LICK glows when the bunny is within reach.
- JUMP clears logs. Hold SNIFF to track the bunny.

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

The game is currently a single-file three.js (r128) prototype in `index.html`. A TypeScript port is in progress; see [issue #1](https://github.com/theraccoonbear/FunBunRun/issues/1).

Bugs and ideas: [issues](https://github.com/theraccoonbear/FunBunRun/issues).

## License

[MIT](LICENSE)
