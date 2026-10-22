import type { ExplorerSummary } from '../../shared/wire/index.ts';

const numberOf = (id: string) => Number(id.split('-').at(-1)) || 0;
const rank = (item: ExplorerSummary) => item.rank ?? numberOf(item.id) * 10;
const byRank = (a: ExplorerSummary, b: ExplorerSummary) => rank(a) - rank(b) || numberOf(a.id) - numberOf(b.id);
// Keep SemVer precedence in step with nvim/lua/cland/items.lua's version_less.
const numericLess = (a: string, b: string) => a.length !== b.length ? a.length < b.length : a < b;
function versionLess(a: ExplorerSummary, b: ExplorerSummary): boolean {
  if (!a.version) return false;
  if (!b.version) return true;
  const [, ac, ap] = a.version.split('+')[0]!.match(/^(\d+\.\d+\.\d+)-?(.*)$/)!;
  const [, bc, bp] = b.version.split('+')[0]!.match(/^(\d+\.\d+\.\d+)-?(.*)$/)!;
  const aa = ac!.split('.'), bb = bc!.split('.');
  for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return numericLess(aa[i]!, bb[i]!);
  if (ap === bp || ap === '') return false;
  if (bp === '') return true;
  const ar = ap!.split('.'), br = bp!.split('.');
  for (let i = 0; i < Math.min(ar.length, br.length); i++) {
    if (ar[i] !== br[i]) {
      const an = /^\d+$/.test(ar[i]!), bn = /^\d+$/.test(br[i]!);
      if (an && bn) return numericLess(ar[i]!, br[i]!);
      if (an || bn) return an;
      return ar[i]! < br[i]!;
    }
  }
  return ar.length < br.length;
}
export const compareReleases = (a: ExplorerSummary, b: ExplorerSummary) =>
  versionLess(a, b) ? -1 : versionLess(b, a) ? 1 : byRank(a, b);

export function currentRelease(items: ExplorerSummary[], top = 'release', selected?: string): ExplorerSummary | undefined {
  const releases = items.filter(item => item.kind === top && item.state !== 'closed' && item.status !== 'done');
  return releases.find(item => item.id === selected) ?? releases.sort(compareReleases)[0];
}

