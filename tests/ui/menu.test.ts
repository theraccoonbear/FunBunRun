import { describe, expect, it } from 'vitest';
import { menuHtml, padControls } from '../../src/ui/menu';

describe('menuHtml', () => {
  it('shows the intro and start button first', () => {
    const html = menuHtml(false, null);
    expect(html).toContain('You are a very good dog');
    expect(html).toContain("<button id='go'>Start running</button>");
    expect(html).toContain('<b>WASD</b>');
  });

  it('shows the round summary and touch controls', () => {
    const html = menuHtml(true, {
      licks: 3,
      score: 600,
      dragged: 12.6,
      newBest: false,
      best: 900,
      seed: 12345,
    });
    expect(html).toContain('World #12345');
    expect(html).toContain('<b>3</b> licks, <b>600</b> points');
    expect(html).toContain('Human dragged: <b>13 m</b>');
    expect(html).toContain('Best: 900');
    expect(html).toContain('<b>Left thumb</b>');
    expect(html).toContain('Run again');
  });

  it('celebrates a new best', () => {
    expect(
      menuHtml(false, { licks: 1, score: 100, dragged: 0, newBest: true, best: 100, seed: 1 }),
    ).toContain('New best!');
  });

  it('keeps the generic gamepad line on desktop when no pad is connected', () => {
    expect(menuHtml(false, null)).toContain(
      'Gamepad works too (A jump, X lick, B sniff, LB sprint)',
    );
    expect(menuHtml(true, null)).not.toContain('Gamepad');
  });

  it('shows the connected pad family labels, also on touch devices', () => {
    expect(menuHtml(false, null, 'playstation')).toContain(
      'Gamepad: <b>✕</b> jump, <b>□</b> lick, <b>○</b> sniff, <b>L1</b> sprint',
    );
    expect(menuHtml(true, null, 'nintendo')).toContain('Gamepad: ' + padControls('nintendo'));
    expect(padControls('nintendo')).toBe(
      '<b>B</b> jump, <b>Y</b> lick, <b>A</b> sniff, <b>L</b> sprint',
    );
  });
});
