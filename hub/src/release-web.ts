// cland's opt-in product assets; generic project releases do not use this module.
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { territoryGitAsync } from './territory.ts';
import { suiteCommand } from './suite-command.ts';
import { webBundleState } from './web-bundle.ts';
import type { Resumed } from './hub/worktrees.ts';

export const WEB_ARCHIVE = 'cland-web.tar.gz';
export const WEB_CHECKSUM = `${WEB_ARCHIVE}.sha256`;
export type WebReleasePlan = { repo: string; directory: string; sha256: string; bytes: number; checksumBytes: number; published?: boolean };
export type WebReleaseResult = Omit<WebReleasePlan, 'directory' | 'published'> & { archive: string; checksum: string; status: 'planned' | 'published' };
const exec = promisify(execFile);
export type AssetCommand = (file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv) => Promise<string>;
const command: AssetCommand = async (file, args, cwd, env) => {
  try { return (await exec(file, args, { cwd, env: { ...env, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1' }, timeout: 120_000, maxBuffer: 1024 * 1024 })).stdout; }
  catch (err) {
    // gh may include authentication diagnostics; never copy its output into a hub log.
    throw new Error(`${file} ${args[0]} failed (${(err as NodeJS.ErrnoException).code ?? 'incomplete'}); check the release machine's tools and existing gh authentication`);
  }
};

export const webReleaseResult = (plan: WebReleasePlan, status: WebReleaseResult['status']): WebReleaseResult => {
  const { directory: _directory, published: _published, ...facts } = plan;
  return { ...facts, archive: WEB_ARCHIVE, checksum: WEB_CHECKSUM, status };
};
export const webReleaseDescription = (result: WebReleaseResult, version: string): string =>
  `Web bundle ${result.status}: ${result.repo} ${version}\n${result.archive} ${result.bytes} bytes; ${result.checksum} ${result.checksumBytes} bytes\nsha256 ${result.sha256}`;

export async function checkWebRelease(root: string, env: NodeJS.ProcessEnv, run: AssetCommand = command): Promise<void> {
  await run('gh', ['auth', 'status', '--active', '--hostname', 'github.com'], root, env);
}

async function assetFacts(directory: string) {
  const archive = await readFile(join(directory, WEB_ARCHIVE));
  const sha256 = createHash('sha256').update(archive).digest('hex');
  const checksum = await readFile(join(directory, WEB_CHECKSUM), 'utf8');
  if (checksum !== `${sha256}  ${WEB_ARCHIVE}\n`) throw new Error('Web release cache checksum differs; preserve it and reconcile before release');
  return { directory, sha256, bytes: archive.length, checksumBytes: Buffer.byteLength(checksum) };
}

/** Cache by immutable commit, so preview, approval and retry name the exact same bytes.
 * Build from Git's archive, never the live checkout's ignored web/dist or node_modules.
 */
export async function buildWebRelease(root: string, commit: string, env: NodeJS.ProcessEnv): Promise<Omit<WebReleasePlan, 'repo'>> {
  const cache = join(root, '.cland', 'release-web', commit);
  try { return await assetFacts(cache); }
  catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
  const parent = join(root, '.cland', 'release-web');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'build-'));
  const source = join(directory, 'source');
  await mkdir(source);
  // Retain build roots on success and failure: a build tool can leave native
  // descendants unwinding after its command exits. Never delete their cwd.
  await territoryGitAsync(root, ['archive', '--format=tar', `--output=${join(directory, 'source.tar')}`, commit], false, undefined, env);
  await command('tar', ['-xf', join(directory, 'source.tar'), '-C', source], root, env);
  const result = await suiteCommand('npm ci --include=dev --ignore-scripts --no-audit --no-fund && npm run build', source, env);
  if (result.code !== 0) throw new Error(`Web release build incomplete: exit ${result.code}; ${result.cause || 'see build output'}; retained ${directory}`);
  if ((await webBundleState(source)).state !== 'current') throw new Error(`Web release build has no current source stamp; retained ${directory}`);
  await command('tar', ['--format=ustar', '-czf', join(directory, WEB_ARCHIVE), '-C', source, 'web/dist'], root, env);
  const bytes = await readFile(join(directory, WEB_ARCHIVE));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(directory, WEB_CHECKSUM), `${sha256}  ${WEB_ARCHIVE}\n`);
  await rename(directory, cache);
  return assetFacts(cache);
}

/** Read back existing remote bytes on retries. Never clobber a conflicting asset. */
export async function publishWebRelease(root: string, plan: WebReleasePlan, version: string, notes: string, env: NodeJS.ProcessEnv, resumed: Resumed, authorize: () => void, run: AssetCommand = command): Promise<void> {
  const facts = await assetFacts(plan.directory);
  if (facts.sha256 !== plan.sha256 || facts.bytes !== plan.bytes || facts.checksumBytes !== plan.checksumBytes) throw new Error('Pinned Web release assets changed; restore the approved bytes');
  const repo = ['--repo', plan.repo];
  resumed(authorize);
  // List rather than treating an arbitrary view/auth/network failure as "absent".
  const releases = (await run('gh', ['api', '--paginate', `repos/${plan.repo}/releases`, '--jq', '.[].tag_name'], root, env)).trim().split('\n');
  if (!releases.includes(version)) {
    await writeFile(join(plan.directory, 'notes.txt'), notes);
    resumed(authorize);
    await run('gh', ['release', 'create', version, '--verify-tag', '--draft', '--title', version, '--notes-file', join(plan.directory, 'notes.txt'), ...repo], root, env);
  }
  const release = JSON.parse(await run('gh', ['release', 'view', version, '--json', 'assets,isDraft', ...repo], root, env)) as { assets: Array<{ name: string }>; isDraft: boolean };
  for (const name of [WEB_ARCHIVE, WEB_CHECKSUM]) {
    resumed(authorize);
    if (!release.assets.some(asset => asset.name === name)) {
      await run('gh', ['release', 'upload', version, join(plan.directory, name), ...repo], root, env);
    }
    const receipt = join(plan.directory, `${name}.remote`);
    await run('gh', ['release', 'download', version, '--pattern', name, '--output', receipt, '--clobber', ...repo], root, env);
    if (!(await readFile(receipt)).equals(await readFile(join(plan.directory, name)))) throw new Error(`Published ${name} differs from the approved bytes; refusing to replace it`);
  }
  if (release.isDraft) {
    resumed(authorize);
    await run('gh', ['release', 'edit', version, '--draft=false', ...repo], root, env);
  }
  const published = JSON.parse(await run('gh', ['release', 'view', version, '--json', 'assets,isDraft', ...repo], root, env)) as { assets: Array<{ name: string }>; isDraft: boolean };
  if (published.isDraft !== false || [WEB_ARCHIVE, WEB_CHECKSUM].some(name => !published.assets.some(asset => asset.name === name))) throw new Error('Web release publication incomplete: final asset receipt missing');
}
