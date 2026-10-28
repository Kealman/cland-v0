import { useContext, useId, useRef, useState } from 'react';
import type { ConnectionState } from './connection.ts';
import s from './Composer.module.css';
import { ComposerPicker } from './ComposerPicker.ts';
import type { Shortcut } from './keymap.ts';
import { addComposerFiles, sendComposerDraft, useComposerDraft } from './composer-drafts.ts';
import { usePhone } from './phone.ts';

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
  const phone = usePhone();
  const touch = phone && !reply;
  const [kindSheet, setKindSheet] = useState(false);
  const kindSheetId = useId();
  const [{ text, kind, to, artifacts, files, fileMaxBytes: maxBytes, pending, error }, update] = useComposerDraft(topic);
  const recipient = session ?? reply?.sender ?? (to === undefined ? connection.topics?.find(row => row.id === topic)?.item ? 'coordinator' : null : to);
  const name = recipient === 'coordinator' ? connection.coordinator ?? 'Coordinator' : recipient;
  const fileInput = useRef<HTMLInputElement>(null);
  const chooseFiles = async (chosen: File[]) => {
    try {
      const response = await fetch('/', { method: 'HEAD', credentials: 'same-origin', cache: 'no-store' });
      const limit = Number(response.headers.get('X-Upload-Max-Bytes'));
      if (!Number.isFinite(limit) || limit <= 0) throw new Error('Upload limit unavailable');
      addComposerFiles(topic, chosen, limit);
    } catch { update({ error: 'File uploads unavailable; refresh the workbench' }); }
  };
  const refused = files.length > 10 || files.some(file => maxBytes === undefined || file.size > maxBytes);
  const pick = useContext(ComposerPicker);
  const send = async () => {
    if (!connection.live || !connection.command || pending || refused || (!text.trim() && !files.length)) return;
    await sendComposerDraft(topic, async draft => {
      if (draft.files.length) {
        const body = new FormData();
        body.set('topic', topic); body.set('text', draft.text.trim()); body.set('kind', draft.kind);
        if (reply) body.set('replyTo', reply.id); else if (recipient) body.set('to', JSON.stringify([recipient]));
        if (draft.artifacts.length) body.set('artifacts', JSON.stringify(draft.artifacts.map(row => row.id)));
        for (const file of draft.files) body.append('files', file, file.name);
        const response = await fetch('/upload', { method: 'POST', body, credentials: 'same-origin' });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error ?? 'Upload failed');
        return result.value;
      }
      return connection.command!({ type: 'topic.send', topic, text: draft.text.trim(), kind: draft.kind,
      ...(reply ? { replyTo: reply.id } : recipient ? { to: [recipient] } : {}), ...(draft.artifacts.length ? { artifacts: draft.artifacts.map(row => row.id) } : {}) });
    });
  };
  const attachFile = <button type="button" disabled={!!pending} aria-label="Attach a file" title="Choose up to 10 files" onClick={() => fileInput.current?.click()}>{touch ? '＋' : 'Attach a file'}</button>;
  return <form data-composer data-phone-composer={touch || undefined} data-inbox-reply={reply?.id} aria-label="Composer" className={s.composer} onSubmit={event => { event.preventDefault(); void send(); }}>
    {touch && kindSheet && <div id={kindSheetId} role="group" aria-label="Send kind" className={s.kindSheet}>
      {(['message', 'decision', 'question'] as const).map(value => <button key={value} type="button" disabled={!!pending} aria-pressed={kind === value}
        onClick={() => { update({ kind: value }); setKindSheet(false); }}>
        {value[0]!.toUpperCase() + value.slice(1)}{kind === value && <span aria-hidden="true">✓</span>}
      </button>)}
    </div>}
    {touch ? <div className={s.touchAddressing}>
      <button type="button" disabled={!!pending} aria-expanded={kindSheet} aria-controls={kindSheetId} onClick={() => setKindSheet(!kindSheet)}>{kind[0]!.toUpperCase() + kind.slice(1)}</button>
      <button type="button" data-composer-session data-composer-recipient aria-label="Choose addressee" className={s.chip} disabled={!!pending || !!session}
        onClick={() => pick({ kind: 'Sessions', choose: row => update({ to: row.id }) })}>
        {name ?? '@'}{recipient === 'coordinator' && <span>Coordinator</span>}
      </button>
      {recipient && !session && <button type="button" disabled={!!pending} aria-label={`Remove ${name}`} onClick={() => update({ to: null })}>×</button>}
      {attachFile}
    </div> : <><div className={s.addressing}>{reply && !connection.live && <span data-reply-unsent>unsent</span>}{session ? <span data-composer-address>To {session} in {connection.topics?.find(row => row.id === topic)?.title ?? topic}</span>
      : recipient && <span data-composer-recipient className={s.chip}>{name}{recipient === 'coordinator' && <span>Coordinator</span>}
        {!reply && <button type="button" disabled={!!pending} aria-label={`Remove ${name}`} onClick={() => update({ to: null })}>×</button>}</span>}
      <button hidden={!!reply || !!session} type="button" disabled={!!pending || !!session} data-composer-session onClick={() => pick({ kind: 'Sessions', choose: row => update({ to: row.id }) })} title="Choose a session (@)">@</button></div>
    <div role="group" aria-label="Send kind" className={s.kinds}>{(['message', 'decision', 'question'] as const).map(value =>
      <button key={value} type="button" disabled={!!pending} aria-pressed={kind === value} onClick={() => update({ kind: value })}>{value[0]!.toUpperCase() + value.slice(1)}</button>)}</div></>}
    {pending && <div data-pending-message role="status" className={s.pending}><span>{pending.kind} · Sending</span><div>{pending.text}</div></div>}
    <textarea data-key-context={reply ? 'reply' : session ? 'session-composer' : 'composer'} aria-label="Message text" rows={reply || touch ? 1 : 3} value={text} onChange={event => update({ text: event.target.value })} />
    {artifacts.length > 0 && <div className={s.addressing}>{artifacts.map(row => <span key={row.id} data-composer-artifact className={s.chip}>{row.id} · {row.title}
      <button type="button" aria-label={`Remove ${row.title}`} onClick={() => update({ artifacts: artifacts.filter(value => value.id !== row.id) })}>×</button></span>)}</div>}
    {files.length > 0 && <div className={s.addressing}>{files.map((file, index) => <span key={index} data-composer-file data-refused={file.size > (maxBytes ?? 0) || files.length > 10} className={s.chip}
      title={file.size > (maxBytes ?? 0) ? `Refused: limit ${(maxBytes ?? 0) / 1024 / 1024} MiB per file` : files.length > 10 ? 'Refused: at most 10 files' : file.name}>
      {file.name} · {file.size.toLocaleString()} bytes{(file.size > (maxBytes ?? 0) || files.length > 10) && ' · Refused'}
      <button type="button" disabled={!!pending} aria-label={`Remove ${file.name}`} onClick={() => update({ files: files.filter((_, i) => i !== index) })}>×</button></span>)}</div>}
    <input ref={fileInput} hidden type="file" multiple aria-label="Files" onChange={event => { const chosen = Array.from(event.target.files ?? []); event.target.value = ''; void chooseFiles(chosen); }} />
    <div className={s.actions}>{error && <span role="alert" title={error}>Send failed</span>}
      {!touch && attachFile}
      {!phone && <button hidden={!!reply} type="button" disabled={!!pending} data-composer-attach title="Attach an artifact (~)" onClick={() => pick({ kind: 'Artifacts', topic, choose: row => update({ artifacts: [...artifacts.filter(value => value.id !== row.id), row] }) })}>Attach an artifact</button>}
      <button data-composer-send disabled={!connection.live || !!pending || refused || (!text.trim() && !files.length)}>Send</button></div>
  </form>;
}
