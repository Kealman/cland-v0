/** One versioned key for each area's browser-only preferences. Storage is optional. */
export function readInterfaceState(area: string): unknown {
  try { return JSON.parse(localStorage.getItem(`cland.ui.${area}.v1`) ?? 'null') as unknown; }
  catch { return null; }
}
export function writeInterfaceState(area: string, value: unknown): void {
  try { localStorage.setItem(`cland.ui.${area}.v1`, JSON.stringify(value)); }
  catch { /* Private browsing and denied storage must not block the shell. */ }
}
