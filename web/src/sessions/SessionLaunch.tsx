import { useEffect, useImperativeHandle, useId, useRef, useState, type Ref } from 'react';
import type { AreaControls } from '../AreaSlot.tsx';
import type { ConnectionState } from '../connection.ts';
import s from './SessionLaunch.module.css';

type Values = { name: string; role: string; harness: string; model: string; account: string; effort: string; item: string; brief: string };
export function SessionLaunch({ connection, aide, controls, close }: {
  connection: ConnectionState; aide: boolean; controls: Ref<AreaControls>; close: () => void;
}) {
  const id = useId();
  const roles = connection.roles?.roles ?? [];
  const [values, setValues] = useState<Values>(() => {
    const launch = roles.find(row => row.role === 'aide')?.launch;
    const used = new Set([...connection.sessions ?? [], ...connection.archivedSessionRows ?? []].map(row => row.name));
    let n = 1;
    while (used.has(`aide-${n}`)) n++;
    return { name: aide ? `aide-${n}` : '', role: aide ? 'aide' : '', harness: aide ? launch?.harness ?? '' : '',
      model: aide ? launch?.model ?? '' : '', account: aide ? launch?.account ?? '' : '', effort: aide ? launch?.effort ?? '' : '', item: '', brief: '' };
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [modelNote, setModelNote] = useState('');
  const modelVisit = useRef(0);
  useEffect(() => () => { modelVisit.current++; }, []);
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    form.current?.querySelector<HTMLInputElement>(aide ? '[name="brief"]' : '[name="name"]')?.focus();
    return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, [aide]);
  const submit = async () => {
    if (!connection.live || !connection.command || busy.current) return;
    if (!values.name.trim()) { setError('A session needs a name'); return; }
    busy.current = true; setPending(true); setError('');
    const fields = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]).filter(([, value]) => value));
    try { await connection.command({ type: 'session.launch', ...fields, name: values.name.trim() }); close(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { busy.current = false; setPending(false); }
  };
  useImperativeHandle(controls, () => ({ run(action) {
    if (action === 'accept') { void submit(); return true; }
    if (action === 'dismiss') { if (!busy.current) close(); return true; }
    return true;
  } }));
  const offerModels = async () => {
    const visit = ++modelVisit.current;
    setModels([]); setModelNote('');
    const harness = values.harness || roles.find(row => row.role === values.role)?.launch.harness || 'claude-code';
    if (!connection.live || !connection.command) { setModelNote('Models unavailable offline'); return; }
    if (harness !== 'codex' && harness !== 'claude-code' && harness !== 'opencode') return;
    try {
      const result = await connection.command<{ models: Array<{ id: string; default: boolean }> }>({ type: 'models.list', harness, ...(values.account ? { account: values.account } : {}) });
      if (visit !== modelVisit.current) return;
      setModels([...result.models.filter(model => model.default), ...result.models.filter(model => !model.default)].map(model => model.id));
      if (!result.models.length) setModelNote('No models returned');
    } catch (cause) { if (visit === modelVisit.current) setModelNote(cause instanceof Error ? cause.message : String(cause)); }
  };
  const change = (key: keyof Values, value: string) => {
    setError('');
    if (key === 'role' || key === 'harness' || key === 'account') { modelVisit.current++; setModels([]); setModelNote(''); }
    setValues(previous => {
      if (key === 'role') {
        const launch = roles.find(row => row.role === value)?.launch;
        return { ...previous, role: value, harness: launch?.harness ?? previous.harness,
          model: launch?.model ?? '', account: launch?.account ?? '', effort: launch?.effort ?? '' };
      }
      if (key === 'harness' && value !== previous.harness) {
        const launch = roles.find(row => row.role === previous.role)?.launch;
        if (value === launch?.harness) return { ...previous, harness: value, model: previous.model || launch.model || '', effort: previous.effort || launch.effort || '', account: previous.account || launch.account || '' };
        return { ...previous, harness: value,
          model: previous.model === launch?.model ? '' : previous.model,
          effort: previous.effort === launch?.effort ? '' : previous.effort,
          account: previous.account === launch?.account ? '' : previous.account };
      }
      return { ...previous, [key]: value };
    });
  };
  return <form ref={form} aria-label={aide ? 'New Aide' : 'Launch a session'} className={s.form} data-key-context="launch"
    onSubmit={event => { event.preventDefault(); void submit(); }}>
    <h2>{aide ? 'New Aide' : 'Launch a session'}</h2>
    <fieldset disabled={pending} className={s.fields}>
      {(Object.keys(values) as Array<keyof Values>).map(key => <label key={key}>{key[0]!.toUpperCase() + key.slice(1)}
        {key === 'role' ? <select aria-label="Role" data-key-context="launch" value={values.role} onChange={event => change('role', event.target.value)}>
          <option value="">—</option>{roles.map(role => <option key={role.role} value={role.role}>{role.label}</option>)}
        </select> : key === 'account' ? <select aria-label="Account" data-key-context="launch" value={values.account} onChange={event => change('account', event.target.value)}>
          <option value="">Harness default</option>
          {connection.accounts?.accounts.filter(account => account.harness === values.harness).map(account => <option key={account.name} value={account.name}>{account.name}</option>)}
        </select> : <input name={key} list={key === 'harness' ? `${id}-harnesses` : key === 'model' ? `${id}-models` : undefined} aria-label={key[0]!.toUpperCase() + key.slice(1)} data-key-context="launch" onFocus={key === 'model' ? () => { void offerModels(); } : undefined} onBlur={key === 'model' ? () => { modelVisit.current++; } : undefined} value={values[key]} onChange={event => change(key, event.target.value)} />}
      </label>)}
    </fieldset>
    <datalist id={`${id}-harnesses`}>{['claude-code', 'codex', 'opencode'].map(harness => <option key={harness} value={harness} />)}</datalist>
    <datalist id={`${id}-models`}>{models.map(model => <option key={model} value={model} />)}</datalist>
    {modelNote && <div role="status" title={modelNote}>Models · {modelNote}</div>}
    {error && <div role="alert" className={s.error}>{error}</div>}
    <div className={s.buttons}><button disabled={!connection.live || pending}>Launch</button><button type="button" disabled={pending} onClick={close}>Cancel</button></div>
  </form>;
}
