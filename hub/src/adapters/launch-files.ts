// Files a launch owns until it commits. On failure restore relaunch inputs and prior logs, and remove
// only directories this launch created. Shared parent directories are never removed recursively.
import type { ChildProcess } from 'node:child_process';
import { endProcess } from '../system-processes.ts';
import { processStarted } from './processes.ts';
import { dirname } from 'node:path';
import type { Resumed } from '../hub/worktrees.ts';
import { continueWith, wait, untimed } from './continuations.ts';
import { mkdir, readFile, rm, rmdir, stat, truncate, writeFile, chmod } from 'node:fs/promises';

type FileUndo = { kind: 'remove' | 'directory'; path: string }
  | { kind: 'truncate'; path: string; size: number }
  | { kind: 'restore'; path: string; content: string; mode: number };
export type LaunchFilesState = {
  undo: FileUndo[];
  children: Array<{ pid: number; pidStarted: string | null; graceMs: number }>;
};

/** Hand an unsuccessful adapter handshake to the hub's durable recovery owner. */
export class LaunchRecoveryPending extends Error {
  readonly sessionId: string;
  readonly files: LaunchFilesState;
  readonly settled: () => void;
  constructor(sessionId: string, files: LaunchFilesState, settled: () => void, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
    this.sessionId = sessionId; this.files = files; this.settled = settled;
  }
}

export class LaunchFiles {
  readonly #undo: FileUndo[] = [];
  readonly #children: Array<{ pid: number; identity: Promise<string | null>; graceMs: number; child?: ChildProcess; exited?: Promise<void> }> = [];

  get pids(): number[] { return this.#children.map(child => child.pid); }

  readonly resumed: Resumed;
  constructor(resumed: Resumed = untimed) { this.resumed = resumed; }

  static restore(state: LaunchFilesState, resumed: Resumed = untimed): LaunchFiles {
    const files = new LaunchFiles(resumed);
    files.#undo.push(...state.undo);
    files.#children.push(...state.children.map(({ pid, pidStarted, graceMs }) => ({ pid, identity: Promise.resolve(pidStarted), graceMs })));
    return files;
  }

  async snapshot(): Promise<LaunchFilesState> {
    const children = await Promise.all(this.#children.map(async ({ pid, identity, graceMs }) => ({ pid, pidStarted: await identity, graceMs })));
    return this.resumed(() => ({ undo: [...this.#undo], children }));
  }

  async directory(path: string, mode?: number): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      try { yield* wait(mkdir(path, mode ? { mode } : {})); } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' && dirname(path) !== path) {
          yield* wait(this.directory(dirname(path), mode));
          yield* wait(this.directory(path, mode));
          return;
        }
        if (code === 'EEXIST' && (yield* wait(stat(path))).isDirectory()) return;
        throw err;
      }
      // Record each parent as it is created: a later mkdir failure cannot strand earlier parents.
      this.#undo.push({ kind: 'directory', path });
    }).call(this), this.resumed);
  }

  async file(path: string, append = false): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      let before;
      try { before = yield* wait(stat(path)); } catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; before = null; }
      if (!before)
        this.#undo.push({ kind: 'remove', path });
      else if (append)
        this.#undo.push({ kind: 'truncate', path, size: before.size });
      else {
        const content = yield* wait(readFile(path));
        const mode = before.mode;
        this.#undo.push({ kind: 'restore', path, content: content.toString('base64'), mode });
      }
    }).call(this), this.resumed);
  }

  removeOnFailure(path: string): void { this.#undo.push({ kind: 'remove', path }); }

  /** Capture the owned child's identity immediately, before a failed handshake can leave it behind. */
  child(child: ChildProcess, log: (entry: Record<string, unknown>) => void, graceMs: number): void {
    if (child.pid === undefined) return;
    const pid = child.pid;
    const identity = processStarted(pid, undefined, this.resumed);
    const exited = child.exitCode !== null || child.signalCode !== null ? Promise.resolve()
      : new Promise<void>(resolve => child.once('exit', () => resolve()));
    this.#children.push({ pid, identity, graceMs, child, exited });
    this.#log = log;
  }

  #log: (entry: Record<string, unknown>) => void = () => {};

  commit(): void { this.#undo.length = 0; this.#children.length = 0; }

  async rollback(checkpoint?: (state: LaunchFilesState) => void, log = this.#log): Promise<void> {
    return continueWith((function* (this: LaunchFiles): Generator<Promise<unknown>, void, unknown> {
      // Never undo a live child's resources. Failed verification leaves the complete recovery state intact.
      while (this.#children.length) {
        const { pid, identity, graceMs, child, exited } = this.#children[0]!;
        const pidStarted = yield* wait(identity);
        if (!child || (child.exitCode === null && child.signalCode === null)) {
          if (!(yield* wait(endProcess({ pid, pidStarted }, log, graceMs, undefined, { resumed: this.resumed, allowReused: true })))) throw new Error(`could not roll back launched process ${pid}`);
        }
        // OS disappearance can precede libuv's receipt under load. Native children
        // settle that receipt before their resources are undone; restored receipts use OS proof.
        if (exited) yield* wait(exited);
        this.#children.shift();
        if (checkpoint) checkpoint(yield* wait(this.snapshot()));
      }
      while (this.#undo.length) {
        const undo = this.#undo[this.#undo.length - 1]!;
        if (undo.kind === 'remove') yield* wait(rm(undo.path, { force: true }));
        else if (undo.kind === 'directory') yield* wait(rmdir(undo.path).catch(err => this.resumed(() => {
          if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(err.code)) throw err;
        })));
        else if (undo.kind === 'truncate') yield* wait(truncate(undo.path, undo.size));
        else if (undo.kind === 'restore') {
          yield* wait(writeFile(undo.path, Buffer.from(undo.content, 'base64')));
          yield* wait(chmod(undo.path, undo.mode));
        }
        this.#undo.pop();
        if (checkpoint) checkpoint(yield* wait(this.snapshot()));
      }
    }).call(this), this.resumed);
  }
}


/** Failed launches remain owned and supervised until verified exit makes resource rollback safe. */
export class FailedLaunches {
  readonly #pending = new Map<string, { name: string; files: LaunchFiles; settled: () => void }>();
  readonly #log: (entry: Record<string, unknown>) => void;
  readonly #pollMs: number;
  #timer: NodeJS.Timeout | null = null;
  #retrying = false;
  readonly #durable: boolean;

  constructor(log: (entry: Record<string, unknown>) => void, pollMs = 1000, durable = false) { this.#log = log; this.#pollMs = pollMs; this.#durable = durable; }

  assertAvailable(name: string, identity?: string): void {
    if ([...this.#pending].some(([id, entry]) => id === identity || entry.name === name)) throw new Error(`failed launch of "${name}" is still supervised; cleanup is pending`);
  }

  #report(entry: Record<string, unknown>): void { try { this.#log(entry); } catch { /* reporting cannot discard ownership */ } }

  async failed(identity: string, name: string, files: LaunchFiles, cause: unknown, settled: () => void): Promise<never> {
    return continueWith((function* (this: FailedLaunches): Generator<Promise<unknown>, never, unknown> {
      // In a hub, persist the receipt before the first termination/resource undo await.
      // Standalone adapters retain their local supervisor for the same failure contract.
      if (this.#durable) throw new LaunchRecoveryPending(identity, yield* wait(files.snapshot()), settled, cause);
      try { yield* wait(files.rollback()); } catch (error) {
        this.#pending.set(identity, { name, files, settled });
        this.#report({ event: 'launch-recovery-pending', session: name, sessionId: identity, pids: files.pids, error: String(error), cause: String(cause) });
        if (!this.#timer) { this.#timer = setInterval(() => { void this.#retry(); }, this.#pollMs); this.#timer.unref(); }
        const detail = `${cause instanceof Error ? cause.message : String(cause)}; cleanup is pending and the failed launch remains supervised`;
        if (cause instanceof Error) { cause.message = detail; cause.cause = error; throw cause; }
        throw new Error(detail, { cause: error });
      }
      settled();
      throw cause;
    }).call(this), files.resumed);
  }

  async #retry(): Promise<void> {
    if (this.#retrying) return;
    this.#retrying = true;
    try {
      for (const [identity, entry] of this.#pending) {
        try { await entry.files.rollback(); }
        catch { continue; }
        try {
          entry.files.resumed(() => {
            entry.settled();
            this.#pending.delete(identity);
            this.#report({ event: 'launch-recovered', session: entry.name, sessionId: identity });
          });
        } catch { /* keep the pending entry if observer cleanup could not settle */ }
      }
      if (!this.#pending.size && this.#timer) { clearInterval(this.#timer); this.#timer = null; }
    } finally { this.#retrying = false; }
  }

  close(): void { if (this.#timer) clearInterval(this.#timer); this.#timer = null; }
}
