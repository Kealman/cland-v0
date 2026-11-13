import { lstat, readFile, stat, symlink } from 'node:fs/promises';
import { join } from 'node:path';

/** Share and diagnose installs without replacing an existing install or running npm. */
export async function worktreeInstall(root: string, worktreePath: string, authorize: () => void = () => {}): Promise<string | undefined> {
  let warning: string | undefined;
  // Share the root install without ever running an installer under live readers.
  const modules = join(worktreePath, 'node_modules');
  const present = await lstat(modules).catch(err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  });
  if (!present && await stat(join(root, 'node_modules')).then(s => s.isDirectory(), () => false)) {
    authorize();
    await symlink(join(root, 'node_modules'), modules, 'dir');
  }
  const installation = await lstat(modules).catch(err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  });
  if (installation) {
    const readPackages = async (path: string): Promise<Record<string, { version?: string; integrity?: string; link?: boolean; optional?: boolean; os?: string[]; cpu?: string[] }> | null> => {
      try { return JSON.parse(await readFile(path, 'utf8')).packages ?? null; }
      catch { return null; }
    };
    const expected = await readPackages(join(worktreePath, 'package-lock.json'));
    const installed = await readPackages(join(modules, '.package-lock.json'));
    const applicable = (targets: string[] | undefined, host: string): boolean => !targets
      || !targets.includes(`!${host}`) && (targets.every(target => target.startsWith('!')) || targets.includes(host) || targets.includes('any'));
    let stale: string | undefined;
    if (expected) for (const [path, pkg] of Object.entries(expected)) {
      if (!path.includes('node_modules/') || pkg.link) continue;
      // npm legitimately omits optional packages, notably other platforms' bindings.
      if (pkg.optional && (!installed?.[path] || !applicable(pkg.os, process.platform) || !applicable(pkg.cpu, process.arch))) continue;
      if (!installed?.[path] || installed[path].version !== pkg.version || installed[path].integrity !== pkg.integrity
        || path.startsWith('/') || path.split('/').some(part => part === '..' || part === '.')) { stale = path; break; }
      try {
        const actual = JSON.parse(await readFile(join(worktreePath, path, 'package.json'), 'utf8'));
        if (pkg.version !== undefined && actual.version !== pkg.version) { stale = path; break; }
      } catch { stale = path; break; }
    }
    if (stale || !installation.isSymbolicLink() && !expected) {
      warning = `stale worktree install: ${worktreePath} holds ${installation.isSymbolicLink() ? 'a node_modules link' : 'its own node_modules'}; dependencies out of date or unverified${stale ? ` (${stale})` : ''}. Update the root with npm install only when shared readers are stopped; preserve any own install until it can safely be replaced with a root link.`;
    }
  }
  if (!installation && await stat(join(root, 'package.json')).then(() => true, () => false)) {
    warning = `worktree ${worktreePath}: root node_modules at ${join(root, 'node_modules')} is missing; run npm install in the root before using dependencies`;
  }
  return warning;
}
