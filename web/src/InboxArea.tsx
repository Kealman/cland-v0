import { useRef } from 'react';
import type { InboxAsk } from '../../shared/wire/index.ts';
import type { AreaContentProps, AreaModule } from './AreaSlot.tsx';
import { AreaObjectDetail, AreaObjects } from './AreaObjects.tsx';
import { AskCard } from './AskCard.tsx';
import { Fold } from './Fold.tsx';
import s from './InboxArea.module.css';

function InboxArea(props: AreaContentProps) {
  const retained = useRef(new Map<string, InboxAsk>());
  for (const row of props.connection.sessionAsks ?? []) retained.current.set(row.id, row);
  const rows = [...retained.current.values()];
  const approvalIds = new Set(props.connection.inbox?.approvals.map(row => row.id));
  const approvals = props.rows?.filter(row => approvalIds.has(row.id));
  const other = props.rows?.filter(row => !retained.current.has(row.id) && !approvalIds.has(row.id));
  return <section data-area-module="Inbox" data-area-surface="pane" data-key-context="inbox">
    <div role="list" aria-label="Inbox objects" className={s.rows}>
      <Fold area="inbox" id="asks" label="Asks and approvals" count={(props.connection.sessionAsks?.length ?? 0) + (props.connection.approvals ?? 0)}>
        {rows.map(row => <div key={row.id} role="listitem" data-object-id={row.id} onFocus={() => props.select(row.id)}>
          <AskCard id={row.id} topic={row.topic.id} card={props.connection.askCards?.get(row.id) ?? { question: row.question, options: row.options, free: row.free, state: 'open' }} connection={props.connection} />
        </div>)}
        <AreaObjects {...props} rows={approvals} label="Inbox approvals" />
      </Fold>
      <AreaObjects {...props} rows={other} label="Other Inbox objects" />
    </div>
  </section>;
}

export const inboxModule: AreaModule = { context: 'inbox', handledActions: [], Pane: InboxArea, Page: AreaObjectDetail, Drawer: AreaObjectDetail };
