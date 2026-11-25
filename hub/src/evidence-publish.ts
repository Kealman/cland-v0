/** Repository evidence publication. The callback must be this session's artifact.create tool. */
import { mkdtemp, mkdir, open, readdir, lstat, writeFile, rm } from 'node:fs/promises';
import { join, resolve, basename, dirname } from 'node:path';
import { randomBytes, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { assertPublishable } from '../../.agents/skills/qa/qa-demo-policy.ts';
import { scanCapture } from '../../site/scripts/capture-safety.ts';
import { evidenceSnapshotStagingPrefix } from './state-paths.ts';
import { HubRefusal } from '../../shared/socket-client.ts';

export type EvidenceArgs = { path: string; title: string; kind: string; topic: string; retryKey?: string };
export type ScanReceipt = { path: string; exitCode: number | null; controlMatched: boolean; matches: string[] };
type Scan = (path: string, files: ReadonlyMap<string, Buffer>, control: string) => Promise<ScanReceipt>;
export type SnapshotDisposition = { state: 'not-created' | 'removed' | 'retained' | 'unknown'; cleanup: 'not-needed' | 'complete' | 'failed' };
export type SnapshotLifecycle = {
  createRoot: () => Promise<string>;
  removeRoot: (root: string) => Promise<void>;
  onDisposition: (receipt: SnapshotDisposition) => void;
};
const lifecycle: SnapshotLifecycle = {
  createRoot: () => mkdtemp(evidenceSnapshotStagingPrefix()),
  removeRoot: root => rm(root, { recursive: true, force: true }),
  onDisposition: receipt => {
    if (receipt.cleanup === 'failed') process.stderr.write(JSON.stringify({ type: 'evidence-snapshot', ...receipt }) + '\n');
  },
};
const safeErrors = new WeakSet<Error>();
function refuse(message: string): Error {
  const error = new Error(`Evidence refused: ${message}`);
  safeErrors.add(error);
  return error;
}

function unsafe(text: string, control: string): boolean {
  try { assertPublishable(text); scanCapture(text, control); return false; }
  catch { return true; }
}

/** No match values or scanner exceptions cross this boundary. Positions are containing lines. */
export const scanEvidence: Scan = async (path, files, control) => {
  const matches: string[] = [];
  let qaControl = false, captureControl = false;
  try { assertPublishable(control); } catch { qaControl = true; }
  try { scanCapture(control, control); } catch { captureControl = true; }
  for (const [name, bytes] of files) {
    const label = unsafe(name, control) ? `file-${createHash('sha256').update(name).digest('hex').slice(0, 16)}` : name;
    if (unsafe(name, control)) matches.push(`${label}:1:1 (filename)`);
    for (const encoding of ['utf8', 'utf16le'] as const) {
      const text = bytes.toString(encoding);
      if (!unsafe(text, control)) continue;
      let found = false;
      for (const [index, line] of text.split('\n').entries()) {
        if (unsafe(line, control)) { matches.push(`${label}:${index + 1}:1 (${encoding}, containing line)`); found = true; }
      }
      if (!found) matches.push(`${label}:1:1 (${encoding}, cross-line)`);
    }
  }
  return { path, exitCode: matches.length ? 1 : 0, controlMatched: qaControl && captureControl, matches };
};

/** Scan a private snapshot and publish those exact bytes. No source path reaches the tool. */
export async function publishEvidence<T>(args: EvidenceArgs, artifactCreate: (args: EvidenceArgs) => Promise<T>,
  scan: Scan = scanEvidence, storage: SnapshotLifecycle = lifecycle,
  replayUnknown = false): Promise<T> {
  let root: string | undefined;
  let result: T | undefined, failure: Error | undefined;
  const files = new Map<string, Buffer>();
  let kept = 0;
  let publicationStarted = false, publicationCompleted = false;
  let uncertainAttempt = false;
  const limit = 50 * 1024 * 1024;
  async function copy(source: string, target: string, name: string): Promise<void> {
    const info = await lstat(source);
    if (info.isSymbolicLink()) throw refuse('symbolic link');
    if (info.isDirectory()) {
      const entries = await readdir(source);
      if (!entries.length) throw refuse('empty directory:1:1');
      await mkdir(target, { recursive: true, mode: 0o700 });
      for (const entry of entries) await copy(join(source, entry), join(target, entry), name ? `${name}/${entry}` : entry);
    } else if (info.isFile()) {
      const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const chunks: Buffer[] = [];
      try {
        if (!(await handle.stat()).isFile()) throw refuse('file changed during snapshot');
        for await (const chunk of handle.createReadStream()) {
          kept += chunk.length;
          if (kept > limit) throw refuse('snapshot exceeds 50 MiB');
          chunks.push(chunk);
        }
      } finally { await handle.close(); }
      const bytes = Buffer.concat(chunks);
      files.set(name, bytes);
      await mkdir(dirname(target), { recursive: true, mode: 0o700 });
      await writeFile(target, bytes, { mode: 0o600 });
    } else throw refuse('unsupported file type');
  }
  try {
    root = await storage.createRoot();
    const source = resolve(args.path);
    const info = await lstat(source);
    const target = join(root, 'payload', basename(source));
    await copy(source, target, info.isDirectory() ? '' : basename(source));
    if (!files.size) throw refuse('no files');
    // Synthetic, generated per call, never written to disk or passed in argv.
    const control = `${['Bear', 'er'].join('')} ${randomBytes(24).toString('hex')}`;
    if (unsafe(basename(source), control)) throw refuse('root-filename:1:1');
    if (unsafe(JSON.stringify({ title: args.title, kind: args.kind, topic: args.topic, retryKey: args.retryKey }), control)) {
      throw refuse('metadata:1:1');
    }
    const receipt = await scan(target, files, control);
    if (receipt.path !== target || receipt.exitCode !== 0 || receipt.controlMatched !== true || receipt.matches.length) {
      // Recompute diagnostics with the trusted scanner: an injected scanner's text may contain secrets.
      const diagnostic = await scanEvidence(target, files, control);
      throw refuse(`incomplete or unsafe scan${diagnostic.matches.length ? '\n' + diagnostic.matches.join('\n') : ''}`);
    }
    publicationStarted = true;
    const payload = { ...args, path: target, retryKey: args.retryKey ?? randomBytes(24).toString('hex') };
    try { result = await artifactCreate(payload); }
    catch (error) {
      if (error instanceof HubRefusal || !replayUnknown) throw error;
      uncertainAttempt = true;
      // The durable actor/key/fingerprint receipt is the only recovery identity.
      result = await artifactCreate(payload);
    }
    publicationCompleted = true;
  } catch (error) {
    if (publicationStarted && error instanceof HubRefusal) {
      publicationCompleted = !uncertainAttempt; // An earlier unknown attempt may still have a reader.
      failure = refuse(`hub refused (${error.refusalCode ?? 'unknown'}): ${error.message}`);
    } else {
      failure = error instanceof Error && safeErrors.has(error) ? error : refuse(publicationStarted
        ? 'publication outcome unknown; snapshot retained; reconcile session artifacts before retrying'
        : 'snapshot or scan failed; private diagnostic withheld');
    }
  }
  let disposition: SnapshotDisposition = { state: root ? 'retained' : 'not-created', cleanup: 'not-needed' };
  // A rejected transport may still have a reader copying this snapshot.
  if (root && (!publicationStarted || publicationCompleted)) {
    try { await storage.removeRoot(root); disposition = { state: 'removed', cleanup: 'complete' }; }
    catch {
      // A rejection alone proves neither presence nor absence after partial cleanup.
      let state: SnapshotDisposition['state'] = 'unknown';
      try { await lstat(root); state = 'retained'; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') state = 'removed'; }
      disposition = { state, cleanup: 'failed' };
    }
  }
  if (failure) Object.assign(failure, { snapshot: disposition });
  try { storage.onDisposition(disposition); }
  catch {
    try { process.stderr.write('Evidence secondary diagnostic delivery failed; selected outcome preserved.\n'); }
    catch { /* A closed diagnostic sink cannot replace the selected outcome. */ }
  }
  if (failure) throw failure;
  return result as T;
}

/** Use the authenticated tool transport of the calling cland session, with no credential output. */
export async function publishSessionEvidence(args: EvidenceArgs,
  context = { env: process.env, cwd: process.cwd() }): Promise<unknown> {
  const { sessionOf } = await import('./cli/actor.ts');
  const actor = sessionOf(context.env);
  if (!actor) throw refuse('run inside the publishing cland session');
  const { hubDiscovery, readDiscovery } = await import('./project.ts');
  const discovery = readDiscovery(hubDiscovery(context.cwd, context.env));
  if (!discovery) throw refuse('no running hub');
  const { askHubFrame } = await import('./cli/socket-client.ts');
  return publishEvidenceTransport({ ...args, path: resolve(context.cwd, args.path) },
    frame => askHubFrame(discovery, { ...frame, as: actor }, undefined, context.env));
}

/** Session transport seam. Replays use the hub's durable actor/key receipt. */
export function publishEvidenceTransport(args: EvidenceArgs,
  request: (frame: {type: string} & Record<string, unknown>) => Promise<unknown>,
  storage: SnapshotLifecycle = lifecycle): Promise<unknown> {
  return publishEvidence(args, payload => request({type: 'artifact.create', ...payload}), scanEvidence, storage, true);
}
