import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Artifact } from '../../../shared/wire/index.ts';
import type { ConnectionState } from '../connection.ts';
import type { AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { ArtifactViewer } from './ArtifactViewer.tsx';
import { Fold } from '../Fold.tsx';
import s from './Artifacts.module.css';

const roles = [['coordinator', 'Coordinator'], ['implementer', 'Implementers'], ['reviewer', 'Reviewers'], ['qa', 'QA'], ['other', 'Other']] as const;
const human = (a: Artifact) => a.creatorKind === 'human' || a.creatorRole === 'aide' || (a.creatorKind === undefined && a.creator === 'human');
const archived = (a: Artifact) => a.layer === 'archive' || (a.layer === undefined && a.status === 'archived') || a.fileDeleted;

function ArtifactsArea({ connection, selected, select, controls, open: openArtifact }: AreaContentProps) {
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const pending = useRef(new Set<string>());
  const root = useRef<HTMLElement>(null);
  const all = [...connection.artifacts ?? []].sort((a, b) => Number(!!b.folder) - Number(!!a.folder) || (a.title < b.title ? -1 : a.title > b.title ? 1 : a.id.localeCompare(b.id)));
  const agents = all.filter(a => !human(a) && !archived(a));
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'artifact-archive-toggle') { root.current?.querySelector<HTMLButtonElement>('[data-artifact-section="archived"] [data-fold-toggle]')?.click(); return true; }
    if (action === 'artifact-next' || action === 'artifact-previous') {
      const nodes = [...root.current?.querySelectorAll<HTMLButtonElement>('[data-fold-toggle], [data-artifact-row]') ?? []].filter(node => node.offsetParent !== null);
      let index = nodes.findIndex(node => node === document.activeElement);
      if (index < 0) index = nodes.findIndex(node => node.dataset.objectId === selected);
      const target = nodes[index < 0 ? (action === 'artifact-next' ? 0 : nodes.length - 1) : Math.max(0, Math.min(nodes.length - 1, index + (action === 'artifact-next' ? 1 : -1)))];
      target?.focus(); target?.scrollIntoView({ block: 'nearest' }); return true;
    }
    if (action === 'artifact-open') {
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && root.current?.contains(focused) && !focused.hasAttribute('data-artifact-row')) focused.click();
      else {
        const a = all.find(a => a.id === selected);
        if (a?.folder && !a.fileDeleted) setOpened(previous => ({ ...previous, [a.id]: !previous[a.id] }));
        else openArtifact?.();
      }
      return true;
    }
    if (action === 'artifact-keep' || action === 'artifact-archive') {
      if (document.activeElement?.hasAttribute('data-fold-toggle')) return true;
      const owner = document.activeElement?.closest<HTMLElement>('[data-artifact-row]')?.dataset.artifactOwner;
      const a = all.find(a => a.id === (owner ?? selected));
      if (a && connection.live && connection.command && !pending.current.has(a.id)) {
        pending.current.add(a.id); setError('');
        void connection.command(action === 'artifact-keep' ? { type: 'artifact.keep', artifact: a.id, kept: !a.kept } : { type: 'artifact.archive', artifact: a.id }).catch((error: unknown) => setError(String(error))).finally(() => pending.current.delete(a.id));
      }
      return true;
    }
    return false;
  } }));
  const rows = (artifacts: Artifact[]) => artifacts.map(a => <ArtifactBranch key={a.id} artifact={a} connection={connection}
    selected={selected} select={select} open={!!opened[a.id]} />);
  const group = (id: string, label: string, artifacts: Artifact[], closed = false) => <section key={id} aria-label={label} data-artifact-section={id}>
    <Fold area="artifacts" id={id} label={label} count={artifacts.length} defaultFolded={closed}>{rows(artifacts)}</Fold>
  </section>;
  return <section ref={root} data-area-module="Artifacts" data-area-surface="pane" data-key-context="artifacts">
    <div role="list" aria-label="Artifacts objects">
      {error && <p role="alert">{error}</p>}
      {group('mine', 'Mine', all.filter(a => human(a) && !archived(a)))}
      {group('kept', 'Kept', all.filter(a => a.kept && !archived(a)))}
      <section aria-label="By role"><Fold area="artifacts" id="roles" label="By role" count={agents.length} defaultFolded>
        {roles.map(([role, label]) => group(`role:${role}`, label, agents.filter(a => (roles.some(([r]) => r === a.creatorRole) ? a.creatorRole : 'other') === role), true))}
      </Fold></section>
      {group('archived', 'Archived', all.filter(archived), true)}
      {connection.artifactsError && <p role="alert">{connection.artifactsError}</p>}
      {connection.artifactsBefore && <button className={s.more} disabled={!connection.live || connection.artifactsLoading}
        onClick={() => { void connection.loadMoreArtifacts?.(); }}>More artifacts</button>}
    </div>
  </section>;
}
/** Folder listings are read only while unfolded, and refreshed after reconnect or metadata changes. */
function ArtifactBranch({ artifact: a, connection, selected, select, open }: {
  artifact: Artifact; connection: ConnectionState; selected: string | undefined; select: (id: string) => void; open: boolean;
}) {
  const [listing, setListing] = useState<{ files?: string[]; error?: string }>({});
  const command = connection.command;
  const live = connection.live;
  useEffect(() => {
    if (!open || !a.folder || a.fileDeleted || !live || !command) return;
    let current = true;
    void command<{ files: string[] }>({ type: 'artifact.list', artifact: a.id }).then(value => {
      if (current) setListing({ files: value.files });
    }).catch((error: unknown) => { if (current) setListing({ error: String(error) }); });
    return () => { current = false; };
  }, [a, open, live, command]);
  return <div>
    <button className={s.row} data-artifact-row data-artifact-owner={a.id} data-object-id={a.id}
      aria-expanded={a.folder ? open : undefined} aria-pressed={selected === a.id} onFocus={() => select(a.id)} onClick={() => select(a.id)}>
      <span className={s.meta}>{a.folder ? (open ? '▾' : '▸') : '▣'} {a.kind}</span><span className={s.id}>{a.id}</span><span className={s.title}>{a.title}</span>
      <span className={s.meta}>{a.creator}</span><span className={s.meta}>{a.fileDeleted ? 'file deleted' : a.promoted ? `promoted: ${a.promoted} · ${a.status}` : a.status}{a.kept ? ' · kept' : ''}</span>
    </button>
    {open && !a.fileDeleted && <div className={s.files}>
      {listing.error && <p role="alert">{listing.error}</p>}
      {listing.files?.map(file => <button key={file} className={s.row} data-artifact-row data-artifact-owner={a.id} data-artifact-file={file}
        data-object-id={`${a.id}/${file}`} aria-pressed={selected === `${a.id}/${file}`} onFocus={() => select(`${a.id}/${file}`)} onClick={() => select(`${a.id}/${file}`)}>{file}</button>)}
    </div>}
  </div>;
}
function ArtifactPage(props: AreaContentProps) {
  return <section className={s.surface} data-area-module="Artifacts" data-area-surface="page" data-key-context="artifacts"><ArtifactViewer key={props.selected} {...props} /></section>;
}
function ArtifactDrawer(props: AreaContentProps) {
  return <section className={s.surface} data-area-module="Artifacts" data-area-surface="drawer" data-key-context="artifacts"><ArtifactViewer key={props.selected} {...props} /></section>;
}
export const artifactsModule: AreaModule = { context: 'artifacts', handledActions: ['artifact-next', 'artifact-previous', 'artifact-open', 'artifact-keep', 'artifact-archive', 'artifact-archive-toggle'], Pane: ArtifactsArea, Page: ArtifactPage, Drawer: ArtifactDrawer };
