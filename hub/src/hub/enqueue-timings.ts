import { enqueueTimingPolicy } from '../enqueue-timing-policy.ts';
import { DURATION_MANIFEST, parseDurationManifest, durationLegacyOwner } from '../suite-durations.ts';
import { sourceTestIdentities } from '../suite-test-identities.ts';
import { MergeError } from '../merge.ts';
import type { TimingReceipt } from '../suite-timing-receipts.ts';

export type TimingLookup = {
  receipt(head: string, tree: string): { id: string; receipts: TimingReceipt[] } | null;
  id(head: string, tree: string): string | null;
};

/** Immutable reads occur outside territory serialization. Final validation is indexed. */
export async function checkEnqueueTimings(head: string, base: string, services: {
  git(args: string[]): Promise<string>; identity(head: string): Promise<string>;
  timings: TimingLookup; owner(fallback: string): Promise<string | undefined>; now: number;
}): Promise<() => void> {
  const exists = async (ref: string, file: string) => (await services.git(['ls-tree', '-r', '--name-only', '-z', ref, '--', file])).split('\0').includes(file);
  if (!await exists(head, DURATION_MANIFEST)) return () => {};
  const manifest = parseDurationManifest(await services.git(['show', `${head}:${DURATION_MANIFEST}`]));
  const tree = await services.identity(head);
  const proof = services.timings.receipt(head, tree);
  const missing = () => new MergeError('merge-budget', `missing exact-head Linux timing receipt for ${head} (tree ${tree}); run Linux verification after the timing-capable hub has restarted`);
  if (!proof) throw missing();
  const baseManifest = await exists(base, DURATION_MANIFEST)
    ? parseDurationManifest(await services.git(['show', `${base}:${DURATION_MANIFEST}`])) : null;
  const known: string[] = [];
  const sources = new Map<string, Awaited<ReturnType<typeof sourceTestIdentities>> | null>();
  for (const row of proof.receipts) for (const sample of row.samples) {
    if (sample.outcome !== 'pass' || sample.seconds < 4) continue;
    if (!sources.has(sample.file)) sources.set(sample.file, await exists(base, sample.file)
      ? await sourceTestIdentities(sample.file, await services.git(['show', `${base}:${sample.file}`]), true) : null);
    const source = sources.get(sample.file);
    const key = `${sample.file}::${sample.name}`;
    if (source?.patterns.some(pattern => new RegExp(pattern, 's').test(sample.name)) ||
      (source?.dynamic && baseManifest && (Object.hasOwn(baseManifest.tests, key) || Object.hasOwn(baseManifest.allow, key)))) known.push(key);
    else if (source?.dynamic) throw new MergeError('merge-budget', `new timing identity unknown in base source: ${sample.file}::${sample.name}`);
  }
  const owner = await services.owner(durationLegacyOwner(manifest));
  const result = enqueueTimingPolicy({ run: proof.id, head, tree, receipts: proof.receipts, known, allow: manifest.allow, owner: owner ?? 'OWNER_REQUIRED', now: services.now });
  if (result.kind === 'missing') throw missing();
  if (result.kind === 'allowance') throw new MergeError('merge-budget', `new Linux identities of 4 s or more require allowances in ${DURATION_MANIFEST}:\n${JSON.stringify({ allow: result.stanzas }, null, 2)}`);
  return () => { if (services.timings.id(head, tree) !== proof.id) throw new MergeError('merge-changed', 'Linux timing receipt changed during enqueue; try again'); };
}
