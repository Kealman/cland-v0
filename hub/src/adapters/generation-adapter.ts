import { randomUUID } from 'node:crypto';
import type { AdapterHost, GenerationReleaseReceipt, HarnessAdapter, HarnessProcess } from './contract.ts';
import type { Host } from '../host/host.ts';
import { hostGenerationKey } from './processes.ts';

type ScopedAdapter = HarnessAdapter & {
  assertLaunchAvailable(name: string): void;
  detachUnreachable(): Promise<GenerationReleaseReceipt['dropped']>;
};
type Scope = {
  adapter: ScopedAdapter;
  fenced: boolean;
  process?: HarnessProcess;
  work: Set<Promise<unknown>>;
  rows: Set<HarnessProcess>;
  identities: Set<string>;
  forwardIds: Set<string>;
  release?: Promise<GenerationReleaseReceipt>;
};

/** All mutable adapter maps belong to one native generation, including work captured
 * before the process row exists. The stable id only selects the current scope for
 * legacy id-only operations; captured process operations never use that lookup. */
export function generationAdapter<T extends ScopedAdapter>(baseline: T, host: AdapterHost, create: (host: AdapterHost) => T): T {
  const scopes = new Set<Scope>();
  const byProcess = new WeakMap<HarnessProcess, Scope>();
  const byIdentity = new Map<string, Scope>();
  const current = new Map<string, Scope>();
  const launching = new Map<string, Scope>();
  const forwardOwners = new Map<string, Scope>();
  const overrides = new Map<PropertyKey, unknown>();
  let closed = false;
  const make = (): Scope => {
    const scope = { fenced: false, work: new Set<Promise<unknown>>(), rows: new Set<HarnessProcess>(), identities: new Set<string>(), forwardIds: new Set<string>() } as Scope;
    const forwardId = randomUUID();
    const hosts = new WeakMap<Host, Host>();
    const wrapHost = (machine: Host): Host => {
      const previous = hosts.get(machine);
      if (previous) return previous;
      const wrapped = new Proxy(machine, { get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        return (...args: unknown[]) => {
          if (scope.fenced) throw new Error('unreachable adapter generation is fenced');
          // The Host also keys forwards by id. Give each scope its own namespace.
          if (key === 'forward' || key === 'unforward') {
            const id = String(args[0]);
            if (!forwardOwners.has(id)) forwardOwners.set(id, scope);
            if (forwardOwners.get(id) !== scope) args[0] = `${id}:${forwardId}`;
          }
          if (key === 'forward') scope.forwardIds.add(String(args[0]));
          const result = value.apply(target, args);
          if (key === 'unforward') return Promise.resolve(result).then(() => { scope.forwardIds.delete(String(args[0])); });
          return result;
        };
      } });
      hosts.set(machine, wrapped);
      return wrapped;
    };
    const scopedHost = new Proxy(host, { get(target, key) {
      const value = Reflect.get(target, key);
      if (key === 'hostForLaunch' || key === 'hostForProcess') return typeof value === 'function' ? (...args: unknown[]) => wrapHost(value.apply(target, args)) : value;
      if (key === 'adapterState' && value) return { read: value.read.bind(value), write: (name: string, data: string) => { if (!scope.fenced && (!scope.process || !current.has(scope.process.sessionId) || current.get(scope.process.sessionId) === scope)) value.write(name, data); } };
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        if (scope.fenced && key !== 'log') return;
        if (key !== 'launchGeneration' && key !== 'log' && scope.process && typeof args[0] === 'string' && current.has(String(args[0])) && current.get(String(args[0])) !== scope) return;
        if (key === 'recordPid' && scope.process) {
          const [sessionId, pid, pidStarted, harnessSessionId, pidIdentity] = args;
          if (sessionId === scope.process.sessionId) {
            const updated = { ...scope.process, pid, ...(pidStarted !== undefined ? {pidStarted} : {}), ...(harnessSessionId !== undefined ? {harnessSessionId} : {}), ...(pidIdentity !== undefined ? {pidIdentity} : {}) } as HarnessProcess;
            byIdentity.set(hostGenerationKey(updated), scope);
            scope.identities.add(hostGenerationKey(updated));
          }
        }
        return value.apply(target, args);
      };
    } });
    scope.adapter = create(scopedHost);
    scopes.add(scope);
    return scope;
  };
  const identity = hostGenerationKey;
  const bind = (p: HarnessProcess, scope: Scope): void => {
    byProcess.set(p, scope);
    scope.rows.add(p);
    byIdentity.set(identity(p), scope);
    scope.identities.add(identity(p));
    scope.process = p;
    if (!forwardOwners.has(p.sessionId)) forwardOwners.set(p.sessionId, scope);
  };
  const find = (p: HarnessProcess, operation?: PropertyKey): Scope => {
    let scope = byProcess.get(p) ?? byIdentity.get(identity(p));
    // Local Claude can stop by its captured native job even when a row has no
    // PID. This supplies no OS signal identity and never matches by URL alone.
    if (!scope && operation === 'stop' && p.harness === 'claude-code' && (p.host ?? 'local') === 'local' && p.pid === null && p.harnessId) {
      const matches = [...scopes].filter(s => !s.fenced && s.process &&
        s.process.sessionId === p.sessionId && (s.process.host ?? 'local') === 'local' &&
        s.process.startedAt === p.startedAt && s.process.harnessId === p.harnessId &&
        s.process.harnessSessionId === p.harnessSessionId && (s.process.pidIdentity ?? null) === (p.pidIdentity ?? null));
      if (matches.length === 1) scope = matches[0];
    }
    if (!scope) { scope = make(); bind(p, scope); }
    return scope;
  };
  const release = (p: HarnessProcess): Promise<GenerationReleaseReceipt> => {
    const scope = find(p);
    if (!scope.release) {
      const generation = hostGenerationKey(p);
      scope.fenced = true;
      const admitted = [...scope.work];
      scope.release = Promise.resolve().then(async () => {
        const detaching = scope.adapter.detachUnreachable();
        await Promise.allSettled(admitted);
        const dropped = await detaching;
        if (admitted.length && !dropped.includes('in-flight')) dropped.push('in-flight');
        return { generation, released: true as const, dropped, forwardIds: [...scope.forwardIds] };
      });
    }
    return scope.release;
  };
  const own = <R>(scope: Scope, result: R): R => {
    if (result instanceof Promise) {
      scope.work.add(result);
      void result.then(() => scope.work.delete(result), () => scope.work.delete(result));
    }
    return result;
  };
  return new Proxy(baseline, {
    set(target, key, value) { overrides.set(key, value); return Reflect.set(target, key, value); },
    deleteProperty(target, key) { overrides.delete(key); return Reflect.deleteProperty(target, key); },
    defineProperty(target, key, descriptor) { if ('value' in descriptor) overrides.set(key, descriptor.value); return Reflect.defineProperty(target, key, descriptor); },
    get(target, key) {
    if (overrides.has(key)) return overrides.get(key);
    if (key === 'releaseUnreachableGeneration') return release;
    if (key === 'close') { const closeBaseline = target.close.bind(target); return async () => {
      closed = true;
      const results = await Promise.allSettled([closeBaseline(), ...[...scopes].map(async s => {
        const closing = Promise.resolve(s.release ?? s.adapter.close());
        const joined = await Promise.allSettled([closing, ...s.work]);
        if (joined[0]?.status === 'rejected') throw joined[0].reason;
      })]);
      const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason);
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, `adapter generation cleanup incomplete: ${errors.map(String).join('; ')}`);
    };
    }
    const method = Reflect.get(target, key);
    if (typeof method !== 'function') return method;
    if (key === 'spawn') return async (...args: unknown[]) => {
      if (closed) throw new Error('adapter is closed');
      const request = args[0] as {name: string};
      launching.get(request.name)?.adapter.assertLaunchAvailable(request.name);
      const scope = make();
      launching.set(request.name, scope);
      const p = await (scope.adapter.spawn as Function)(...args) as HarnessProcess;
      bind(p, scope);
      current.set(p.sessionId, scope);
      return p;
    };
    return (...args: unknown[]) => {
      const p = args[0];
      const process = p && typeof p === 'object' && Object.hasOwn(p, 'sessionId') ? p as HarnessProcess : key === 'interpret' ? args[2] as HarnessProcess | undefined : undefined;
      if (closed && key === 'watch') return;
      const scope = process ? key === 'settleFailedLaunch' ? byProcess.get(process) ?? byIdentity.get(identity(process)) ?? launching.get(process.name) ?? find(process, key) : find(process, key) : typeof p === 'string' ? current.get(p) : undefined;
      const adapter = scope?.adapter ?? target;
      const invoke = () => (scope ? Reflect.get(adapter, key) as Function : method).apply(adapter, args);
      if (key === 'releaseHostGeneration' && scope?.fenced) {
        return Promise.resolve(scope.release).then(() => method.apply(baseline, args));
      }
      if (scope?.fenced && key !== 'stateReason' && key !== 'usage' && key !== 'attachCommand') throw new Error('unreachable adapter generation is fenced');
      if ((key === 'watch' || key === 'bridge') && scope && process) {
        const previous = current.get(process.sessionId);
        if (previous && previous !== scope && !previous.fenced) previous.adapter.unwatch?.(process.sessionId);
        current.set(process.sessionId, scope);
      }
      const admittedGeneration = process ? hostGenerationKey(process) : null;
      const result = scope ? own(scope, invoke()) : invoke();
      if (key === 'resume' && scope) return Promise.resolve(result).then(value => {
        if (value.found && !scope.fenced) {
          if ((args[1] as {relaunch?: boolean} | undefined)?.relaunch && hostGenerationKey(value.process) !== admittedGeneration) {
            // Existing adapters positively stop the old native generation before
            // fresh launch. Retire only facade aliases; preserve their launch paths.
            const retired = make();
            if (scope.process) retired.process = scope.process;
            for (const row of scope.rows) { byProcess.set(row, retired); retired.rows.add(row); }
            for (const key of scope.identities) if (byIdentity.get(key) === scope) { byIdentity.set(key, retired); retired.identities.add(key); }
            scope.rows.clear(); scope.identities.clear();
          }
          bind(value.process, scope); current.set(value.process.sessionId, scope);
        }
        return value;
      });
      return result;
    };
  } });
}
