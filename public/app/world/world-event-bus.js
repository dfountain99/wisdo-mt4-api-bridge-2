export class WorldEventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener) {
    if (typeof listener !== 'function') return () => {};
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    return () => this.listeners.get(type)?.delete(listener);
  }

  once(type, listener) {
    let off = () => {};
    off = this.on(type, (event) => {
      off();
      listener(event);
    });
    return off;
  }

  emit(type, detail = {}, metadata = {}) {
    const event = Object.freeze({
      type,
      detail,
      eventId: metadata.eventId || null,
      serverTimestamp: metadata.serverTimestamp || null,
      at: new Date().toISOString(),
    });
    for (const listener of this.listeners.get(type) || []) {
      try { listener(event); } catch (error) { console.warn(`World listener failed: ${type}`, error); }
    }
    for (const listener of this.listeners.get('*') || []) {
      try { listener(event); } catch (error) { console.warn('World wildcard listener failed', error); }
    }
    try { window.dispatchEvent(new CustomEvent(`wisdo:${type}`, { detail: event })); } catch {}
    return event;
  }

  clear() {
    this.listeners.clear();
  }
}

const key = '__WISDO_WORLD_EVENT_BUS__';
export const worldEventBus = globalThis[key] instanceof WorldEventBus ? globalThis[key] : new WorldEventBus();
globalThis[key] = worldEventBus;
