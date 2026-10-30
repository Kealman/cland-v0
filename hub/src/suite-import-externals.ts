import { builtinModules } from 'node:module';
import { posix } from 'node:path';

/** Candidate declarations, never live node_modules, prove registry packages external. */
export function externalModuleProof(read: (path: string) => Promise<string | undefined>) {
  const manifests = new Map<string, Promise<Record<string, unknown> | undefined>>();
  const manifest = (file: string) => {
    let pending = manifests.get(file);
    if (!pending) {
      pending = read(file).then(text => {
        if (text === undefined) return undefined;
        let value: unknown;
        try { value = JSON.parse(text); } catch { throw new Error('incomplete import graph: malformed package manifest'); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('incomplete import graph: malformed package manifest');
        return value as Record<string, unknown>;
      });
      manifests.set(file, pending);
    }
    return pending;
  };
  let localNames: Promise<Set<string>> | undefined;
  const workspaces = () => localNames ??= (async () => {
    const root = await manifest('package.json');
    const names = new Set<string>();
    if (typeof root?.name === 'string') names.add(root.name);
    const raw = root?.workspaces;
    const paths = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as Record<string, unknown>).packages : [];
    if (!Array.isArray(paths)) throw new Error('incomplete import graph: unsupported workspace manifest');
    for (const path of paths) {
      if (typeof path !== 'string' || /[*?{}[\]\\]/.test(path) || posix.isAbsolute(path) || path.split('/').includes('..')) throw new Error('incomplete import graph: unresolved workspace pattern');
      const entry = await manifest(posix.join(path, 'package.json'));
      if (!entry || typeof entry.name !== 'string') throw new Error('incomplete import graph: missing workspace identity');
      names.add(entry.name);
    }
    return names;
  })();
  return async (source: string, specifier: string, resolveOnly = false): Promise<boolean> => {
    if (specifier.startsWith('node:') || builtinModules.includes(specifier)) return !resolveOnly;
    if (!/^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+(?:\/[^\s]*)?$/.test(specifier)) return false;
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
    if ((await workspaces()).has(name)) return false;
    let directory = posix.dirname(source);
    for (;;) {
      const entry = await manifest(posix.join(directory, 'package.json'));
      if (entry) {
        for (const field of (resolveOnly ? ['dependencies', 'devDependencies', 'optionalDependencies'] : ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])) {
          const dependencies = entry[field];
          if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies) || !Object.hasOwn(dependencies, name)) continue;
          const version = (dependencies as Record<string, unknown>)[name];
          // Only registry semver/tags and npm aliases; local, Git and URL specs stay unknown.
          return typeof version === 'string' && (/^[~^<>=*0-9]/.test(version) && /^[~^<>=*0-9a-zA-Z. |+-]+$/.test(version) || /^[a-zA-Z][a-zA-Z0-9._-]*$/.test(version) || /^npm:(?:@[\w.-]+\/)?[\w.-]+@[~^<>=*0-9][~^<>=*0-9a-zA-Z. |+-]*$/.test(version));
        }
      }
      if (directory === '.') return false;
      directory = posix.dirname(directory);
    }
  };
}
