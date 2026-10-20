// Shared by the Vite stamp writer and doctor's read-only installed-bundle check.
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

export type WebSources = { digest: string; newest: number };
export type WebBuildStamp = { version: 1; sources: string; builtAt: number };

/** All bundle inputs, including filenames so additions and deletions invalidate the receipt. */
export async function webSources(root: string): Promise<WebSources> {
  const paths = ['package.json', 'package-lock.json', 'hub/src/web-bundle.ts', 'web/package.json', 'web/index.html', 'web/tsconfig.json', 'web/vite.config.ts', 'web/build.ts', 'web/check-assets.ts'];
  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) paths.push(path);
    }
  }
  await visit('web/src');
  await visit('web/public');
  const hash = createHash('sha256');
  let newest = 0;
  for (const path of paths.sort()) {
    const bytes = await readFile(join(root, path));
    hash.update(`${path}\0${bytes.length}\0`).update(bytes);
    newest = Math.max(newest, (await stat(join(root, path))).mtimeMs);
  }
  return { digest: hash.digest('hex'), newest };
}

export async function webBundleState(root: string): Promise<{ state: 'current' | 'missing' | 'stale'; detail: string }> {
  let stamp: WebBuildStamp;
  try { stamp = JSON.parse(await readFile(join(root, 'web/dist/build-stamp.json'), 'utf8')) as WebBuildStamp; }
  catch { return { state: 'missing', detail: 'web/dist build stamp missing or invalid' }; }
  if (stamp?.version !== 1 || !Number.isFinite(stamp.builtAt) || !Number.isFinite(new Date(stamp.builtAt).getTime()) || typeof stamp.sources !== 'string') return { state: 'stale', detail: 'web/dist build stamp invalid' };
  try {
    await stat(join(root, 'web/dist/index.html'));
    const sources = await webSources(root);
    if (sources.digest !== stamp.sources || sources.newest > stamp.builtAt) return { state: 'stale', detail: 'web/dist stale: sources changed or are newer than its build stamp' };
  } catch { return { state: 'stale', detail: 'web/dist stale: bundle or source inputs missing' }; }
  return { state: 'current', detail: `web/dist matches sources (built ${new Date(stamp.builtAt).toISOString()})` };
}
