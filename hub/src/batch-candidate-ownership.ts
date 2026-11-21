import { randomUUID } from 'node:crypto';
import { lstat, realpath, open } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { territoryGitAsync } from './territory.ts';
import { committedTreeOrThrow } from './verification-tree.ts';
import { removeWorktreeWithFixtures, type FixtureProcesses } from './fixture-processes.ts';
import type { SuiteCommandClosure, SuiteCommandClosed } from './suite-command.ts';
import { durableJson } from './executor/droplet/lease.ts';

type CommandFence = { id: string; closed: boolean };
const commandFences = new WeakMap<CandidateOwnership, CommandFence>();
const commandMarker = (owner: CandidateOwnership) => join(owner.gitdir, 'cland-check-owner.json');
const commandHost = () => ({ read: (path: string) => smallFile(path, 262144), write: async (path: string, text: string) => durableJson(path, JSON.parse(text)) });
async function commandRecord(owner: CandidateOwnership, host: Pick<CandidateOwnershipHost, 'read'>): Promise<string | null> {
  try { return await host.read(commandMarker(owner)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
/** Durable obligation before command admission; a copied record never supplies
 * this live owner's positive close authority and cannot authorize a signal. */
export async function beginCandidateCommand(candidate: Candidate, host: Pick<CandidateOwnershipHost, 'read' | 'write'> = commandHost()): Promise<{ complete(receipt: SuiteCommandClosed): Promise<void>; retain(receipt: SuiteCommandClosure): Promise<void> }> {
  const owner = candidate.owner;
  if (!owner || await commandRecord(owner, host) !== null) throw new Error('candidate command closure unconfirmed; root preserved');
  const fence = { id: randomUUID(), closed: false };
  commandFences.set(owner, fence);
  const write = (state: string, receipt?: SuiteCommandClosure) => host.write(commandMarker(owner), JSON.stringify({ version: 1, owner: owner.id, command: fence.id, state,
    ...(receipt ? { native: { state: receipt.state, pid: receipt.pid, birth: receipt.birth, captured: receipt.captured, unverified: receipt.unverified, nativeClose: receipt.nativeClose } } : {}) }));
  await write('pending');
  return {
    complete: async receipt => {
      if (receipt.state !== 'closed' || commandFences.get(owner) !== fence) throw new Error('candidate command closure unconfirmed; root preserved');
      await write('closed', receipt);
      fence.closed = true;
    },
    retain: receipt => write('incomplete', receipt),
  };
}
async function requireCommandClosure(candidate: Candidate, host: Pick<CandidateOwnershipHost, 'read'>): Promise<void> {
  const owner = candidate.owner!;
  const text = await commandRecord(owner, host);
  const fence = commandFences.get(owner);
  if (text === null && !fence) return; // No check command was admitted for this checkout.
  if (text === null) throw new Error('candidate command closure unconfirmed; root preserved');
  const row = JSON.parse(text) as { version: number; owner: string; command: string; state: string };
  if (!fence?.closed || row.version !== 1 || row.owner !== owner.id || row.command !== fence.id || row.state !== 'closed') throw new Error('candidate command closure unconfirmed; root preserved');
}

export type CandidateOwnership = { id: string; root: string; cwd: string; gitdir: string; rootBirth: string; birth: string; gitBirth: string; head: string; tree: string };
type Candidate = { cwd: string; head: string; tree: string; owner?: CandidateOwnership };
/** Missing admission authority is distinct from a changed/replaced checkout. */
export class CandidateOwnershipUnavailable extends Error {
  readonly code = 'ownership-unavailable';
  constructor() { super('candidate cleanup ownership unavailable; root preserved'); }
}
export type CandidateOwnershipHost = {
  inspect(root: string, candidate: Candidate): Promise<Omit<CandidateOwnership, 'id'>>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
};
async function smallFile(path: string, limit = 16384): Promise<string> {
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > limit) throw new Error(limit === 16384 ? 'candidate ownership file exceeds 16 KiB' : 'candidate ownership file exceeds byte limit');
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await file.close(); }
}
function native(env: NodeJS.ProcessEnv): CandidateOwnershipHost {
  const birth = async (path: string) => {
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('candidate ownership directory replaced');
    return `${info.dev}:${info.ino}:${info.birthtimeMs}`;
  };
  return {
    read: smallFile,
    async write(path, text) {
      const file = await open(path, 'wx', 0o600);
      try { await file.writeFile(text); await file.sync(); } finally { await file.close(); }
    },
    async inspect(root, candidate) {
      const project = await realpath(root), cwd = await realpath(candidate.cwd);
      const gitfile = /^gitdir: (.+)\r?\n?$/.exec(await smallFile(join(cwd, '.git')));
      if (!gitfile) throw new Error('candidate has no linked worktree identity');
      const gitdir = await realpath(resolve(cwd, gitfile[1]!));
      const commonRaw = await territoryGitAsync(cwd, ['rev-parse', '--git-common-dir'], false, undefined, env);
      const projectRaw = await territoryGitAsync(project, ['rev-parse', '--git-common-dir'], false, undefined, env);
      const common = await realpath(isAbsolute(commonRaw) ? commonRaw : resolve(cwd, commonRaw));
      const projectCommon = await realpath(isAbsolute(projectRaw) ? projectRaw : resolve(project, projectRaw));
      if (common !== projectCommon || dirname(gitdir) !== join(common, 'worktrees')) throw new Error('candidate belongs to another repository');
      const head = await territoryGitAsync(cwd, ['rev-parse', 'HEAD'], false, undefined, env);
      const tree = await committedTreeOrThrow(cwd, head, env);
      return { root: project, cwd, gitdir, rootBirth: await birth(project), birth: await birth(cwd), gitBirth: await birth(gitdir), head, tree };
    },
  };
}
const marker = (owner: CandidateOwnership) => join(owner.gitdir, 'cland-batch-owner.json');
/** Called only for the worktree this checkout operation just created. */
export async function captureCandidateOwnership(root: string, candidate: Candidate, env: NodeJS.ProcessEnv, host: CandidateOwnershipHost = native(env)): Promise<void> {
  const observed = await host.inspect(root, candidate);
  if (observed.head !== candidate.head || observed.tree !== candidate.tree) throw new Error('candidate checkout identity differs from admitted commit');
  const owner = { ...observed, id: randomUUID() };
  await host.write(marker(owner), JSON.stringify(owner));
  candidate.owner = owner;
}
/** Serialized ownership is only a claim; both native birth and private marker must match. */
export async function requireCandidateOwnership(root: string, candidate: Candidate, env: NodeJS.ProcessEnv, host: CandidateOwnershipHost = native(env)): Promise<void> {
  if (!candidate.owner) throw new CandidateOwnershipUnavailable();
  const observed = await host.inspect(root, candidate);
  const expected = { ...candidate.owner }; delete (expected as Partial<CandidateOwnership>).id;
  if (JSON.stringify(observed) !== JSON.stringify(expected) || observed.head !== candidate.head || observed.tree !== candidate.tree
    || await host.read(marker(candidate.owner)) !== JSON.stringify(candidate.owner)) throw new Error('candidate cleanup ownership changed; root preserved');
}

/** The same ownership fence surrounds process guarding and its final removal callback. */
export async function removeOwnedBatchCandidate<T>(root: string, candidate: Candidate, env: NodeJS.ProcessEnv, remove: () => Promise<T>, host?: CandidateOwnershipHost, processes?: FixtureProcesses): Promise<T> {
  await requireCandidateOwnership(root, candidate, env, host);
  await requireCommandClosure(candidate, host ?? commandHost());
  return removeWorktreeWithFixtures(candidate.owner!.cwd, async () => {
    await requireCandidateOwnership(root, candidate, env, host);
    await requireCommandClosure(candidate, host ?? commandHost());
    return remove();
  }, processes);
}
