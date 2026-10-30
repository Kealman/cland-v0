/** File uncertainty selects that importer; unavailable scan machinery selects the phase. */
export class ImportGraphError extends Error {
  readonly scope: 'file' | 'scan';
  constructor(reason: string, scope: 'file' | 'scan' = 'file') {
    super(`incomplete import graph: ${reason}`); this.scope = scope;
  }
}
