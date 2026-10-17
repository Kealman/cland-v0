// Loaded only in T1/T2 workers, before test modules capture builtin exports.
import cp from 'node:child_process';
import net from 'node:net';
import * as nodeTest from 'node:test';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { tierTestName, type TierTestContext } from './tier-context.ts';
import { isClandCliLaunch } from './tier-cli.ts';

export type TierResourceMode = 'report-only' | 'enforce';
export function installTierTripwire(file: string, tier: 'T1' | 'T2', mode: TierResourceMode, report: (line: string) => void): void {
  // Namespace lookup keeps Node >=24.13 compatible (the API arrived in 24.19).
  const getContext = Reflect.get(nodeTest, 'getTestContext') as (() => TierTestContext | undefined) | undefined;
  const testName = tierTestName(getContext, report);
  const seen = new Set<string>();
  let delegating = false;
  function wrap(owner: object, method: string, resource: string, cli = false): void {
    const original = Reflect.get(owner, method) as Function;
    const invoke = (fn: Function, self: unknown, args: unknown[]) => {
      if (delegating) return Reflect.apply(fn, self, args);
      if (!(cli && tier === 'T2' && isClandCliLaunch(args[0], args[1]))) {
        const name = testName();
        const key = JSON.stringify([name, resource]);
        if (!seen.has(key) || mode === 'enforce') {
          const error = new Error(`${tier} forbids ${resource}: ${file} — ${name}`);
          Error.captureStackTrace(error, invoke);
          if (!seen.has(key)) {
            seen.add(key);
            // Never include resource arguments, environment values or command lines.
            report(`tier-mismatch ${JSON.stringify({ file, name, tier, resource, mode, stack: error.stack })}`);
          }
          if (mode === 'enforce') {
            // A test catching the thrown resource error cannot turn this run green.
            process.exitCode = 1;
            throw error;
          }
        }
      }
      delegating = true;
      try { return Reflect.apply(fn, self, args); }
      finally { delegating = false; }
    };
    const wrapped = function (this: unknown, ...args: unknown[]) { return invoke(original, this, args); };
    // exec/execFile have custom promisifiers that close over the native function.
    const custom = Reflect.get(original, promisify.custom);
    if (typeof custom === 'function') Object.defineProperty(wrapped, promisify.custom, { value: function (this: unknown, ...args: unknown[]) { return invoke(custom, this, args); } });
    Reflect.set(owner, method, wrapped);
  }
  for (const method of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) wrap(cp, method, `child_process.${method}`, method === 'execFile');
  // Also cover new ChildProcess().spawn(), which bypasses the module functions.
  wrap(cp.ChildProcess.prototype, 'spawn', 'child_process.ChildProcess.spawn');
  if (tier === 'T1') {
    wrap(net.Server.prototype, 'listen', 'net.Server.listen');
    wrap(net.Socket.prototype, 'connect', 'net.Socket.connect');
    for (const method of ['connect', 'createConnection']) wrap(net, method, `net.${method}`);
    // HTTP(S) servers inherit this listen; HTTP(S), TLS and fetch clients
    // reach Socket.connect. Trap the actual socket, without loading protocols
    // a pure T1 file never uses (or reporting requests that never open a socket).
  }
  syncBuiltinESMExports();
}
