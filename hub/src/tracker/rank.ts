// One ordering for indexed lists, disk siblings and rank moves. Legacy files stay untouched.
import { idNumber } from './item.ts';

type Ranked = { id: string; rank?: number | null };
export const effectiveRank = (item: Ranked): number => item.rank ?? idNumber(item.id) * 10;
export const compareRank = (a: Ranked, b: Ranked): number => effectiveRank(a) - effectiveRank(b) || idNumber(a.id) - idNumber(b.id);

/** A sparse move changes one rank. For a dense move, scan each side of the insertion once and
 * open the smaller feasible window. Descending ID pairs need one integer gap; subtracting their
 * running count gives nondecreasing coordinates, so each window's room is checked in constant time.
 * Fill only the chosen window, retaining the moved rank when possible. All work is linear. */
export function rankChanges(siblings: readonly Ranked[], moved: Ranked, slot: number, rankableIds: ReadonlySet<string>): Map<string, number> {
  const before = siblings[slot - 1];
  const after = siblings[slot];
  const floor = before ? BigInt(effectiveRank(before)) + (idNumber(before.id) < idNumber(moved.id) ? 0n : 1n) : BigInt(Number.MIN_SAFE_INTEGER);
  const ceiling = after ? BigInt(effectiveRank(after)) - (idNumber(moved.id) < idNumber(after.id) ? 0n : 1n) : BigInt(Number.MAX_SAFE_INTEGER);
  if (floor <= ceiling) {
    const rank = before ? floor + (ceiling - floor < 9n ? ceiling - floor : 9n)
      : after ? ceiling - (ceiling - floor < 9n ? ceiling - floor : 9n) : 10n;
    return new Map([[moved.id, Number(rank)]]);
  }
  const order = [...siblings.slice(0, slot), moved, ...siblings.slice(slot)];
  const offsets: bigint[] = [0n];
  for (let index = 1; index < order.length; index++) {
    offsets.push(offsets[index - 1]! + (idNumber(order[index - 1]!.id) < idNumber(order[index]!.id) ? 0n : 1n));
  }
  const coordinates = order.map((item, index) => BigInt(effectiveRank(item)) - offsets[index]!);
  const min = BigInt(Number.MIN_SAFE_INTEGER);
  const max = BigInt(Number.MAX_SAFE_INTEGER) - offsets.at(-1)!;
  type Window = { start: number; end: number; lower: bigint; upper: bigint };
  const scan = (direction: -1 | 1): Window | null => {
    let start = slot;
    let end = slot;
    while (direction < 0 ? start > 0 : end < order.length - 1) {
      const added = direction < 0 ? --start : ++end;
      if (!rankableIds.has(order[added]!.id)) return null; // fixed boundary: try the other side
      const lower = start > 0 ? coordinates[start - 1]! : min;
      const upper = end < order.length - 1 ? coordinates[end + 1]! : max;
      if (lower >= min && upper <= max && lower <= upper) return { start, end, lower, upper };
    }
    return null;
  };
  const fill = ({ start, end, lower, upper }: Window): Map<string, number> => {
    const count = BigInt(end - start + 1);
    const original = coordinates[slot]!;
    const keepMoved = original >= lower && original <= upper;
    const space = keepMoved ? start === slot ? upper - original : original - lower : upper - lower;
    const availableStep = space / (count + 1n);
    const step = availableStep < 10n ? availableStep : 10n;
    const first = keepMoved ? start === slot ? original : original - step * BigInt(slot - start)
      : start === 0 ? upper - step * count : lower + step;
    const changes = new Map<string, number>();
    for (let index = start; index <= end; index++) {
      const rank = Number(first + step * BigInt(index - start) + offsets[index]!);
      if (rank !== effectiveRank(order[index]!)) changes.set(order[index]!.id, rank);
    }
    return changes;
  };
  const left = scan(-1);
  const right = scan(1);
  const a = left ? fill(left) : null;
  const b = right ? fill(right) : null;
  if (a && b) return a.size < b.size ? a : b;
  if (a || b) return (a ?? b)!;
  // No bounded gap: the rare fallback spaces the entire list. Never rewrite a fixed item.
  if (order.some(item => !rankableIds.has(item.id))) throw new Error('cannot make room for a safe integer rank without renumbering an unrankable sibling');
  return new Map(order.flatMap((item, index) => effectiveRank(item) === (index + 1) * 10 ? [] : [[item.id, (index + 1) * 10]]));
}
