import { createContext, useContext, useRef, useState } from 'react';
import type { AskCard as Card } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';
import type { Shortcut } from './keymap.ts';
import s from './AskCard.module.css';

export const AskNavigation = createContext<(id: string, source: HTMLElement) => void>(() => {});

export function AskCard({ id, topic, card, connection }: { id: string; topic: string; card: Card; connection: ConnectionState }) {
  const openInbox = useContext(AskNavigation);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [draft, setDraft] = useState('');
  const [reason, setReason] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const answer = async (value: { option: number } | { text: string } | { declined: true; reason: string }) => {
    if (pending || !connection.live || !connection.command) return;
    setPending(true); setError('');
    try {
      await connection.command({ type: 'topic.answer', ask: id, ...value });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Answer failed');
      await connection.recoverAsk?.(id, topic).catch(() => {});
    }
    finally { setPending(false); }
  };
  const outcome = card.outcome;
  if (card.state !== 'open') return <div tabIndex={0} data-key-context="ask" data-ask-id={id} data-ask-state={card.state} className={s.folded} title={card.question}>
    <span data-ask-outcome>{outcome ? outcome.status === 'declined' ? `Declined: ${outcome.reason}` : `${outcome.option ? `${outcome.option} ` : ''}${outcome.text}` : card.state}</span>
    {outcome && <><span> · {outcome.by} · </span><time dateTime={outcome.at}>{new Date(outcome.at).toLocaleString()}</time></>}
  </div>;
  return <section tabIndex={0} data-key-context="ask" data-ask-id={id} data-ask-state="open" className={s.card} aria-label={card.question}>
    <div className={s.heading}><h3>{card.question}</h3>{!card.to && <a href={`#inbox/${encodeURIComponent(id)}`} onClick={event => { event.preventDefault(); openInbox(id, event.currentTarget); }}>In Inbox</a>}</div>
    {card.to ? <span className={s.meta}>Waiting for {card.to}</span> : <>
      <div className={s.options}>{card.options.map((option, index) => <button key={index} data-ask-option={index + 1} disabled={!connection.live || pending} onClick={() => void answer({ option: index + 1 })}><kbd>{index + 1}</kbd> {option}</button>)}</div>
      <form className={s.answer} onSubmit={event => { event.preventDefault(); if ((declining ? reason : draft).trim()) void answer(declining ? { declined: true, reason } : { text: draft }); }}>
        <div className={s.label}>
          {(card.free || declining) && <label>{declining ? 'Reason' : 'Free answer'}<input ref={field} value={declining ? reason : draft} disabled={!connection.live || pending} onChange={event => declining ? setReason(event.target.value) : setDraft(event.target.value)} /></label>}
          <button type="button" data-ask-decline disabled={!connection.live || pending} onClick={() => { setDeclining(value => !value); requestAnimationFrame(() => field.current?.focus()); }}>{declining ? 'Answer instead' : 'd · Decline'}</button>
        </div>
        {(card.free || declining) && <button type="submit" data-ask-send className={declining ? s.decline : undefined} disabled={!connection.live || pending || !(declining ? reason : draft).trim()}>{declining ? 'Decline' : 'Send answer'}</button>}
      </form>
      {pending && <span role="status" className={s.meta}>Sending answer</span>}
      {error && <span role="alert" className={s.error}>{error}</span>}
    </>}
  </section>;
}

/** Called by the one shell dispatcher; cards add no keyboard listener. */
export function runAskShortcut(action: Shortcut): boolean {
  if (!action.startsWith('ask-')) return false;
  const focused = document.activeElement;
  const card = focused?.closest('[data-ask-id]') ?? focused?.querySelector('[data-ask-id]');
  if (action === 'ask-decline') card?.querySelector<HTMLButtonElement>('[data-ask-decline]')?.click();
  else if (action === 'ask-free') card?.querySelector<HTMLInputElement>('input')?.focus();
  else card?.querySelector<HTMLButtonElement>(`[data-ask-option="${action.slice(4)}"]`)?.click();
  return !!card;
}
