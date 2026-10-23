import { useSyncExternalStore } from 'react';
import { restoreComposerText } from './composer-drafts.ts';

type Withdrawal = { pending?: boolean; error?: string; complete?: boolean };
const empty: Withdrawal = {};
const withdrawals = new Map<string, Withdrawal>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function update(id: string, state: Withdrawal) {
  withdrawals.set(id, state);
  for (const listener of listeners) listener();
}

/** Message identity keeps pending actions shared across panes and topic navigation. */
export function useMessageWithdrawal(id: string) {
  const state = useSyncExternalStore(subscribe, () => withdrawals.get(id) ?? empty);
  const withdraw = async (topic: string, send: () => Promise<{ text: string }>) => {
    const current = withdrawals.get(id);
    if (current?.pending || current?.complete) return;
    update(id, { pending: true });
    try {
      const receipt = await send();
      restoreComposerText(topic, receipt.text);
      update(id, { complete: true });
    } catch (error) {
      update(id, { error: error instanceof Error ? error.message : 'Withdraw failed' });
    }
  };
  return { ...state, withdraw };
}
