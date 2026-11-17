/** Minimal typed event emitter. Handlers run synchronously in subscription order. */
export class Emitter<Events extends Record<string, unknown>> {
  private readonly handlers: { [K in keyof Events]?: ((payload: Events[K]) => void)[] } = {};

  on<K extends keyof Events>(type: K, handler: (payload: Events[K]) => void): () => void {
    const list = (this.handlers[type] ??= []);
    list.push(handler);
    return () => {
      const i = list.indexOf(handler);
      if (i >= 0) {
        list.splice(i, 1);
      }
    };
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const list = this.handlers[type];
    if (!list) {
      return;
    }
    for (const h of list.slice()) {
      h(payload);
    }
  }
}
