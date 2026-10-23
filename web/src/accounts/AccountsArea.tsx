import { useEffect, useRef, useState } from 'react';
import type { AreaContentProps, AreaModule } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import { accountId } from './state.ts';
import { accountModel, accountModels, harnessName } from './model.ts';
import { Profile } from './Profile.tsx';
import s from './Accounts.module.css';

function AccountFacts({ account }: { account: ReturnType<typeof accountModel> }) {
  return <div className={s.facts}>
    <div className={s.meta}><span>{harnessName(account.harness)}</span><span className={s.path}>{account.path ?? 'harness default'}</span></div>
    {account.status ? <div className={s.status}><span>—</span> <span>{account.status}</span></div> : <>
      <ul className={s.windows}>{account.windows.map(window => <li key={window.id} className={s.window}>
        <span>{window.label}</span><span className={s[window.tone]}>{window.share}</span><span className={s.reset} title={window.resetsAt}>↻{window.reset}</span>
      </li>)}</ul>
      <div className={s.meta}><span title={account.at ?? undefined}>{account.age}</span><span>{account.source}</span></div>
    </>}
    {account.limit && <div className={s.limit}><span>✗ limited</span><span title={account.limit.resetsAt ?? undefined}>{account.limit.reset}</span>
      <span title={account.limit.since}>since {account.limit.sinceTime}</span><span>hit by {account.limit.session}</span><span>{account.limit.reason}</span></div>}
  </div>;
}

function AccountsArea(props: AreaContentProps) {
  const list = props.connection.accounts;
  const polled = useRef(false);
  const [error, setError] = useState<string>();
  const poll = props.connection.pollAccounts;
  const live = props.connection.live;
  useEffect(() => {
    if (!live || !poll || polled.current) return;
    polled.current = true;
    let mounted = true;
    void poll().catch((failure: Error) => { if (mounted) setError(failure.message); });
    return () => { mounted = false; };
  }, [live, poll]);
  return <section data-area-module="Accounts" data-area-surface="pane" data-key-context="accounts">
    <Profile connection={props.connection} />
    {list?.registry && <div className={s.registry}>{list.registry}</div>}
    {list?.error && <div role="alert" className={s.critical}>{list.error}</div>}
    {error && <div role="alert" className={s.critical} title={error}>Poll failed</div>}
    {accountModels(list?.accounts ?? [], Date.now()).map(account => <article key={accountId(account)} className={s.account} data-account-id={accountId(account)}>
      <Fold area="accounts" id={accountId(account)} label={account.name} count={account.windows.length}
        actions={<button className={s.open} data-object-id={accountId(account)} aria-label={`Open ${account.name}`} aria-pressed={props.selected === accountId(account)}
          onFocus={() => props.select(accountId(account))} onClick={() => props.select(accountId(account))}>↗</button>}>
        <AccountFacts account={account} />
      </Fold>
    </article>)}
  </section>;
}
function AccountDetail(props: AreaContentProps & { surface: 'page' | 'drawer' }) {
  const account = props.connection.accounts?.accounts.find(row => accountId(row) === props.selected);
  return <section data-area-module="Accounts" data-area-surface={props.surface} data-key-context="accounts">
    {account && <><div className={s.registry}>{accountId(account)}</div><AccountFacts account={accountModel(account, Date.now())} /></>}
  </section>;
}
const AccountPage = (props: AreaContentProps) => <AccountDetail {...props} surface="page" />;
const AccountDrawer = (props: AreaContentProps) => <AccountDetail {...props} surface="drawer" />;
export const accountsModule: AreaModule = { context: 'accounts', handledActions: [], Pane: AccountsArea, Page: AccountPage, Drawer: AccountDrawer };
