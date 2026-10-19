import type { HubCore } from './core.ts';
import { GENERAL } from './core.ts';
import type { Tracker } from '../tracker/tracker.ts';
import type { SearchReport } from './dev-t3-search.ts';

/** Tracker writes are serialized by Tracker. Deterministic labels also recover the
 * file-write / hub-checkpoint crash window without filing another Bug. */
export async function reportDevT3Search(core: HubCore, tracker: Tracker, report: SearchReport): Promise<void> {
  const actor = { id: 'hub', name: 'hub', role: null };
  const bugs: Array<{ item: string; merge: string }> = [];
  const claimants = new Set<string>();
  const { input, files } = report;
  const evidence = [`Periodic run ${input.run}; red head ${input.head}; tree ${input.tree ?? 'unavailable'}`,
    `Last green run ${input.previousGreenRun ?? 'unavailable'}; head ${input.previousGreenHead ?? 'unavailable'}`,
    `Original log ${input.artifact}: ${input.path}`,
    ...files.map(file => `${file.file}: ${file.result}${file.culprit ? ` at ${file.culprit.head} ${file.culprit.subject}` : ''}${file.reason ? ` (${file.reason})` : ''}\n${file.receipts.map(r => `Run ${r.run}; head ${r.head}; ${r.result}; log ${r.artifact}: ${r.path}`).join('\n')}`)].join('\n');
  for (const merge of new Set(files.flatMap(file => file.culprit?.head ?? []))) {
    const label = `dev-t3-${merge}`;
    let bug = tracker.list().find(item => item.labels.includes(label));
    const source = tracker.list().find(item => tracker.mergeReceipt(item.id)?.commit === merge);
    if (source) {
      const claim = tracker.lastClaim(source.id);
      const live = claim && core.presence().find(session => tracker.sameSession(session.sessionId, claim.sessionId));
      if (live) claimants.add(live.name);
    }
    if (!bug) {
      const categoryKind = tracker.ladder.roots.find(kind => kind !== tracker.ladder.top);
      if (!categoryKind) throw new Error('periodic regression filing needs a configured root category kind');
      const category = tracker.list().find(item => item.kind === categoryKind && item.title === 'Bugs' && item.state === 'open')
        ?? await tracker.create(actor, { kind: categoryKind, title: 'Bugs' });
      const names = files.filter(file => file.culprit?.head === merge).map(file => file.file);
      const created = await tracker.create(actor, { title: `Periodic dev T3 regression at ${merge}`, size: 'M', parent: category.id, labels: [label, 'needs-triage'],
        ...(source ? { regression_of: source.id, found_by: 'droplet' as const } : {}),
        body: `## Summary\n\nLanded merge ${merge} first fails ${names.join(', ')} between the pinned green and red periodic heads.\n\n## Evidence\n\n${evidence}` });
      bug = tracker.list().find(item => item.id === created.id)!;
    }
    const prior = tracker.view(bug.id);
    if (!prior.body.includes(`Periodic run ${input.run};`) && !prior.comments.some(comment => comment.text.includes(`Periodic run ${input.run};`))) {
      await tracker.comment(actor, bug.id, evidence);
    }
    bugs.push({ item: bug.id, merge });
  }
  const text = `Periodic dev T3 search ${input.run}${files.length ? '' : ': inconclusive; no failing files identified'}\n${bugs.map(bug => `Bug ${bug.item}: merge ${bug.merge}`).join('\n')}\n${evidence}`;
  core.noticeTo(GENERAL.id, { id: `dev-t3-search:${input.run}`, kind: 'report', to: ['coordinator', ...claimants], text: core.boundedText(text),
    detail: { event: 'verification-dev-t3-search', ...report, bugs } });
}
