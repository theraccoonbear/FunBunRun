import { describe, expect, it } from 'vitest';
import { Menu, menuHtml } from '../../src/ui/menu';

describe('Menu', () => {
  const fake = (): HTMLElement =>
    ({ style: {}, innerHTML: '', querySelector: () => null }) as unknown as HTMLElement;

  it('re-renders the help when the last-used device changes while shown', () => {
    const card = fake();
    const menu = new Menu(fake(), card, false, () => {});
    menu.show(null);
    expect(card.innerHTML).toContain('<b>WASD</b>');
    menu.setTouch(true);
    expect(card.innerHTML).toContain('<b>Left thumb</b>');
    menu.setTouch(false);
    expect(card.innerHTML).toContain('<b>WASD</b>');
  });

  it('does not touch the card while hidden', () => {
    const card = fake();
    const menu = new Menu(fake(), card, false, () => {});
    menu.show(null);
    menu.hide();
    card.innerHTML = 'x';
    menu.setTouch(true);
    expect(card.innerHTML).toBe('x');
  });
});

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
});
