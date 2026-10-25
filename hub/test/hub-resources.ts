// Attribute async resources to one served project, including callbacks after startup.
import assert from 'node:assert/strict';
import { AsyncLocalStorage, createHook } from 'node:async_hooks';

export function hubResources(captureStacks = false) {
  const scope = new AsyncLocalStorage<boolean>();
  const resources = new Map<number, { type: string; resource: object; stack?: string }>();
  const listeners = new Map(process.eventNames().map(event => [event, process.rawListeners(event)]));
  const before = process.getActiveResourcesInfo();
  const hook = createHook({
    init(id, type, _trigger, resource) {
      // Node fetch shares one unref'ed FastTimer clock across every hub in the process.
      // Its next tick drains cleared HTTP deadlines; it is runtime-owned, not project-owned.
      // Keep all request deadlines and project timers in the table, including unref'ed ones.
      if (type === 'Timeout' && '_onTimeout' in resource && typeof resource._onTimeout === 'function' && resource._onTimeout.name === 'onTick' && new Error().stack?.includes('node:internal/deps/undici')) return;
      if (scope.getStore() && ['Timeout', 'Immediate', 'TCPSERVERWRAP', 'TCPWRAP', 'PIPESERVERWRAP', 'PIPEWRAP', 'PROCESSWRAP', 'FSEVENTWRAP', 'STATWATCHER'].includes(type)) {
        resources.set(id, { type, resource, ...(captureStacks ? { stack: new Error().stack } : {}) });
      }
    },
    destroy(id) { resources.delete(id); },
  });
  hook.enable();
  return {
    run: <T>(work: () => T): T => scope.run(true, work),
    async check() {
      // Native close and async-hook destroy receipts follow stop's final await.
      for (let i = 0; i < 4; i++) await new Promise<void>(resolve => setImmediate(resolve));
      hook.disable();
      scope.disable();
      const addedListeners = process.eventNames().flatMap(event => process.rawListeners(event).filter(listener => !listeners.get(event)?.includes(listener)).map(() => String(event)));
      const remaining = [...resources.values()].map(entry => entry.type);
      const creationStacks = captureStacks ? [...resources.values()].map(entry => `${entry.type}: ${entry.stack}`).join('\n') : '';
      assert.deepEqual({ resources: remaining, listeners: addedListeners }, { resources: [], listeners: [] }, `projectHub leaked resources; active before=${before.join(',')} after=${process.getActiveResourcesInfo().join(',')}${creationStacks ? `\n${creationStacks}` : ''}`);
    },
    cancel() { hook.disable(); scope.disable(); },
  };
}
