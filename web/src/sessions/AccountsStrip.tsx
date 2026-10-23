import type { AreaContentProps } from '../AreaSlot.tsx';
import { Fold } from '../Fold.tsx';
import { accountModels, harnessName } from '../accounts/model.ts';
import { accountId } from '../accounts/state.ts';
import s from './AccountsStrip.module.css';

/** P20: the same account projection as the registry, reduced to its worst window. */
export function AccountsStrip({ connection, navigate }: AreaContentProps) {
  const accounts = accountModels(connection.accounts?.accounts ?? [], Date.now());
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); navigate?.('Accounts'); };
  return <div data-session-slot="accounts" className={s.block}>
    <Fold area="sessions" id="accounts" label="Accounts" count={accounts.length}
      actions={<a href="#accounts" className={s.link} onClick={open} title="Registry and all limit windows">Accounts</a>}>
      <ul className={s.strip}>{accounts.map(account => {
        const details = [account.name, harnessName(account.harness),
          ...account.windows.map(window => `${window.label} ${window.share} ↻${window.reset}`),
          account.status, `${account.age} · ${account.source}`,
          account.limit && `limited ${account.limit.reset}, since ${account.limit.sinceTime}, hit by ${account.limit.session}: ${account.limit.reason}`,
        ].filter(Boolean).join(' · ');
        return <li key={accountId(account)}><a href="#accounts" onClick={open} className={s.cell} data-tone={account.tone} data-account-cell={accountId(account)} title={details}>
          <span className={s.line}><span className={s.name}>{account.name}</span><span className={s.share} data-account-share>
            {account.limit ? `✗ limited ${account.limit.reset}` : <>{account.worst?.label} {account.share}</>}
          </span></span>
          <span className={s.meta}><span>{harnessName(account.harness)}</span><span>{account.limit ? `hit by ${account.limit.session}` : account.worst ? `↻${account.worst.reset}` : '—'}</span></span>
          {account.worst && <span className={s.meter} role="meter" aria-label={`${account.name} ${account.worst.label} used`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={account.worst.usedPercent}>
            <span style={{ width: `${Math.max(0, Math.min(100, account.worst.usedPercent))}%` }} />
          </span>}
        </a></li>;
      })}</ul>
    </Fold>
  </div>;
}
