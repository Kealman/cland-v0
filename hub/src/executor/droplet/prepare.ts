import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Store } from '../../hub/store.ts';
import type { LogFn } from '../../log.ts';
import { DigitalOceanApi, DigitalOceanError, type Action, type SnapshotImage } from './api.ts';
import { durableJson, leaseDir, type DropletLease } from './lease.ts';
import { Machine, machineEnv, shellQuote } from './machine.ts';
import { pause, testTiming } from './watchdog.ts';
import { saveRecovery, recoverSnapshot, type SnapshotRecovery } from './snapshot-recovery.ts';
import type { Released } from '../executor.ts';

const exec = promisify(execFile);
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export type PrepareKey = { node: string; nvim: { tag: string; digest: string }; lock: string; base: string };
export type Snapshot = { image: number; name: string; key: PrepareKey; keyHash: string; regions: string[]; sizeGb: number; minDiskSize: number; created: string };
export const snapshotPath = (root: string): string => join(root, '.cland/run/executor/snapshot.json');
export const keyHash = (key: PrepareKey): string => hash(JSON.stringify(key)).slice(0, 12);
export const sameKey = (a: PrepareKey, b: PrepareKey): boolean => a.node === b.node && a.base === b.base && a.lock === b.lock && a.nvim.tag === b.nvim.tag && a.nvim.digest === b.nvim.digest;

export async function prepareKey(root: string, env: NodeJS.ProcessEnv = process.env): Promise<PrepareKey> {
  const git = async (...args: string[]) => (await exec('git', args, { cwd: root, env: machineEnv(env), timeout: 30000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  await git('fetch', 'origin', 'dev');
  const base = (await git('rev-parse', 'origin/dev')).trim();
  const node = (await exec(process.execPath, ['--version'], { cwd: root, env: machineEnv(env), timeout: 10000 })).stdout.trim();
  const tag = (await readFile(join(root, 'nvim/NVIM_VERSION'), 'utf8')).trim();
  const sums = await readFile(join(root, 'nvim/NVIM_SHA256SUMS'), 'utf8');
  const digest = sums.split('\n').find(line => /\s+nvim-linux-x86_64\.tar\.gz$/.test(line))?.split(/\s+/)[0];
  if (!/^v\d+\.\d+\.\d+$/.test(node) || !/^v\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.-]+)?$/.test(tag) || !digest || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('invalid Node or Neovim prepare pin');
  // Hash bytes, not decoded text: the lock input identifies the committed base.
  const lock = hash((await exec('git', ['show', `${base}:package-lock.json`], { cwd: root, env: machineEnv(env), timeout: 30000, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })).stdout);
  return { node, nvim: { tag, digest }, lock, base };
}
export async function readSnapshot(root: string): Promise<Snapshot | null> {
  try {
    const snapshot = JSON.parse(await readFile(snapshotPath(root), 'utf8')) as Snapshot;
    if (!Number.isSafeInteger(snapshot.image) || snapshot.image <= 0 || !snapshot.name || !Array.isArray(snapshot.regions) || !snapshot.regions.length || !snapshot.key || !snapshot.key.nvim || snapshot.keyHash !== keyHash(snapshot.key)) throw new Error('invalid prepared snapshot record');
    return snapshot;
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
export function staleParts(snapshot: Snapshot, current: PrepareKey): string[] {
  return (['base', 'lock', 'node', 'nvim'] as const).filter(part => JSON.stringify(snapshot.key[part]) !== JSON.stringify(current[part]));
}

export async function waitForMachine(root: string, lease: DropletLease, key?: PrepareKey, boundMs = 180000, signal?: AbortSignal, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const limit = Math.min(Date.parse(lease.deadline), Date.now() + testTiming('CLAND_TEST_DROPLET_MACHINE_MS', boundMs, env));
  const machine = new Machine(root, env);
  for (;;) {
    signal?.throwIfAborted();
    if (Date.now() >= limit) throw new Error('machine readiness deadline reached');
    let marker: string;
    try { marker = await machine.exec(lease, key ? 'true && cat "$HOME/.cland-image.json"' : 'test -f /var/lib/cland-ready && true', { timeoutMs: Math.min(10000, limit - Date.now()), signal }); }
    catch { await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, env), Math.max(0, limit - Date.now()))); continue; }
    if (!key) return;
    try { if (sameKey(JSON.parse(marker) as PrepareKey, key)) return; } catch { /* mismatch refuses */ }
    throw new Error('prepared image marker mismatch');
  }
}

export async function pollAction(api: DigitalOceanApi, action: Action, limit: number, signal?: AbortSignal, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  let current = action;
  for (;;) {
    signal?.throwIfAborted();
    if (current.status === 'completed') return;
    if (current.status === 'errored') throw new Error(`DigitalOcean action ${current.id} failed`);
    if (Date.now() >= limit) throw new Error('snapshot action deadline reached');
    await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, env), Math.max(0, limit - Date.now())));
    current = await api.action(current.id, limit);
  }
}

export type Prepared = { state: 'current' | 'prepared'; snapshot: Snapshot; durationMs: number; lifetimeMs: number | null; costUsd: number | null; summary: string };
type PrepareOptions = {
  env?: NodeJS.ProcessEnv;
  root: string; project: string; regions: string[]; tags: string[]; key: PrepareKey; maxDiskSize?: number; store?: Store | undefined; log: LogFn; signal?: AbortSignal | undefined;
  builder: (userData: string) => Promise<DropletLease>; release: (lease: DropletLease) => Promise<Released>; step: (step: string) => void;
};

/** A replacement is published only after delivery, actions and builder release succeed. */
export async function prepareSnapshot(options: PrepareOptions): Promise<Prepared> {
  const { root, key, log } = options;
  const env = options.env ?? process.env;
  let stage = 'key';
  const step = (value: string) => { stage = value; options.step(value); };
  const started = Date.now();
  const old = await readSnapshot(root);
  if (old && sameKey(old.key, key)) return prepared('current', old, started, { lifetimeMs: 0, costUsd: 0 });
  const api = new DigitalOceanApi(env);
  const name = `cland-${options.project}-${keyHash(key)}`;
  const recovery: SnapshotRecovery = { id: randomUUID(), name, started: new Date().toISOString(), phase: 'build', previous: old, requested: false, seen: [] };
  await saveRecovery(root, recovery);
  let builder: DropletLease | undefined;
  let image: SnapshotImage | undefined;
  let committed = false;
  let released: Released = { lifetimeMs: null, costUsd: null };
  try {
    step('builder');
    const template = await readFile(fileURLToPath(new URL('./provision.sh', import.meta.url)), 'utf8');
    builder = await options.builder(template.replace('__NODE_VERSION__', key.node).replace('__NVIM_VERSION__', key.nvim.tag).replace('__NVIM_SHA256__', key.nvim.digest));
    recovery.builder = builder.resource!; await saveRecovery(root, recovery);
    await waitForMachine(root, builder, undefined, 900000, options.signal, env);
    const machine = new Machine(root, env);
    const dir = leaseDir(root, builder);
    const timeout = () => Math.max(1, Math.min(1200000, Date.parse(builder!.deadline) - Date.now()));
    step('deliver');
    const origin = (await exec('git', ['remote', 'get-url', 'origin'], { cwd: root, env: machineEnv(env), timeout: 10000 })).stdout.trim();
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(origin)) throw new Error('prepare requires a local territory');
    const territory = isAbsolute(origin) ? origin : resolve(root, origin);
    const bundle = join(dir, 'base.bundle');
    await exec('git', [`--git-dir=${territory}`, 'bundle', 'create', bundle, 'refs/heads/dev'], { env: machineEnv(env), timeout: 120000, maxBuffer: 1024 * 1024 });
    await machine.put(builder, bundle, 'base.bundle', { timeoutMs: timeout(), signal: options.signal });
    await machine.exec(builder, `set -eu; git init --bare "$HOME/mirror.git"; git --git-dir="$HOME/mirror.git" fetch "$HOME/base.bundle" '+refs/heads/dev:refs/heads/dev'; git clone --no-hardlinks "$HOME/mirror.git" "$HOME/cland"; git -C "$HOME/cland" remote remove origin; git -C "$HOME/cland" checkout --detach ${shellQuote(key.base)}; rm "$HOME/base.bundle"`, { timeoutMs: timeout(), signal: options.signal });
    await rm(bundle, { force: true });
    step('install');
    await machine.exec(builder, 'set -eu; cd "$HOME/cland"; npm ci; if [ -f nvim/bin/nvim-path.ts ]; then node nvim/bin/nvim-path.ts; fi', { timeoutMs: timeout(), signal: options.signal });
    const marker = join(dir, 'image.json');
    await writeFile(marker, `${JSON.stringify(key)}\n`, { mode: 0o600 });
    await machine.put(builder, marker, '.cland-image.json', { timeoutMs: timeout(), signal: options.signal });
    await rm(marker, { force: true });
    step('clean');
    const keys = join(dir, 'cland-runner-keys.sh');
    await writeFile(keys, '#!/bin/sh\nset -eu\ninstall -d -m 700 -o runner -g runner /home/runner/.ssh\ninstall -m 600 -o runner -g runner /root/.ssh/authorized_keys /home/runner/.ssh/authorized_keys\n');
    await machine.put(builder, keys, 'cland-runner-keys.sh', { timeoutMs: timeout(), signal: options.signal });
    await machine.exec(builder, 'set -eu; cloud-init clean --logs; install -d /var/lib/cloud/scripts/per-boot; install -m 755 /home/runner/cland-runner-keys.sh /var/lib/cloud/scripts/per-boot/cland-runner-keys.sh; rm /home/runner/cland-runner-keys.sh; rm -f /root/.ssh/authorized_keys /home/runner/.ssh/authorized_keys /etc/ssh/ssh_host_*', { user: 'root', timeoutMs: timeout(), signal: options.signal });
    await rm(keys, { force: true });
    const limit = Math.min(Date.parse(builder.deadline), Date.now() + testTiming('CLAND_TEST_DROPLET_ACTION_MS', 1200000, env));
    step('power off');
    await pollAction(api, await api.dropletAction(builder.resource!, 'power_off', undefined, limit), limit, options.signal, env);
    step('snapshot');
    recovery.phase = 'snapshot'; recovery.requested = true; await saveRecovery(root, recovery);
    let action: Action;
    try { action = await api.dropletAction(builder.resource!, 'snapshot', name, limit); }
    catch (error) {
      if (error instanceof DigitalOceanError && error.status >= 400 && error.status < 500) { recovery.requested = false; await saveRecovery(root, recovery); }
      throw error;
    }
    recovery.action = action.id; await saveRecovery(root, recovery);
    await pollAction(api, action, limit, options.signal, env);
    recovery.actionState = 'completed'; await saveRecovery(root, recovery);
    image = (await api.snapshots(limit)).find(candidate => candidate.name === name);
    if (!image) throw new Error('completed snapshot image missing');
    step('transfer');
    for (const region of options.regions) if (!image.regions.includes(region)) await pollAction(api, await api.transferImage(image.id, region, limit), limit, options.signal, env);
    for (const tag of options.tags) await api.tagImage(image.id, tag);
    const imageId = image.id;
    for (;;) {
      options.signal?.throwIfAborted();
      image = (await api.snapshots(limit)).find(candidate => candidate.id === imageId);
      if (image && options.regions.every(region => image!.regions.includes(region))) break;
      // An action can complete before the snapshot catalogue reflects the copy.
      if (Date.now() >= limit) throw new Error('snapshot regions visibility deadline reached');
      await pause(Math.min(testTiming('CLAND_TEST_DROPLET_POLL_MS', 2000, env), Math.max(0, limit - Date.now())));
    }
    if (options.maxDiskSize !== undefined && image.min_disk_size > options.maxDiskSize) throw new Error('snapshot minimum disk exceeds run size');
    step('release');
    released = await options.release(builder);
    // A prepared image remains usable while the durable releasing lease is
    // retried by the hub and watchdog. Its lifetime and cost stay unconfirmed.
    const snapshot: Snapshot = { image: image.id, name: image.name, key, keyHash: keyHash(key), regions: image.regions, sizeGb: image.size_gigabytes, minDiskSize: image.min_disk_size, created: image.created_at };
    await mkdir(join(root, '.cland/run/executor'), { recursive: true, mode: 0o700 });
    recovery.candidate = snapshot; recovery.phase = 'retire'; recovery.retirement = 'unstarted'; await saveRecovery(root, recovery);
    await durableJson(snapshotPath(root), snapshot);
    options.store?.setMeta('executor-snapshot', JSON.stringify(snapshot));
    if (old) {
      step('retire');
      recovery.retirement = 'submitted'; await saveRecovery(root, recovery);
      try { await api.deleteSnapshot(old.image); }
      catch (error) {
        // Only a definite rejection permits rollback. A timeout plus old presence
        // does not establish the fate of an accepted, still-running DELETE.
        if (error instanceof DigitalOceanError && [400, 401, 403, 422, 429].includes(error.status)) {
          recovery.retirement = 'rejected'; await saveRecovery(root, recovery);
        }
        throw error;
      }
      recovery.retirement = 'accepted'; await saveRecovery(root, recovery);
    }
    committed = true;
    // Retain ownership if accepted retirement has not reached catalogue absence.
    await recoverSnapshot(root, recovery, options.store, env);
    const result = prepared('prepared', snapshot, started, released);
    log({ event: 'executor-prepared', key, image: image.id, regions: snapshot.regions, durationMs: result.durationMs, ...released });
    return result;
  } catch (error) {
    if (builder) released = await options.release(builder);
    if (!committed) {
      // Retiring uncertainty must be resolved before restoring either pointer.
      // Every other failure becomes durable cleanup of this builder's image.
      if (recovery.phase !== 'retire') { recovery.phase = 'cleanup'; await saveRecovery(root, recovery); }
      try { await recoverSnapshot(root, recovery, options.store, env); } catch { /* retained for restart/timer retries */ }
    }
    const cause = `${stage}: ${error instanceof Error ? error.message : 'snapshot preparation failed'}`;
    log({ event: 'executor-prepare-failed', key, image: image?.id ?? null, regions: options.regions, durationMs: Date.now() - started, ...released, cause });
    throw new Error(`${cause}; image ${image?.id ?? 'none'}; regions ${options.regions.join(', ')}; duration ${Date.now() - started}ms; builder lifetime ${released.lifetimeMs ?? 'unconfirmed'}ms, cost $${released.costUsd ?? 'unconfirmed'}`);
  }
}
function prepared(state: Prepared['state'], snapshot: Snapshot, started: number, released: Released): Prepared {
  const durationMs = Date.now() - started;
  return { state, snapshot, durationMs, ...released, summary: `snapshot ${state}: ${snapshot.name} image=${snapshot.image}\nkey ${JSON.stringify(snapshot.key)}\nregions ${snapshot.regions.join(', ')}; duration ${Math.round(durationMs / 1000)}s; builder lifetime ${released.lifetimeMs ?? 'unconfirmed'}ms; cost $${released.costUsd?.toFixed(4) ?? 'unconfirmed'}` };
}
