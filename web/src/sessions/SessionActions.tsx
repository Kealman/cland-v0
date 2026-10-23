import { useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { SessionRow } from '../../../shared/wire/index.ts';
import type { AreaControls } from '../AreaSlot.tsx';
import type { ConnectionState } from '../connection.ts';
import { SessionCapabilities } from './SessionCapabilities.tsx';
import s from './Sessions.module.css';

/** Row and page share the same confirmation and receipt handling. */
export function SessionActions({ row, connection, controls, showCapabilities = false, onBack }: {
  row: SessionRow; connection: ConnectionState; controls?: Ref<AreaControls> | undefined; showCapabilities?: boolean; onBack?: (() => void) | undefined;
}) {
  const [confirm, setConfirm] = useState<'Stop' | 'Archive' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [capabilities, setCapabilities] = useState(showCapabilities);
  const [fresh, setFresh] = useState<{ brief: string | null } | undefined>();
  const root = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const cancel = () => {
    setConfirm(null);
    const rowButton = root.current?.closest('[data-session-detail]')?.parentElement?.querySelector<HTMLButtonElement>('[data-object-id]');
    (rowButton ?? root.current)?.focus();
  };
  const execute = async () => {
    if (!confirm || !connection.live || !connection.command || busy.current) return;
    busy.current = true; setPending(true); setError('');
    try { await connection.command({ type: confirm === 'Stop' ? 'session.stop' : 'session.archive', session: row.name }); setConfirm(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  const resume = async (launchFresh = false) => {
    if (!connection.live || !connection.command || busy.current || row.live || !row.launched) return;
    busy.current = true; setPending(true); setError(''); setFresh(undefined);
    try {
      const answer = await connection.command<{ found: boolean; reason?: string; fresh?: { brief: string | null }; notes?: string[] }>({ type: 'session.resume', session: row.name, relaunch: !launchFresh, fresh: launchFresh });
      if (!answer.found) { setError(answer.reason ?? 'Harness cannot resume'); setFresh(answer.fresh); }
      else if (answer.notes?.length) setError(answer.notes.join(' · '));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  useImperativeHandle(controls, () => ({ run(action) {
    const focused = document.activeElement;
    if (action === 'session-open' && focused instanceof HTMLButtonElement && root.current?.contains(focused)) { focused.click(); return true; }
    if (pending && ['session-open', 'session-stop', 'session-resume', 'session-archive', 'dismiss'].includes(action)) return true;
    if (confirm && action === 'dismiss') { cancel(); return true; }
    if (action === 'dismiss' && onBack) { onBack(); return true; }
    if (capabilities && action === 'dismiss') { setCapabilities(false); return true; }
    if (confirm && action === 'session-open') { void execute(); return true; }
    if (confirm && ['session-stop', 'session-resume', 'session-archive', 'session-capabilities'].includes(action)) return true;
    if (action === 'session-stop') { if (row.live && row.launched && connection.live) setConfirm('Stop'); return true; }
    if (action === 'session-archive') { if (!row.live && row.launched && !row.archivedAt && connection.live) setConfirm('Archive'); return true; }
    if (action === 'session-resume') { void resume(); return true; }
    if (action === 'session-capabilities') { setCapabilities(value => !value); return true; }
    return false;
  } }));
  return <div ref={root} tabIndex={-1} className={s.actions} data-session-actions={row.name}>
    {confirm ? <div role="group" aria-label={`Confirm ${confirm} ${row.name}`} className={s.buttons}>
      <span>{confirm} {row.name}?</span>
      <button disabled={!connection.live || pending} onClick={() => { void execute(); }}>Confirm</button>
      <button disabled={pending} onClick={cancel}>Cancel</button>
    </div> : <div className={s.buttons}>
      <button aria-expanded={capabilities} onClick={() => setCapabilities(value => !value)}>Capabilities</button>
      {row.live && row.launched && <button disabled={!connection.live || pending} onClick={() => setConfirm('Stop')}>Stop</button>}
      {!row.live && row.launched && <button disabled={!connection.live || pending} onClick={() => { void resume(); }}>Resume</button>}
      {!row.live && row.launched && !row.archivedAt && <button disabled={!connection.live || pending} onClick={() => setConfirm('Archive')}>Archive</button>}
    </div>}
    {error && <span role="alert">{error}</span>}
    {fresh && !row.live && <button disabled={!connection.live || pending} title={`Same brief: ${fresh.brief ?? 'none'}`} onClick={() => { void resume(true); }}>Launch fresh</button>}
    {capabilities && <SessionCapabilities row={row} connection={connection} />}
  </div>;
}
