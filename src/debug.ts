import type { Game } from './sim/game';

/** Read-only snapshot of the game for automated tests. */
export interface DebugSnapshot {
  phase: string;
  timeLeft: number;
  score: number;
  licks: number;
  dog: { x: number; y: number; z: number; stamina: number };
  bunny: { x: number; z: number };
  person: { headY: number; dragged: number };
  leash: { length: number; handToCollar: number };
  /** Seed of the current world. */
  seed: number;
  /** Copies of the prop and bone positions as [x, z] pairs, in generation order. */
  layout: {
    trees: [number, number][];
    bushes: [number, number][];
    rocks: [number, number][];
    logs: [number, number][];
    bones: [number, number][];
  };
}

export interface DebugHook {
  snapshot(): DebugSnapshot;
}

declare global {
  interface Window {
    __fbr?: DebugHook;
  }
}

/**
 * Exposes `window.__fbr.snapshot()` when the page URL has `?debug`. The
 * e2e suite runs against the production build, so a build-mode check alone
 * would hide the hook from it; the query parameter keeps it off for normal
 * players. The hook only returns copies of plain values, so it cannot
 * change the game.
 */
export function installDebugHook(game: Game, search: string): void {
  if (!new URLSearchParams(search).has('debug')) {
    return;
  }
  const hook: DebugHook = {
    snapshot() {
      const { session: s, dog: d, bunny: b, rag, world } = game;
      const xz = (list: readonly { x: number; z: number }[]): [number, number][] =>
        list.map((p) => [p.x, p.z]);
      const hand = rag.body.rHand;
      const c = rag.rope[0];
      return {
        phase: s.phase,
        timeLeft: s.timeLeft,
        score: s.score,
        licks: s.licks,
        dog: { x: d.pos.x, y: d.pos.y, z: d.pos.z, stamina: d.stam },
        bunny: { x: b.pos.x, z: b.pos.z },
        person: { headY: rag.body.head.y, dragged: rag.st.dragged },
        leash: {
          length: rag.L,
          handToCollar: c ? Math.hypot(hand.x - c.x, hand.y - c.y, hand.z - c.z) : 0,
        },
        seed: game.seed,
        layout: {
          trees: xz(world.trees),
          bushes: xz(world.bushes),
          rocks: xz(world.rocks),
          logs: xz(world.logs),
          bones: xz(game.bones),
        },
      };
    },
  };
  window.__fbr = Object.freeze(hook);
}
