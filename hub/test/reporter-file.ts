import { realpathSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const paths = new Map<string, string>();
function canonical(path: string): string {
  let value = paths.get(path);
  if (value === undefined) {
    try { value = realpathSync(path); } catch { value = path; }
    paths.set(path, value);
  }
  return value;
}

export function reporterFile(file: string, cwd: string): string {
  return relative(canonical(cwd), canonical(file)).replaceAll('\\', '/');
}

/** Node emits a completion for the outer file as well as its test bodies.
 * The invocation path can be an alias of the worker's canonical source path. */
export function fileEnvelope(data: { file?: string | undefined; name: string; line?: number | undefined }, cwd: string): boolean {
  if (!data.file || data.line !== 1) return false;
  if (data.name === data.file || data.name === relative(cwd, data.file)) return true;
  return canonical(resolve(cwd, data.name)) === canonical(data.file);
}
