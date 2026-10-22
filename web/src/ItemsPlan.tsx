import { useEffect, useImperativeHandle, useState, useRef, useSyncExternalStore, type ComponentProps } from 'react';
import { ItemsTree } from './ItemsTree.tsx';
import { ItemText } from './ItemText.tsx';
import { findItem, type ConnectionState } from './connection.ts';
import { done } from './items-tree.ts';
import { itemsSnapshot, subscribeItems } from './items-state.ts';
import type { EpicPlan, ItemSummary, StageSummary } from '../../shared/wire/index.ts';
import { isDesktop, useDesktop } from './desktop.ts';
import s from './ItemsPlan.module.css';

type History = { id: string; ts: string; event: 'changed' | 'approved'; by: string; previous?: EpicPlan | null; plan?: EpicPlan | null; reason?: string };
type PlanStage = StageSummary & { verdict?: { run: string; result: string }; items: string[] };
type PlanDetail = { id: string; plan: EpicPlan | null; approval?: ItemSummary['approval']; stages: PlanStage[]; history: History[]; planError?: string };
export function ItemsPlan(props: ComponentProps<typeof ItemsTree>) {
  const preferences = useSyncExternalStore(subscribeItems, itemsSnapshot);
  const owner = planOwner(props.connection, props.selected ?? preferences.scope);
  return <Plan key={owner?.id ?? 'empty'} {...props} owner={owner} />;
}
function Plan({ connection, controls, owner }: ComponentProps<typeof ItemsTree> & { owner: ReturnType<typeof planOwner> }) {
  const desktop = useDesktop();
  const { command, live, loadItems } = connection;
  const id = owner?.id, updated = owner?.updated, stages = owner?.stages;
  const visit = useRef<{ id: string; seen: string | undefined; acknowledged: boolean } | undefined>(undefined);
  const marksReady = connection.marks !== undefined;
  useEffect(() => {
    if (id && marksReady && visit.current?.id !== id) visit.current = { id, seen: connection.marks?.plans[`T-${id.split('-').at(-1)}`], acknowledged: false };
  }, [id, marksReady, connection.marks]);
  const [detail, setDetail] = useState<PlanDetail>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(true);
  const [discussing, setDiscussing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sourceOpen, setSourceOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const topicCreated = useRef<{ id: string; topic: string } | undefined>(undefined);
  useEffect(() => { if (discussing) input.current?.focus(); }, [discussing]);
  useEffect(() => { if (sourceOpen && id) connection.loadBody?.(id); }, [sourceOpen, id, connection]);
  useEffect(() => {
    let current = true;
    setRefreshing(true);
    if (id && marksReady && live && command) {
      void command<PlanDetail>({ type: 'task.plan', item: id, op: 'show' }).then(value => {
        if (current) { setDetail(value); setError(''); setRefreshing(false); }
      }).catch(error => { if (current) setError(String(error)); });
    }
    return () => { current = false; };
  }, [id, updated, stages, marksReady, live, command]);
  const value = detail?.id === id ? detail : undefined;
  useEffect(() => {
    let current = true;
    if (live && value?.plan && loadItems) {
      void loadItems(value.plan.stages.flatMap(stage => stage.lanes.flat())).catch(error => { if (current) setError(String(error)); });
    }
    return () => { current = false; };
  }, [value, live, loadItems]);
  useEffect(() => {
    const entry = visit.current;
    const latest = value?.history.at(-1)?.id;
    if (!entry || entry.id !== id || entry.acknowledged || !latest || !command) return;
    entry.acknowledged = true;
    void command({ type: 'marks.set', plans: { [entry.id]: latest } }).catch(error => setError(String(error)));
  }, [value, id, command]);
  const changes = planChanges(value?.history ?? [], visit.current && visit.current.id === id ? visit.current.seen : undefined);
  const approve = async () => {
    if (!isDesktop() || !id || !live || !command || busy || refreshing || value?.approval?.state !== 'pending') return;
    setBusy(true); setError('');
    try {
      await command({ type: 'task.plan', item: id, op: 'approve' });
      setDetail(await command<PlanDetail>({ type: 'task.plan', item: id, op: 'show' }));
    } catch (error) { setError(String(error)); }
    finally { setBusy(false); }
  };
  const discuss = () => { setDiscussing(true); input.current?.focus(); };
  const send = async () => {
    if (!id || !draft.trim() || busy || !live || !command) return;
    setBusy(true); setError('');
    try {
      let topic = connection.topics?.find(topic => topic.item === id)?.id ?? (topicCreated.current?.id === id ? topicCreated.current.topic : undefined);
      if (!topic) {
        const result = await command<{ topic: { id: string } }>({ type: 'topic.create', item: id, title: `${id} · plan` });
        topic = result.topic.id; topicCreated.current = { id, topic };
      }
      await command({ type: 'topic.send', topic, to: [`lead ${id}`], text: draft.trim() });
      setDraft(''); setDiscussing(false);
    } catch (error) { setError(String(error)); }
    finally { setBusy(false); }
  };
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'plan-approve') { void approve(); return true; }
    if (action === 'plan-discuss' && id) { discuss(); return true; }
    return false;
  } }));
  const plan = value?.plan;
  const planIds = new Set(plan?.stages.flatMap(stage => stage.lanes.flat()) ?? []);
  const under = (itemId: string) => {
    const seen = new Set<string>();
    let item = findItem(connection, itemId);
    while (item && !seen.has(item.id)) { if (item.id === id) return true; seen.add(item.id); item = findItem(connection, item.parent ?? undefined); }
    return false;
  };
  const external = [...new Set([...planIds].flatMap(item => findItem(connection, item)?.open_blockers ?? []).filter(item => !under(item)))];
  const sessions = connection.sessions?.filter(session => session.item && under(session.item) || session.holds.some(hold => under(hold.item))) ?? [];
  const staffing = connection.crew?.crew.implementer?.policy;
  const current = value?.stages.findIndex(stage => stage.state !== 'closed') ?? -1;
  const statusCounts = value?.stages.reduce<Record<string, number>>((counts, stage) => {
    for (const [status, count] of Object.entries(stage.statuses)) counts[status] = (counts[status] ?? 0) + count;
    return counts;
  }, {}) ?? {};
  const started = ['done', 'in progress', 'review', 'qa', 'ready'].some(status => (statusCounts[status] ?? 0) > 0);
  const cost = sessions.reduce((total, session) => total + (session.usage?.total?.cost ?? 0), 0);
  const authored = value?.history.findLast(record => record.plan);
  const ancestry: string[] = [];
  let parent = owner;
  const ancestors = new Set<string>();
  while (parent && !ancestors.has(parent.id)) { ancestors.add(parent.id); ancestry.unshift(`${parent.id} ${parent.title}`); parent = findItem(connection, parent.parent ?? undefined); }
  const approval = value?.approval?.state === 'approved' ? `Approved by ${value.approval.by ?? 'human'} · ${value.approval.at ?? ''}`
    : value?.approval?.state === 'pending' ? 'Awaiting your approval' : value?.approval?.state === 'not required' ? 'Approval not required' : 'Approval state unavailable';
  return <section className={s.plan} aria-label="Epic plan" tabIndex={0}>
    <h2>{owner ? `Plan of ${owner.id} ${owner.title}` : 'Select an epic or an item in an epic'}</h2>
    {owner && <>
      <p className={s.fact}><ItemText text={ancestry.join(' › ')} /></p>
      <p className={s.fact}>Lead: {owner.claim?.session ?? 'No Lead claimed'} · Updated: {updated ?? '—'}</p>
    </>}
    {authored && <p className={s.fact}>Plan by {authored.by} · {authored.ts}</p>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    {id && !value && <p>Loading plan…</p>}
    {value?.planError && <p className={s.error}>Previous accepted plan kept: {value.planError}</p>}
    {value && !plan && <p>No plan yet</p>}
    {plan && value && <div className={s.columns}>
      <div>
        {!!changes.notes.length && <div className={s.changed} aria-label="Plan changes">{changes.notes.map(record => <p key={record.id}>△ {record.ts} · {record.by} · {record.reason ?? 'Reason not supplied'} · <ItemText text={record.summary} /></p>)}</div>}
        <div className={s.approval}>
          <p>{approval}</p>
          <div className={s.actions}>
            {desktop && value.approval?.state === 'pending' && <button disabled={!live || busy || refreshing} onClick={() => void approve()}>a · Approve</button>}
            <button disabled={!live || busy} onClick={discuss}>d · Discuss with Lead</button>
          </div>
        </div>
        {discussing && <form className={s.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
          <label>Lead {id}<input ref={input} aria-label="Plan discussion" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} /></label>
          <button disabled={!live || busy || !draft.trim()}>Send</button>
        </form>}
        {plan.stages.map((stage, index) => {
          const metadata = value.stages[index];
          const state = metadata?.state === 'closed' ? 'closed' : started && index === current ? 'in work' : 'planned';
          return <div key={index}>
            {index > 0 && <p className={s.fact}>↓ S{index + 1} starts when S{index} closes</p>}
            <section className={s.stage} data-changed={changes.stages.has(index)} data-state={state}>
              <h3 className={changes.stages.has(index) ? s.changed : undefined}>{changes.stages.has(index) ? '△ ' : ''}S{index + 1} · {stage.name}</h3>
              <p className={s.fact}>{state} · {stage.lanes.length} lanes · {metadata ? `${metadata.merged}/${metadata.total} merged` : 'Progress unavailable'}</p>
              <p>QA: {policy(stage.qa)}</p>
              {metadata?.verdict && <p className={metadata.verdict.result === 'clear' ? s.clear : s.error}>QA run {metadata.verdict.run} · {metadata.verdict.result}</p>}
              <div className={s.lanes}>{stage.lanes.map((lane, i) => <section key={i} className={s.lane}>
                <h4>Lane {i + 1}</h4>
                <ol>{lane.map(itemId => {
                  const item = findItem(connection, itemId), override = plan.items?.[itemId];
                  const verdict = item?.verdicts.at(-1);
                  return <li key={itemId} className={changes.items.has(itemId) ? s.changed : undefined}>
                    <p>{changes.items.has(itemId) ? '△ ' : ''}{item && done(item) ? '✓' : item?.glyph ?? '○'} <ItemText text={`${itemId} ${item?.title ?? '(not in the index)'}`} /></p>
                    <p className={s.fact}>{item?.derived_status ?? item?.status ?? item?.state ?? '—'} · {item ? `${item.criteria.verified}/${item.criteria.total}` : '—'}</p>
                    {item?.claim && <p className={s.fact}>{item.claim.session} · {connection.sessions?.find(session => session.name === item.claim?.session)?.state ?? 'unknown'}</p>}
                    {!!item?.holds.length && <p className={s.fact}>{item.holds.map(hold => `${hold.session} · ${hold.role}`).join('; ')}</p>}
                    {verdict && <p className={verdict.result === 'not clear' ? s.error : s.fact}>{verdict.verdict} · {verdict.result} · round {verdict.round} · {verdict.run}</p>}
                    {!!item?.open_blockers.length && <p className={s.fact}>Blocked by <ItemText text={item.open_blockers.join(', ')} /></p>}
                    {override?.qa && <p className={s.fact}>Override: QA {policy(override.qa)}</p>}
                    {override?.qa_criteria && <p className={s.fact}>QA criteria: {override.qa_criteria.join(', ')}</p>}
                  </li>;
                })}</ol>
              </section>)}</div>
              <p className={s.fact}>Gate: <ItemText text={gate(stage, plan)} /></p>
            </section>
          </div>;
        })}
      </div>
      <aside className={s.summary} aria-label="Plan summary">
        <h3>{started ? `Progress · stage ${current < 0 ? plan.stages.length : current + 1} of ${plan.stages.length}` : `Plan · ${value.approval?.state ?? 'unknown'}`}</h3>
        {started ? <>
          <p>{Object.entries(statusCounts).map(([status, count]) => `${count} ${status}`).join(' · ')}</p>
          <p>Current gate: {current < 0 ? 'All stages closed' : gate(plan.stages[current]!, plan)}</p>
        </> : <p title="The Lead starts S1 after approval under the project's crew policy">On approval: S1 · {plan.stages[0]?.lanes.length ?? 0} lanes · {staffing ?? 'unknown'} crew policy</p>}
        <dl>
          <dt>Items · stages</dt><dd>{planIds.size} items · {plan.stages.length} stages</dd>
          <dt>Implementers</dt><dd>{Math.max(0, ...plan.stages.map(stage => stage.lanes.length))} lanes at most</dd>
          <dt>Crew</dt><dd>{staffing ?? 'unknown'}</dd>
          <dt>Review</dt><dd>Every item</dd>
          <dt>QA runs</dt><dd>{qaRuns(plan)} planned</dd>
          {started && <><dt>Stage QA runs</dt><dd>{value.stages.filter(stage => stage.verdict).length} recorded · {value.stages.filter((stage, index) => stage.state !== 'closed' && policies(plan.stages[index]!, plan).after).length} after-stage gates remaining</dd></>}
          <dt>Cost so far</dt><dd>{sessions.some(session => typeof session.usage?.total?.cost === 'number') ? `$${cost.toFixed(2)} reported session totals` : 'Unavailable'}</dd>
        </dl>
        {sessions.map(session => <p key={session.key}>{session.label} · {session.state}</p>)}
        <h3>QA policies</h3>
        {plan.stages.map((stage, index) => <p key={index}>S{index + 1}: {policy(stage.qa)}</p>)}
        <h3>Plan history</h3>
        {value.history.map(record => <p key={record.id}>{record.ts} · {record.event} by {record.by}{record.reason ? ` · ${record.reason}` : ''}</p>)}
        <h3>Outside the epic</h3>
        {external.length ? external.map(item => <p key={item}><ItemText text={`${item} ${findItem(connection, item)?.title ?? '(unknown)'}`} /></p>) : <p>No open external blockers</p>}
        <details onToggle={event => setSourceOpen(event.currentTarget.open)}>
          <summary>Source · ## Plan</summary>
          {connection.bodies?.[id!]?.error ? <p role="alert">{connection.bodies[id!]!.error}</p>
            : <pre>{source(connection.bodies?.[id!]?.text) ?? 'Loading source…'}</pre>}
        </details>
      </aside>
    </div>}
  </section>;

}

function planChanges(history: History[], seen: string | undefined) {
  const stages = new Set<number>(), items = new Set<string>(), notes: (History & { summary: string })[] = [];
  const locations = (plan: EpicPlan) => new Map(plan.stages.flatMap((stage, s) => stage.lanes.flatMap((lane, l) => lane.map((id, p) => [id, { s, l, p }] as const))));
  for (const record of history.slice(history.findIndex(record => record.id === seen) + 1)) {
    if (!record.previous || !record.plan) continue;
    const before = locations(record.previous), after = locations(record.plan), summary: string[] = [];
    for (const id of new Set([...before.keys(), ...after.keys()])) {
      const a = before.get(id), b = after.get(id);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        items.add(id); if (a) stages.add(a.s); if (b) stages.add(b.s);
        summary.push(`${id} ${!b ? `removed from S${a!.s + 1}` : !a ? `added to S${b.s + 1}` : `moved from S${a.s + 1} to S${b.s + 1}`}`);
      }
      if (b && JSON.stringify(record.previous.items?.[id]) !== JSON.stringify(record.plan.items?.[id])) {
        items.add(id); stages.add(b.s); summary.push(`${id} QA override changed`);
      }
    }
    record.plan.stages.forEach((stage, index) => {
      const previous = record.previous!.stages[index];
      if (JSON.stringify(stage) !== JSON.stringify(previous)) stages.add(index);
      if (!previous || stage.name !== previous.name || JSON.stringify(stage.qa) !== JSON.stringify(previous.qa)) stage.lanes.flat().forEach(id => items.add(id));
    });
    notes.push({ ...record, summary: summary.sort().join('; ') || 'Stage or QA policy changed' });
  }
  return { stages, items, notes };
}

function policy(qa: EpicPlan['stages'][number]['qa']) {
  return qa.scope === 'none' ? 'none · review only' : `${qa.scope} · ${qa.when === 'after-stage' ? 'after stage' : 'per item'}`;
}
function policies(stage: EpicPlan['stages'][number], plan: EpicPlan) {
  const perItem: string[] = [];
  let after: string | undefined;
  for (const id of stage.lanes.flat()) {
    const qa = plan.items?.[id]?.qa ?? stage.qa;
    if (qa.scope === 'none') continue;
    if (qa.when === 'per-item') perItem.push(id);
    else if (!after || qa.scope === 'full') after = qa.scope;
  }
  return { perItem, after };
}
function gate(stage: EpicPlan['stages'][number], plan: EpicPlan) {
  const { perItem, after } = policies(stage, plan);
  const parts = perItem.length ? [`Per-item QA before merge: ${perItem.join(', ')}`] : [];
  parts.push(after ? `One ${after} QA run on dev after all items merge closes the stage` : 'Closes when all items merge on review');
  return parts.join('; ');
}
function qaRuns(plan: EpicPlan) {
  return plan.stages.reduce((total, stage) => { const { perItem, after } = policies(stage, plan); return total + perItem.length + (after ? 1 : 0); }, 0);
}
function source(body: string | undefined) {
  if (body === undefined) return undefined;
  const section = body.split(/^## Plan\s*$/m)[1]?.split(/^##?\s/m)[0];
  return section?.match(/^\s*(`{3,}|~{3,})ya?ml\s*\n([\s\S]*?)^\s*\1\s*$/m)?.[2] ?? 'No Plan source';
}

function planOwner(connection: ConnectionState, selected: string | undefined) {
  let owner = findItem(connection, selected);
  const visited = new Set<string>();
  while (owner && owner.kind !== connection.tracker?.levels[1] && !visited.has(owner.id)) {
    visited.add(owner.id); owner = findItem(connection, owner.parent ?? undefined);
  }
  return owner?.kind === connection.tracker?.levels[1] ? owner : undefined;
}
