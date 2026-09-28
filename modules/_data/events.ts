import type { AuditEvent } from '@bliss/shared/domain';

/**
 * Things that happened, for whatever reacts to them in the same write: WhatsApp alerts today. A
 * listener runs inside the command that raised the event, so what it records is committed with it
 * or not at all. Listeners are keyed, so loading a module twice never subscribes it twice.
 */
export interface DomainEvents {
  audit: AuditEvent;
  'order.fired': { tabId: string; lineIds: string[] };
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => void;

const registry = ((globalThis as unknown as { __blissEvents?: Map<string, Map<string, Listener<keyof DomainEvents>>> }).__blissEvents ??= new Map());

export function on<K extends keyof DomainEvents>(event: K, key: string, listener: Listener<K>): void {
  const forEvent = registry.get(event) ?? new Map();
  forEvent.set(key, listener as Listener<keyof DomainEvents>);
  registry.set(event, forEvent);
}

/** Tell every listener. One that fails is logged and never takes the command down with it. */
export function emit<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): void {
  for (const listener of registry.get(event)?.values() ?? []) {
    try {
      listener(payload);
    } catch (error) {
      console.error(`[events] ${event}`, error);
    }
  }
}
