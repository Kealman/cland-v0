import { boundedSettlement, LAUNCH_SETTLEMENT_MS, type LaunchSettled } from './launch-settlement.ts';
import type { Host } from '../host/host.ts';
import { localHost } from '../host/local.ts';
// Files a launch owns until it commits. On failure restore relaunch inputs and prior logs, and remove
// only directories this launch created. Shared parent directories are never removed recursively.
import type { ChildProcess } from 'node:child_process';
import { dirname } from 'node:path';
import type { Resumed } from '../hub/worktrees.ts';
import { continueWith, wait, untimed } from './continuations.ts';
import { stat } from 'node:fs/promises';

/** Metadata belongs to the hub's undo files, never to a session cwd. */
const hubFileMeta = (path: string) => stat(path);

type FileUndo = { kind: 'remove' | 'directory'; path: string }
  | { kind: 'truncate'; path: string; size: number }
  | { kind: 'restore'; path: string; content: string; mode: number };
export type LaunchFilesState = {
  undo: FileUndo[];
  children: Array<{ pid: number; pidStarted: string | null; pidIdentity?: string | null; graceMs: number }>;
};

/** Hand an unsuccessful adapter handshake to the hub's durable recovery owner. */
export class LaunchRecoveryPending extends Error {
  readonly sessionId: string;
  readonly files: LaunchFilesState;
  readonly settled: LaunchSettled;
  constructor(sessionId: string, files: LaunchFilesState, settled: LaunchSettled, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.sessionId = sessionId; this.files = files; this.settled = settled;
  }
}

export class LaunchFiles {
  readonly #undo: FileUndo[] = [];
  readonly #children: Array<{ pid: number; identity: Promise<string | null>; birth: Promise<string | null>; graceMs: number; child?: ChildProcess; exited?: Promise<void> }> = [];

  get pids(): number[] { return this.#children.map(child => child.pid); }

  readonly resumed: Resumed;
  readonly #host: Host;
  constructor(resumed: Resumed = untimed, host?: Host) {
    this.resumed = resumed;
    this.#host = host ?? localHost(process.env, entry => this.resumed(() => this.#log(entry)));
  }

  static restore(state: LaunchFilesState, resumed: Resumed = untimed, host?: Host): LaunchFiles {
    const files = new LaunchFiles(resumed, host);
    files.#undo.push(...state.undo);
    files.#children.push(...state.children.map(({ pid, pidStarted, pidIdentity, graceMs }) => ({ pid, identity: Promise.resolve(pidStarted), birth: Promise.resolve(pidIdentity ?? null), graceMs })));
    return files;
  }

  async snapshot(): Promise<LaunchFilesState> {
    const children = await Promise.all(this.#children.map(async ({ pid, identity, birth, graceMs }) => ({ pid, pidStarted: await identity, pidIdentity: await birth, graceMs })));
    return this.resumed(() => ({ undo: [...this.#undo], children }));
  }

  async directory(path: string, mode?: number): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      try { yield* wait(this.#host.makeDirectory(path, mode)); } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' && dirname(path) !== path) {
          yield* wait(this.directory(dirname(path), mode));
          yield* wait(this.directory(path, mode));
          return;
        }
        if (code === 'EEXIST' && (yield* wait(this.#host.statDirectory(path))).refusal === null) return;
        throw err;
      }
      // Record each parent as it is created: a later mkdir failure cannot strand earlier parents.
      this.#undo.push({ kind: 'directory', path });
    }).call(this), this.resumed);
  }

  async file(path: string, append = false): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      if (this.#host.name !== 'local') {
        const kind = yield* wait(this.#host.fileType(path));
        if (kind === 'missing') this.#undo.push({ kind: 'remove', path });
        else throw new Error('nonlocal existing-file rollback needs Host mode metadata (T-1644)');
        return;
      }
      let before;
      try { before = yield* wait(hubFileMeta(path)); } catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; before = null; }
      if (!before)
        this.#undo.push({ kind: 'remove', path });
      else if (append)
        this.#undo.push({ kind: 'truncate', path, size: before.size });
      else {
        const content = yield* wait(this.#host.readFile(path));
        const mode = before.mode;
        this.#undo.push({ kind: 'restore', path, content: Buffer.from(content).toString('base64'), mode });
      }
    }).call(this), this.resumed);
  }

  async write(path: string, bytes: Uint8Array, mode?: number): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      yield* wait(this.file(path));
      yield* wait(this.#host.writeFile(path, bytes, mode === undefined ? undefined : { mode }));
    }).call(this), this.resumed);
  }

  removeOnFailure(path: string): void { this.#undo.push({ kind: 'remove', path }); }

  /** Capture the owned child's identity immediately, before a failed handshake can leave it behind. */
  child(child: ChildProcess, log: (entry: Record<string, unknown>) => void, graceMs: number): void {
    if (child.pid === undefined) return;
    const pid = child.pid;
    const proof = this.#host.identity(pid);
    const identity = proof.then(row => row?.pidStarted ?? null);
    const exited = child.exitCode !== null || child.signalCode !== null ? Promise.resolve()
      : new Promise<void>(resolve => child.once('exit', () => resolve()));
    this.#children.push({ pid, identity, birth: proof.then(row => row?.pidIdentity ?? null), graceMs, child, exited });
    this.#log = log;
  }

  /** Register a Host-owned PID before the first fallible handshake operation. */
  spawned(process: { pid: number; exited: Promise<{ code: number | null; signal: string | null }> }, log: (entry: Record<string, unknown>) => void, graceMs: number): void {
    const proof = this.#host.identity(process.pid);
    this.#children.push({ pid: process.pid, identity: proof.then(row => row?.pidStarted ?? null), birth: proof.then(row => row?.pidIdentity ?? null), graceMs, exited: process.exited.then(() => {}) });
    this.#log = log;
  }

  #log: (entry: Record<string, unknown>) => void = () => {};

  async process(pid: number): Promise<{ pidStarted: string | null; pidIdentity: string | null }> {
    const child = this.#children.find(child => child.pid === pid);
    return { pidStarted: child ? await child.identity : null, pidIdentity: child ? await child.birth : null };
  }

  commit(): void { this.#undo.length = 0; this.#children.length = 0; }

  async rollback(checkpoint?: (state: LaunchFilesState) => void, log = this.#log): Promise<void> {
    this.#log = log;
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      // Never undo a live child's resources. Failed verification leaves the complete recovery state intact.
      while (this.#children.length) {
        const { pid, identity, birth, graceMs, child, exited } = this.#children[0]!;
        const pidStarted = yield* wait(identity);
        let pidIdentity = yield* wait(birth);
        if (!pidIdentity && pidStarted) {
          const observed = yield* wait(this.#host.identity(pid));
          if (this.#host.name === 'local' && observed?.pidStarted === pidStarted && observed.pidIdentity) {
            pidIdentity = observed.pidIdentity;
            this.#children[0]!.birth = Promise.resolve(pidIdentity);
            // A restored legacy receipt gains its precise proof durably before a signal.
            if (checkpoint) {
              try { checkpoint(yield* wait(this.snapshot())); }
              catch (error) { this.#children[0]!.birth = birth; throw error; }
            }
          }
        }
        if (!child || (child.exitCode === null && child.signalCode === null)) {
          if (!(yield* wait(this.#host.stop({ pid, pidStarted, pidIdentity }, { graceMs, allowReused: true })))) { log({ event: 'launch-rollback-pending', pid }); throw new Error(`could not roll back launched process ${pid}`); }
        }
        // OS disappearance can precede libuv's receipt under load. Native children
        // settle that receipt before their resources are undone; restored receipts use OS proof.
        if (exited) yield* wait(exited);
        this.#children.shift();
        if (checkpoint) checkpoint(yield* wait(this.snapshot()));
      }
      while (this.#undo.length) {
        const undo = this.#undo[this.#undo.length - 1]!;
        if (undo.kind === 'remove') yield* wait(this.#host.removePath(undo.path));
        else if (undo.kind === 'directory') yield* wait(this.#host.removePath(undo.path, { directory: true }).catch(err => this.resumed(() => {
          if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(err.code)) throw err;
        })));
        else if (undo.kind === 'truncate') yield* wait(this.#host.writeFile(undo.path, new Uint8Array(), { truncate: undo.size }));
        else if (undo.kind === 'restore') {
          yield* wait(this.#host.writeFile(undo.path, Buffer.from(undo.content, 'base64'), { mode: undo.mode }));
        }
        this.#undo.pop();
        if (checkpoint) checkpoint(yield* wait(this.snapshot()));
      }
    }).call(this), this.resumed);
  }
}


/** Failed launches remain owned and supervised until verified exit makes resource rollback safe. */
export class FailedLaunches {
  readonly #pending = new Map<string, { name: string; files: LaunchFiles; settled: LaunchSettled }>();
  readonly #log: (entry: Record<string, unknown>) => void;
  readonly #pollMs: number;
  #timer: NodeJS.Timeout | null = null;
  #retrying = false;
  #draining: Promise<void> | null = null;
  #drained: (() => void) | undefined;
  readonly #durable: boolean;
  readonly #settlementMs: number;

  constructor(log: (entry: Record<string, unknown>) => void, pollMs = 1000, durable = false, settlementMs = LAUNCH_SETTLEMENT_MS) { this.#settlementMs = settlementMs; this.#log = log; this.#pollMs = pollMs; this.#durable = durable; }

  assertAvailable(name: string, identity?: string): void {
    if ([...this.#pending].some(([id, entry]) => id === identity || entry.name === name)) throw new Error(`failed launch of "${name}" is still supervised; cleanup is pending`);
  }

  #report(entry: Record<string, unknown>): void { try { this.#log(entry); } catch { /* reporting cannot discard ownership */ } }

  async failed(identity: string, name: string, files: LaunchFiles, cause: unknown, settled: LaunchSettled): Promise<never> {
    settled = boundedSettlement(settled, this.#settlementMs);
    return continueWith((function* (this: FailedLaunches): Generator<Promise<unknown>, never, unknown> {
      // In a hub, persist the receipt before the first termination/resource undo await.
      // Standalone adapters retain their local supervisor for the same failure contract.
      if (this.#durable) throw new LaunchRecoveryPending(identity, yield* wait(files.snapshot()), settled, cause);
      try {
        yield* wait(files.rollback());
        const result = settled();
        if (result) yield* wait(result);
      } catch (error) {
        this.#pending.set(identity, { name, files, settled });
        this.#report({ event: 'launch-recovery-pending', session: name, sessionId: identity, pids: files.pids, error: String(error), cause: String(cause) });
        if (!this.#timer) { this.#timer = setInterval(() => { void this.#retry(); }, this.#pollMs); this.#timer.unref(); }
        const detail = `${cause instanceof Error ? cause.message : String(cause)}; cleanup is pending and the failed launch remains supervised`;
        if (cause instanceof Error) { cause.message = detail; cause.cause = error; throw cause; }
        throw new Error(detail, { cause: error });
      }
      throw cause;
    }).call(this), files.resumed);
  }

  async #retry(): Promise<void> {
    if (this.#retrying) return;
    this.#retrying = true;
    this.#draining = new Promise(resolve => { this.#drained = resolve; });
    try {
      for (const [identity, entry] of this.#pending) {
        try { await entry.files.rollback(); }
        catch { continue; }
        try {
          const result = entry.files.resumed(() => entry.settled());
          if (result) await result;
          entry.files.resumed(() => {
            this.#pending.delete(identity);
            this.#report({ event: 'launch-recovered', session: entry.name, sessionId: identity });
          });
        } catch (error) { this.#report({ event: 'launch-cleanup-incomplete', session: entry.name, sessionId: identity, error: String(error) }); }
      }
      if (!this.#pending.size && this.#timer) { clearInterval(this.#timer); this.#timer = null; }
    } finally { this.#retrying = false; this.#drained?.(); this.#draining = null; this.#drained = undefined; }
  }

  async drain(): Promise<void> { this.close(); if (this.#draining) await this.#draining; }

  close(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
}
