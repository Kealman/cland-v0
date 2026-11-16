import { missingReleaseTool } from './release-tools.ts';

export type PreflightCheck = { name: string; status: 'ok' | 'refused' | 'unknown'; detail: string };
export type ReleasePreflight = { preflight: true; mode: 'report'; version: string | null; commit: string | null; checks: PreflightCheck[] };
export type PreflightIO = {
  lookup(tool: string): Promise<string | null>;
  auth(gh: string): Promise<void>;
  git(args: string[]): Promise<string>;
  /** Read a file from committed dev; absent paths return null, other failures reject. */
  read(path: string): Promise<string | null>;
  managedIgnore(text: string | null): boolean;
};

export function packageVersionCheck(name: string, actual: unknown, version: string): PreflightCheck {
  return { name, status: actual === version.slice(1) ? 'ok' : 'refused', detail: actual === version.slice(1) ? version : `dev's ${name} says ${String(actual)}, the release is ${version}: commit the version bump before covers` };
}

/** Advisory only: no cover, build, fetch, publication or tracker mutation boundary exists here. */
export async function releasePreflight(version: string | undefined, io: PreflightIO): Promise<ReleasePreflight> {
  const checks: PreflightCheck[] = [];
  const check = async (name: string, run: () => Promise<string>) => {
    try { checks.push({ name, status: 'ok', detail: await run() }); }
    catch { checks.push({ name, status: 'unknown', detail: `${name} could not be inspected; repair the hub's tools or project state and retry` }); }
  };
  let gh: string | null = null;
  for (const tool of ['gh', 'git', 'tar']) {
    try {
      const path = await io.lookup(tool);
      if (tool === 'gh') gh = path;
      checks.push({ name: `tool:${tool}`, status: path ? 'ok' : 'refused', detail: path ?? missingReleaseTool(tool) });
    } catch { checks.push({ name: `tool:${tool}`, status: 'unknown', detail: 'hub PATH lookup incomplete' }); }
  }
  if (!gh) checks.push({ name: 'gh-auth', status: 'unknown', detail: 'gh authentication unexecuted: gh is unavailable on the hub PATH' });
  else {
    try { await io.auth(gh); checks.push({ name: 'gh-auth', status: 'ok', detail: 'existing github.com authentication' }); }
    catch { checks.push({ name: 'gh-auth', status: 'refused', detail: 'gh authentication failed or incomplete; check existing github.com authentication on the hub machine' }); }
  }
  let commit: string | null = null;
  await check('dev', async () => { commit = await io.git(['rev-parse', '--verify', 'refs/heads/dev']); return commit; });
  try {
    const dirty = await io.git(['status', '--porcelain']);
    checks.push({ name: 'clean-root', status: dirty ? 'refused' : 'ok', detail: dirty ? 'the project root is dirty; commit or preserve its work before covers' : 'clean' });
  } catch { checks.push({ name: 'clean-root', status: 'unknown', detail: 'root status could not be inspected' }); }
  if (!version) checks.push({ name: 'version', status: 'refused', detail: 'set the release item version first' });
  for (const file of ['package.json', 'package-lock.json']) {
    try {
      const text = await io.read(file);
      if (text === null) { checks.push({ name: file, status: 'ok', detail: 'absent; not applicable' }); continue; }
      const pkg = JSON.parse(text) as { version?: unknown; packages?: Record<string, { version?: unknown }> };
      if (Object.hasOwn(pkg, 'version') && version) checks.push(packageVersionCheck(file, pkg.version, version));
      else checks.push({ name: file, status: version ? 'ok' : 'unknown', detail: version ? 'no version key; not applicable' : 'release version unavailable' });
      if (file === 'package-lock.json' && pkg.packages?.[''] && Object.hasOwn(pkg.packages[''], 'version') && version) checks.push(packageVersionCheck('package-lock.json packages[""]', pkg.packages[''].version, version));
    } catch { checks.push({ name: file, status: 'unknown', detail: 'committed version file could not be read or parsed' }); }
  }
  try {
    const current = io.managedIgnore(await io.read('.cland/.gitignore'));
    checks.push({ name: 'managed-header', status: current ? 'ok' : 'refused', detail: current ? 'committed managed ignore is stable (or project-owned)' : 'committed .cland/.gitignore would be rewritten by hub startup; refresh and commit it before covers' });
  } catch { checks.push({ name: 'managed-header', status: 'unknown', detail: 'committed managed ignore could not be inspected' }); }
  return { preflight: true, mode: 'report', version: version ?? null, commit, checks };
}

export const preflightDescription = (result: ReleasePreflight): string => `Release preflight (report only): ${result.version ?? 'version unknown'} at ${result.commit ?? 'commit unknown'}\n${result.checks.map(c => `${c.status}: ${c.name}: ${c.detail}`).join('\n')}\nCovers, remote refs and builds are unexecuted; run the final dry-run before publication.\n`;
