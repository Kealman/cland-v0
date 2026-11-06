import { lstat, mkdir, rmdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { run, nativeCommandFailure } from './command.ts';
export type FileBirth = { dev: number; ino: number };
export type CheckoutOwnership = { root: string; path: string; directory: FileBirth; tip: string; gitFile?: FileBirth; gitDirectory?: string; gitDirectoryBirth?: FileBirth };
/** Shared validation for optional captured checkout receipts on agent operations. */
export function parseCheckoutOwnership(value: unknown): CheckoutOwnership {
  if (!value || typeof value !== 'object') throw new Error('invalid checkout receipt');
  const row=value as Record<string,unknown>;
  const text=(key:string)=>{const v=row[key];if(typeof v!=='string'||!v)throw new Error('invalid checkout '+key);return v;};
  const birth=(key:string)=>{const v=row[key] as FileBirth|undefined;if(!v || !Number.isSafeInteger(v.dev)||v.dev<0||!Number.isSafeInteger(v.ino)||v.ino<0)throw new Error('invalid checkout '+key);return {dev:v.dev,ino:v.ino};};
  return {root:text('root'),path:text('path'),tip:text('tip'),directory:birth('directory'),gitFile:birth('gitFile'),gitDirectory:text('gitDirectory'),gitDirectoryBirth:birth('gitDirectoryBirth')};
}
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const same = (a: FileBirth, b: FileBirth) => a.dev === b.dev && a.ino === b.ino;
async function info(path: string) { return lstat(path).catch(error => { if (!missing(error)) throw error; return null; }); }
async function git(env: NodeJS.ProcessEnv, cwd: string, args: string[], command: typeof run) {
  const result = await command('git', ['-c', 'gc.auto=0', ...args], env, 20000, false, undefined, 'utf8', cwd);
  if (result.error || result.code !== 0) throw nativeCommandFailure(result,'prepared Git inspection failed');
  return result.stdout.trim();
}
/** Reserve the exact directory before Git starts; existing paths confer no cleanup ownership. */
export async function reserveCheckout(env: NodeJS.ProcessEnv, args: Record<string, unknown>, command = run): Promise<CheckoutOwnership | undefined> {
  if (typeof args.root !== 'string' || typeof args.path !== 'string' || typeof args.branch !== 'string') throw new Error('invalid worktree');
  if (args.reuseOnly || await info(args.path)) return undefined;
  const territory = args.territory as {tip?: string} | undefined;
  const tip = territory?.tip ?? await git(env, args.root, ['rev-parse', '--verify', '--end-of-options', args.branch + '^{commit}'], command);
  await mkdir(args.path, { mode: 0o700 });
  const directory = await lstat(args.path);
  return { root: args.root, path: args.path, directory: {dev:directory.dev,ino:directory.ino}, tip };
}
export async function observeCheckout(env: NodeJS.ProcessEnv, ownership: CheckoutOwnership, command = run): Promise<void> {
  const directory = await info(ownership.path);
  if (!directory || !same(directory,ownership.directory)) throw new Error('prepared checkout directory changed; cleanup incomplete');
  const dotGit = await lstat(join(ownership.path,'.git'));
  if (!dotGit.isFile()) throw new Error('prepared checkout git identity unavailable');
  const tip = await git(env, ownership.path, ['rev-parse','HEAD'],command);
  const common = await realpath(await git(env, ownership.path, ['rev-parse','--path-format=absolute','--git-common-dir'],command));
  const expected = await realpath(await git(env, ownership.root, ['rev-parse','--path-format=absolute','--git-common-dir'],command));
  if (tip !== ownership.tip || common !== expected) throw new Error('prepared checkout repository or tip changed; cleanup incomplete');
  ownership.gitFile = {dev:dotGit.dev,ino:dotGit.ino};
  ownership.gitDirectory = await realpath(await git(env, ownership.path, ['rev-parse','--absolute-git-dir'],command));
  const metadata=await lstat(ownership.gitDirectory);ownership.gitDirectoryBirth={dev:metadata.dev,ino:metadata.ino};
}
export async function validateCheckout(env:NodeJS.ProcessEnv,ownership:CheckoutOwnership, command = run) {
  const current={...ownership};await observeCheckout(env,current,command);
  if(!ownership.gitFile||!current.gitFile||!same(ownership.gitFile,current.gitFile)||current.gitDirectory!==ownership.gitDirectory||!ownership.gitDirectoryBirth||!current.gitDirectoryBirth||!same(ownership.gitDirectoryBirth,current.gitDirectoryBirth))throw new Error('prepared checkout metadata replaced; cleanup incomplete');
}
/** Never remove a replacement directory/checkout, and never use recursive/forced removal. */
export async function cleanupCheckout(env: NodeJS.ProcessEnv, ownership: CheckoutOwnership, gitCompleted: boolean, command = run): Promise<void> {
  const directory = await info(ownership.path);
  if (!directory) return;
  if (!same(directory,ownership.directory)) throw new Error('prepared checkout replaced; cleanup incomplete');
  const dotGit = await info(join(ownership.path,'.git'));
  if (!dotGit) { await rmdir(ownership.path); return; }
  if (!gitCompleted || !ownership.gitFile || !same(dotGit,ownership.gitFile)) throw new Error('prepared checkout creation unconfirmed; cleanup incomplete');
  await validateCheckout(env,ownership,command);
  await git(env,ownership.root,['worktree','remove','--',ownership.path],command);
  if (await info(ownership.path)) throw new Error('prepared checkout removal incomplete');
}
