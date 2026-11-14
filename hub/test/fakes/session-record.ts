type RecordFiles = { temporary: (path: string) => string; write: (path: string, value: string) => void; rename: (from: string, to: string) => void };
/** Pure publication plan with injected I/O; native executable bindings live in their fake. */
export function writeSessionRecord(path: string, value: unknown, files: RecordFiles): void {
  const temporary = files.temporary(path);
  files.write(temporary, JSON.stringify(value));
  files.rename(temporary, path);
}
export const isSessionRecord = (name: string): boolean => name.endsWith('.json');
