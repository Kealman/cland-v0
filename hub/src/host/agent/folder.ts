import { lstat, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
export async function folderFiles(root: string, resumed: <T>(body: () => T) => T = body => body(), failure: (message: string) => Error = message => new Error(message)): Promise<string[]> {
  const result: string[] = [];
  const walk = async (path: string): Promise<void> => {
    const info = await lstat(path);
    const names = await resumed(() => {
      if (info.isSymbolicLink()) throw failure('artifact folders cannot contain symbolic links');
      if (info.isFile()) { result.push(relative(root, path).split(sep).join('/')); return null; }
      if (!info.isDirectory()) throw failure('artifact folders contain only regular files and directories');
      return readdir(path);
    });
    const children = resumed(() => names ? names.sort().map(name => join(path, name)) : []);
    for (const child of children) await resumed(() => walk(child));
  };
  await walk(root);
  return resumed(() => result.sort());
}
