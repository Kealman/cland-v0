// Batched immutable source reads shared by admission policies.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type Source = (file: string) => Promise<string>;

/** Read the manifest's blobs in one process, preserving byte boundaries and Git errors. */
export async function treeSources(cwd: string, tree: string, files: string[], env?: NodeJS.ProcessEnv): Promise<Source> {
  const wanted = new Set(files);
  const listing = (await promisify(execFile)('git', ['ls-tree', '-r', '-z', '--full-tree', tree], { cwd, env, timeout: 30_000, maxBuffer: 16 * 1024 * 1024 })).stdout;
  const entries = listing.split('\0').filter(Boolean).flatMap(record => {
    const tab = record.indexOf('\t');
    const [, kind, oid] = record.slice(0, tab).split(' ');
    const file = record.slice(tab + 1);
    return kind === 'blob' && wanted.has(file) ? [{ file, oid: oid! }] : [];
  });
  const sources = new Map<string, string>();
  if (entries.length) {
    const output = await new Promise<Buffer>((resolve, reject) => {
      const child = execFile('git', ['cat-file', '--batch'], { cwd, env, encoding: 'buffer', timeout: 30_000, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout));
      child.stdin!.on('error', reject);
      child.stdin!.end(entries.map(entry => entry.oid).join('\n') + '\n');
    });
    let offset = 0;
    for (const entry of entries) {
      const end = output.indexOf(10, offset);
      const [oid, kind, sizeText] = output.subarray(offset, end).toString('ascii').split(' ');
      const size = Number(sizeText);
      if (end < offset || oid !== entry.oid || kind !== 'blob' || !Number.isSafeInteger(size) || size < 0 || end + 1 + size >= output.length || output[end + 1 + size] !== 10) throw new Error(`invalid Git blob response: ${entry.file}`);
      sources.set(entry.file, output.subarray(end + 1, end + 1 + size).toString('utf8'));
      offset = end + 1 + size + 1;
    }
    if (offset !== output.length) throw new Error('unexpected trailing Git blob response');
  }
  return async file => {
    const source = sources.get(file);
    if (source === undefined) throw Object.assign(new Error(`missing Git source: ${file}`), { code: 'ENOENT' });
    return source;
  };
}
