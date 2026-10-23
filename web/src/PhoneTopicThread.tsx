import { useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { ConnectionState } from './connection.ts';
import { findItem } from './connection.ts';
import { ReadOnlyItemCard } from './ItemCard.tsx';
import { ItemNavigation } from './ItemText.tsx';
import { Thread, type ThreadControls } from './Thread.tsx';
import s from './PhoneTopicThread.module.css';
import type { Artifact } from '../../shared/wire/index.ts';
import { ArtifactNavigation, ArtifactViewerFallback } from './artifacts/ArtifactNavigation.ts';
import { ArtifactViewer } from './artifacts/ArtifactViewer.tsx';

type TopicView = { topic: string } & ({ item: string; artifact?: never } | { artifact: Artifact; item?: never });

/** Keep the shared thread mounted behind detail pages, including its reading anchor. */
export function PhoneTopicThread({ connection, topic, targetMessage, controls, back }: {
  connection: ConnectionState; topic: string; targetMessage?: string | undefined; controls?: Ref<ThreadControls> | undefined; back?: (() => void) | undefined;
}) {
  const thread = useRef<ThreadControls>(null);
  const detailBack = useRef<HTMLButtonElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const [view, setView] = useState<TopicView | undefined>(() => history.state?.clandTopicView?.topic === topic ? history.state.clandTopicView : undefined);
  useLayoutEffect(() => {
    if (view) detailBack.current?.focus({ preventScroll: true });
    else origin.current?.focus({ preventScroll: true });
  }, [view]);
  useEffect(() => {
    const popped = (event: PopStateEvent) => setView(event.state?.clandTopicView?.topic === topic ? event.state.clandTopicView : undefined);
    window.addEventListener('popstate', popped);
    return () => window.removeEventListener('popstate', popped);
  }, [topic]);
  useImperativeHandle(controls, () => ({ focus: () => thread.current?.focus(), run: action => {
    if (action === 'thread-back') { if (view) history.back(); else back?.(); return true; }
    return !view && (thread.current?.run(action) ?? false);
  } }), [view, back]);
  const [error, setError] = useState('');
  const resolveItem = connection.resolveItem;
  useEffect(() => {
    if (!view?.item) return;
    let current = true;
    setError('');
    void resolveItem?.(view.item).then(result => { if (current && !result) setError('Item unavailable'); })
      .catch(() => { if (current) setError('Item unavailable'); });
    return () => { current = false; };
  }, [resolveItem, view]);
  const openItem = (item: string, source?: HTMLElement) => {
    const next = { topic, item };
    if (!view) origin.current = source ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    history[view ? 'replaceState' : 'pushState']({ ...history.state, clandTopicView: next }, '');
    setView(next);
  };
  const openArtifact = (artifact: Artifact, source: HTMLElement) => {
    const next = { topic, artifact };
    origin.current = source;
    history.pushState({ ...history.state, clandTopicView: next }, '');
    setView(next);
  };
  const navigation = useContext(ItemNavigation);
  const facts = connection.topics?.find(row => row.id === topic);
  const item = view?.item ? findItem(connection, view.item) : undefined;
  return <ArtifactNavigation.Provider value={openArtifact}><ItemNavigation.Provider value={{ ...navigation, open: openItem }}><div className={s.page} data-phone-thread data-key-context="thread">
    <div className={s.thread} data-covered={!!view} aria-hidden={!!view} inert={!!view}>
      <Thread connection={connection} topic={topic} controls={thread} targetMessage={targetMessage} readable={!view} heading={<>
        <button onClick={back}>Back to Topics</button>
        <div className={s.identity}><h2>{facts?.title ?? topic}</h2><span>{topic}</span><span>{facts?.status}</span></div>
        {facts?.item && <button aria-label={`Item card ${facts.item}`} onClick={event => openItem(facts.item!, event.currentTarget)}>Card</button>}
      </>} />
    </div>
    {view && <section className={s.detail} aria-label={view.artifact ? 'Topic artifact' : 'Topic item'} data-key-context="thread">
      <header className={s.heading}><button ref={detailBack} onClick={() => history.back()}>Back to thread</button><h2>{view.artifact?.title ?? view.item}</h2></header>
      {error && <span role="alert">{error}</span>}
      {item && <ReadOnlyItemCard key={item.id} item={item} connection={connection} />}
      {view.artifact && <ArtifactViewerFallback.Provider value={view.artifact}><ArtifactViewer key={view.artifact.id} area="Artifacts" connection={connection} selected={view.artifact.id} rows={undefined} select={() => {}} /></ArtifactViewerFallback.Provider>}
    </section>}
  </div></ItemNavigation.Provider></ArtifactNavigation.Provider>;
}
