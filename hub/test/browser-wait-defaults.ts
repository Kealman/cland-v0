import { waitTimeoutMs } from './until.ts';

/** Refresh Playwright defaults before each page/locator operation, including
 * locators created before load changes. Decorate API owners in place so native
 * event payloads and returned objects keep identical references. */
export function browserWaitDefaults<T extends object>(page: T, defaults: { setDefaultTimeout(ms: number): void }, baseMs = 3000): T {
  const decorated = new WeakSet<object>();
  const resultValue = (value: unknown): unknown => {
    if (value instanceof Promise) return value.then(resultValue);
    if (Array.isArray(value)) { value.forEach(resultValue); return value; }
    return value && typeof value === 'object' && 'locator' in value
      && typeof value.locator === 'function' ? decorate(value) : value;
  };
  const decorate = (target: object): object => {
    if (decorated.has(target)) return target;
    decorated.add(target);
    const methods = new Map<string, PropertyDescriptor>(), seen = new Set<string>();
    for (let prototype: object | null = target; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
      for (const name of Object.getOwnPropertyNames(prototype)) {
        if (seen.has(name)) continue;
        seen.add(name);
        if (name === 'constructor' || name.startsWith('_')) continue;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)!;
        if (typeof descriptor.value === 'function') methods.set(name, descriptor);
      }
    }
    // New native frames/popups may first reach callers through events. Enroll
    // them before user listeners without replacing any user callback identity.
    if (methods.has('mainFrame') && methods.has('on')) {
      const on = methods.get('on')!.value as (...args: unknown[]) => unknown;
      for (const event of ['frameattached', 'framenavigated', 'popup']) Reflect.apply(on, target, [event, resultValue]);
    }
    for (const [name, descriptor] of methods) {
      const original = descriptor.value as (...args: unknown[]) => unknown;
      Object.defineProperty(target, name, { configurable: true, writable: true, enumerable: descriptor.enumerable ?? false,
        value: function (this: unknown, ...args: unknown[]) {
          defaults.setDefaultTimeout(waitTimeoutMs(baseMs));
          return resultValue(Reflect.apply(original, this, args));
        },
      });
    }
    if (methods.has('frames')) resultValue(Reflect.apply(methods.get('frames')!.value, target, []));
    return target;
  };
  return decorate(page) as T;
}
