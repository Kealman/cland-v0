import { AsyncLocalStorage } from 'node:async_hooks';
import { resolve } from 'node:path';
export const territoryLockContext = new AsyncLocalStorage<{ root: string; active: boolean }>();
export function territoryLockHeld(root: string): boolean {
  const owner = territoryLockContext.getStore();
  return !!owner?.active && owner.root === resolve(root);
}
export function assertTerritoryLock(root: string): void {
  if (!territoryLockHeld(root)) throw new Error('branch lease mutation requires the territory lock');
}

export class TerritoryBusy extends Error {}
