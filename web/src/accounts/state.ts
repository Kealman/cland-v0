import type { AccountList, AccountView } from '../../../shared/wire/index.ts';

export type AccountsState = { accounts?: AccountList; pollAccounts?: () => Promise<void> };
export const accountId = (account: Pick<AccountView, 'harness' | 'name'>) => `${account.harness}/${account.name}`;

/** A reading replaces the complete view without changing the registry's order. */
export function replaceAccount(list: AccountList | undefined, account: AccountView): AccountList {
  const rows = list?.accounts ?? [];
  const found = rows.some(row => accountId(row) === accountId(account));
  return { ...list, registry: list?.registry ?? '', accounts: found
    ? rows.map(row => accountId(row) === accountId(account) ? account : row) : [...rows, account] };
}
