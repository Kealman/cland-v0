import type { HumanMarks, ClientRequest } from '../protocol.ts';
import { idNumber } from '../tracker/item.ts';

/** Plan IDs are opaque receipts. Only the hub's publication order can compare them. */
export function mergeHumanMarks(before: HumanMarks, frame: Extract<ClientRequest, { type: 'marks.set' }>, history: (id: string) => readonly { id: string }[]): HumanMarks {
  if (frame.import && before.imported) return before;
  const marks = structuredClone(before);
  if (frame.events !== undefined) {
    const time = Date.parse(frame.events);
    if (!Number.isFinite(time)) throw new Error('invalid events last look');
    if (marks.events === null || time > Date.parse(marks.events)) marks.events = new Date(time).toISOString();
  }
  for (const [id, receipt] of Object.entries(frame.plans ?? {})) {
    if (!/^[A-Za-z]+-[1-9]\d*$/.test(id) || !Number.isSafeInteger(idNumber(id))) throw new Error(`invalid plan item ${id}`);
    const key = `T-${idNumber(id)}`;
    const rows = history(id);
    const next = rows.findIndex(row => row.id === receipt);
    const previous = rows.findIndex(row => row.id === marks.plans[key]);
    // An import can preserve an old receipt whose journal row has been retained away.
    if (next < 0 && !frame.import) throw new Error(`unknown plan receipt ${receipt}`);
    if (next > previous || !Object.hasOwn(marks.plans, key)) marks.plans[key] = receipt;
  }
  if (frame.import) marks.imported = true;
  return marks;
}
