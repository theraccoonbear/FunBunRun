import { describe, expect, it } from 'vitest';
import { ROUND_SECONDS, RULES } from '../../src/config';
import {
  createSession,
  pauseRound,
  quitRound,
  resumeRound,
  scoreLick,
  startRound,
  tickClock,
} from '../../src/sim/game-state';

describe('session', () => {
  it('starts in the menu with the stored best', () => {
    const s = createSession(700);
    expect(s.phase).toBe('menu');
    expect(s.best).toBe(700);
  });

  it('menu -> play resets the round', () => {
    const s = createSession(0);
    s.score = 50;
    s.elapsed = 12;
    s.combo = 3;
    expect(startRound(s)).toBe(true);
    expect(s).toMatchObject({
      phase: 'play',
      timeLeft: ROUND_SECONDS,
      score: 0,
      licks: 0,
      combo: 0,
      lastLick: RULES.noLickTime,
      elapsed: 0,
    });
  });

  it('ignores start during play', () => {
    const s = createSession(0);
    startRound(s);
    s.score = 10;
    expect(startRound(s)).toBe(false);
    expect(s.score).toBe(10);
  });

  it('play -> over when the clock runs out, updating the best', () => {
    const s = createSession(100);
    startRound(s);
    s.score = 250;
    expect(tickClock(s, ROUND_SECONDS - 1)).toBeNull();
    const r = tickClock(s, 2);
    expect(r).toEqual({ score: 250, licks: 0, best: 250, newBest: true, bestChanged: true });
    expect(s.phase).toBe('over');
    expect(s.timeLeft).toBe(0);
    expect(tickClock(s, 1)).toBeNull();
  });

  it('keeps the best after a weaker round', () => {
    const s = createSession(900);
    startRound(s);
    s.score = 100;
    expect(tickClock(s, ROUND_SECONDS)).toMatchObject({
      best: 900,
      newBest: false,
      bestChanged: false,
    });
  });

  it('does not flag a new best when the round only ties the best', () => {
    const s = createSession(300);
    startRound(s);
    s.score = 300;
    expect(tickClock(s, ROUND_SECONDS)).toMatchObject({
      best: 300,
      newBest: false,
      bestChanged: false,
    });
  });

  it('over -> play starts a fresh round', () => {
    const s = createSession(0);
    startRound(s);
    tickClock(s, ROUND_SECONDS);
    expect(startRound(s)).toBe(true);
    expect(s.phase).toBe('play');
    expect(s.timeLeft).toBe(ROUND_SECONDS);
  });

  it('builds combos from licks within the window', () => {
    const s = createSession(0);
    startRound(s);
    s.elapsed = 1;
    expect(scoreLick(s)).toBe(100);
    s.elapsed = 5;
    expect(scoreLick(s)).toBe(200);
    s.elapsed = 20;
    expect(scoreLick(s)).toBe(100);
    expect(s).toMatchObject({ score: 400, licks: 3, combo: 1, lastLick: 20 });
  });

  it('play -> paused -> play keeps the round and freezes the clock', () => {
    const s = createSession(0);
    startRound(s);
    tickClock(s, 10);
    s.score = 300;
    expect(pauseRound(s)).toBe(true);
    expect(s.phase).toBe('paused');
    expect(tickClock(s, 50)).toBeNull();
    expect(s.timeLeft).toBe(ROUND_SECONDS - 10);
    expect(resumeRound(s)).toBe(true);
    expect(s).toMatchObject({ phase: 'play', timeLeft: ROUND_SECONDS - 10, score: 300 });
  });

  it('only pauses during play and only resumes or quits while paused', () => {
    const s = createSession(0);
    expect(pauseRound(s)).toBe(false);
    expect(resumeRound(s)).toBe(false);
    expect(quitRound(s)).toBe(false);
    expect(s.phase).toBe('menu');
    startRound(s);
    expect(resumeRound(s)).toBe(false);
    expect(quitRound(s)).toBe(false);
    pauseRound(s);
    expect(pauseRound(s)).toBe(false);
    expect(s.phase).toBe('paused');
    tickClock(s, ROUND_SECONDS);
    expect(s.phase).toBe('paused');
    // A finished round cannot be paused.
    resumeRound(s);
    tickClock(s, ROUND_SECONDS);
    expect(s.phase).toBe('over');
    expect(pauseRound(s)).toBe(false);
  });

  it('paused -> menu abandons the round without touching the best', () => {
    const s = createSession(100);
    startRound(s);
    s.score = 500;
    pauseRound(s);
    expect(quitRound(s)).toBe(true);
    expect(s.phase).toBe('menu');
    expect(s.best).toBe(100);
  });

  it('paused -> play via restart starts a fresh round', () => {
    const s = createSession(0);
    startRound(s);
    tickClock(s, 30);
    s.score = 200;
    pauseRound(s);
    expect(startRound(s)).toBe(true);
    expect(s).toMatchObject({ phase: 'play', timeLeft: ROUND_SECONDS, score: 0 });
  });
});
