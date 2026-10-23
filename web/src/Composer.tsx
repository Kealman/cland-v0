import { useContext } from 'react';
import type { ConnectionState } from './connection.ts';
import s from './Composer.module.css';
import { ComposerPicker } from './ComposerPicker.ts';
import type { Shortcut } from './keymap.ts';
import { sendComposerDraft, useComposerDraft } from './composer-drafts.ts';

export function runComposerShortcut(action: Shortcut): boolean {
  if (!action.startsWith('composer-')) return false;
  const form = document.activeElement?.closest('[data-composer]');
  if (action === 'composer-session') form?.querySelector<HTMLButtonElement>('[data-composer-session]')?.click();
  else if (action === 'composer-artifact') form?.querySelector<HTMLButtonElement>('[data-composer-attach]')?.click();
  else if (form) {
    const field = form.querySelector<HTMLTextAreaElement>('textarea')!;
    if (action === 'composer-newline' || action === 'composer-send' && (field.value.includes('\n') || matchMedia('(pointer: coarse)').matches)) {
      field.setRangeText('\n', field.selectionStart, field.selectionEnd, 'end');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    } else form.querySelector<HTMLButtonElement>('[data-composer-send]')?.click();
  }
  return !!form;
}

export type InboxReply = { id: string; sender: string };

export function Composer({ connection, topic, reply, session }: { connection: ConnectionState; topic: string; reply?: InboxReply | undefined; session?: string }) {
  const [{ text, kind, to, artifacts, pending, error }, update] = useComposerDraft(topic);
  const recipient = session ?? reply?.sender ?? (to === undefined ? connection.topics?.find(row => row.id === topic)?.item ? 'coordinator' : null : to);
  const name = recipient === 'coordinator' ? connection.coordinator ?? 'Coordinator' : recipient;
  const pick = useContext(ComposerPicker);
  const send = async () => {
    if (!connection.live || !connection.command || pending || !text.trim()) return;
    await sendComposerDraft(topic, draft => connection.command!({ type: 'topic.send', topic, text: draft.text.trim(), kind: draft.kind,
      ...(reply ? { replyTo: reply.id } : recipient ? { to: [recipient] } : {}), ...(draft.artifacts.length ? { artifacts: draft.artifacts.map(row => row.id) } : {}) }));
  };
  return <form data-composer data-inbox-reply={reply?.id} aria-label="Composer" className={s.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
    <div className={s.addressing}>{session ? <span data-composer-address>To {session} in {connection.topics?.find(row => row.id === topic)?.title ?? topic}</span>
      : recipient && <span data-composer-recipient className={s.chip}>{name}{recipient === 'coordinator' && <span>Coordinator</span>}
        {!reply && <button type="button" disabled={!!pending} aria-label={`Remove ${name}`} onClick={() => update({ to: null })}>×</button>}</span>}
      <button hidden={!!reply || !!session} type="button" disabled={!!pending || !!session} data-composer-session onClick={() => pick({ kind: 'Sessions', choose: row => update({ to: row.id }) })} title="Choose a session (@)">@</button></div>
    <div role="group" aria-label="Send kind" className={s.kinds}>{(['message', 'decision', 'question'] as const).map(value =>
      <button key={value} type="button" disabled={!!pending} aria-pressed={kind === value} onClick={() => update({ kind: value })}>{value[0]!.toUpperCase() + value.slice(1)}</button>)}</div>
    {pending && <div data-pending-message role="status" className={s.pending}><span>{pending.kind} · Sending</span><div>{pending.text}</div></div>}
    <textarea data-key-context={reply ? 'reply' : session ? 'session-composer' : 'composer'} aria-label="Message text" rows={reply ? 1 : 3} value={text} onChange={event => update({ text: event.target.value })} />
    {artifacts.length > 0 && <div className={s.addressing}>{artifacts.map(row => <span key={row.id} data-composer-artifact className={s.chip}>{row.id} · {row.title}
      <button type="button" aria-label={`Remove ${row.title}`} onClick={() => update({ artifacts: artifacts.filter(value => value.id !== row.id) })}>×</button></span>)}</div>}
    <div className={s.actions}>{error && <span role="alert" title={error}>Send failed</span>}
      <button hidden={!!reply} type="button" disabled={!!pending} data-composer-attach title="Attach an artifact (~)" onClick={() => pick({ kind: 'Artifacts', topic, choose: row => update({ artifacts: [...artifacts.filter(value => value.id !== row.id), row] }) })}>Attach an artifact</button>
      <button data-composer-send disabled={!connection.live || !!pending || !text.trim()}>Send</button></div>
  </form>;
}
