import { describe, expect, it, vi } from 'vitest';
import { Emitter } from '../../src/core/events';

interface E extends Record<string, unknown> {
  ping: number;
  done: undefined;
}

describe('Emitter', () => {
  it('delivers payloads to subscribers in order', () => {
    const e = new Emitter<E>();
    const seen: string[] = [];
    e.on('ping', (n) => seen.push('a' + n));
    e.on('ping', (n) => seen.push('b' + n));
    e.emit('ping', 1);
    expect(seen).toEqual(['a1', 'b1']);
  });

  it('unsubscribes', () => {
    const e = new Emitter<E>();
    const h = vi.fn();
    const off = e.on('done', h);
    off();
    off();
    e.emit('done', undefined);
    expect(h).not.toHaveBeenCalled();
  });

  it('ignores events without subscribers', () => {
    expect(() => new Emitter<E>().emit('ping', 2)).not.toThrow();
  });
});
