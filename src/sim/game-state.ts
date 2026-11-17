import { ROUND_SECONDS, RULES } from '../config';
import { lickPoints, nextCombo, showsNewBest, updatedBest } from './rules';

export type Phase = 'menu' | 'play' | 'paused' | 'over';

/** Round bookkeeping: phase, clock, score and lick timers. */
export interface Session {
  phase: Phase;
  timeLeft: number;
  score: number;
  licks: number;
  combo: number;
  lastLick: number;
  /** Seconds since the round started (keeps running in menus). */
  elapsed: number;
  /** Lick animation time left. */
  lickT: number;
  /** Lick cooldown left. */
  lickCD: number;
  best: number;
}

export function createSession(best: number): Session {
  return {
    phase: 'menu',
    timeLeft: ROUND_SECONDS,
    score: 0,
    licks: 0,
    combo: 0,
    lastLick: RULES.noLickTime,
    elapsed: 0,
    lickT: 0,
    lickCD: 0,
    best,
  };
}

/** menu/over/paused -> play, as a fresh round. Returns false (and changes nothing) during play. */
export function startRound(s: Session): boolean {
  if (s.phase === 'play') {
    return false;
  }
  s.phase = 'play';
  s.timeLeft = ROUND_SECONDS;
  s.score = 0;
  s.licks = 0;
  s.combo = 0;
  s.lastLick = RULES.noLickTime;
  s.elapsed = 0;
  return true;
}

/** play -> paused. Returns false (and changes nothing) in any other phase. */
export function pauseRound(s: Session): boolean {
  if (s.phase !== 'play') {
    return false;
  }
  s.phase = 'paused';
  return true;
}

/** paused -> play, keeping the round as it was. Returns false in any other phase. */
export function resumeRound(s: Session): boolean {
  if (s.phase !== 'paused') {
    return false;
  }
  s.phase = 'play';
  return true;
}

/** paused -> menu, abandoning the round (the best score is not updated). Returns false in any other phase. */
export function quitRound(s: Session): boolean {
  if (s.phase !== 'paused') {
    return false;
  }
  s.phase = 'menu';
  return true;
}

/** Records a successful lick; returns the points scored. */
export function scoreLick(s: Session): number {
  s.combo = nextCombo(s.combo, s.elapsed, s.lastLick);
  s.lastLick = s.elapsed;
  const pts = lickPoints(s.combo);
  s.score += pts;
  s.licks++;
  return pts;
}

export interface RoundResult {
  score: number;
  licks: number;
  best: number;
  newBest: boolean;
  /** True when the best score changed and should be saved. */
  bestChanged: boolean;
}

/**
 * Counts the round clock down (only during play, so it is frozen while
 * paused). When it runs out: play -> over, the best
 * score is updated and the result is returned; otherwise returns null.
 */
export function tickClock(s: Session, dt: number): RoundResult | null {
  if (s.phase !== 'play') {
    return null;
  }
  s.timeLeft -= dt;
  if (s.timeLeft > 0) {
    return null;
  }
  s.timeLeft = 0;
  const prev = s.best;
  s.best = updatedBest(s.score, s.best);
  s.phase = 'over';
  return {
    score: s.score,
    licks: s.licks,
    best: s.best,
    newBest: showsNewBest(s.score, prev),
    bestChanged: s.best !== prev,
  };
}
