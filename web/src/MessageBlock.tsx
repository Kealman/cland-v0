import type { TopicMessage } from '../../shared/wire/index.ts';
import { ItemText } from './ItemText.tsx';
import { MarkdownBody } from './MarkdownBody.tsx';
import type { ConnectionState } from './connection.ts';
import { AskCard } from './AskCard.tsx';
import { InlineArtifact } from './artifacts/InlineArtifact.tsx';
import { useMessageWithdrawal } from './message-withdrawal.ts';
import s from './MessageBlock.module.css';
import { usePhone } from './phone.ts';

const roles: Record<string, string> = { human: 'Human', aide: 'Aide', coordinator: 'Coordinator', lead: 'Lead', implementer: 'Implementer', reviewer: 'Reviewer', qa: 'QA', hub: 'Hub', other: 'Other' };

function verdictOf(message: TopicMessage): { kind: string; result: 'clear' | 'not clear' } | undefined {
  const detail = message.detail;
  if (message.fromKind === 'hub' && message.kind === 'report' && (detail?.verdict === 'review' || detail?.verdict === 'qa') && (detail.result === 'clear' || detail.result === 'not clear')) return { kind: detail.verdict, result: detail.result };
  if (message.fromKind !== 'agent') return;
  const match = message.text.split(/[\r\n]/)[0]?.toLowerCase().match(/^(review|qa) (not clear|clear)(?=$|[^a-z])/);
  if (match) return { kind: match[1]!, result: match[2] as 'clear' | 'not clear' };
}

export function MessageBlock({ message, connection, showTopic = false }: { message: TopicMessage; connection: ConnectionState; showTopic?: boolean }) {
  const phone = usePhone();
  const withdrawal = useMessageWithdrawal(message.id);
  const canWithdraw = message.fromKind === 'human' && message.from === 'human' && !message.answerTo && (message.withdrawable ?? message.stage === 'queued') && !withdrawal.complete;
  const card = message.ask && message.ask.state !== 'open' ? message.ask : connection.askCards?.get(message.id) ?? message.ask;
  const folded = card && card.state !== 'open';
  const role = message.fromKind === 'human' ? 'human' : message.fromKind === 'hub' ? 'hub' : message.fromRole && Object.hasOwn(roles, message.fromRole) ? message.fromRole : 'other';
  const kind = message.kind ?? (message.fromKind === 'human' ? 'message' : 'report');
  const shownKind = message.fromKind === 'human' ? kind[0]!.toUpperCase() + kind.slice(1) : kind;
  const verdict = verdictOf(message);
  const criteria = message.criteria?.map(criterion => <span key={criterion.id} data-criterion={criterion.id} className={criterion.mark === 'failed' ? s.failed : s.verified}>
    {criterion.mark === 'failed' ? '✗' : '✓'} {criterion.id} {criterion.mark}{criterion.note && <> · {criterion.note}</>}
  </span>);
  const artifacts = [...new Map([...(message.artifact ? [message.artifact] : []), ...message.artifacts ?? []].map(artifact => [artifact.id, artifact])).values()];
  const delivery = <>
    <span className={s.state}>{message.stage && <span data-delivery-stage>{message.stage}</span>}{message.ask && <span data-ask-state>{message.ask.state}</span>}</span>
    {(canWithdraw || withdrawal.pending) && <button className={s.withdraw} disabled={!connection.live || !connection.command || !!withdrawal.pending} title={withdrawal.error} onClick={() => {
      if (connection.live && connection.command) void withdrawal.withdraw(message.topic, () => connection.command!({ type: 'topic.withdraw', topic: message.topic, message: message.id }));
    }}>{withdrawal.pending ? 'Withdrawing' : 'Withdraw'}</button>}
    {withdrawal.error && <span role="alert" title={withdrawal.error} className={s.failed}>Withdraw failed</span>}
  </>;
  return <article tabIndex={-1} data-key-context={card ? 'ask' : undefined} data-thread-row={message.id} data-message-id={message.id} data-message-seq={message.seq} data-role={role} data-layer={message.layer} data-compact={verdict?.result === 'clear'} className={s.message}>
    <span aria-hidden="true" data-role-gutter className={s.gutter} />
    <div className={s.content}>
      {!folded && <header className={s.header}><strong>{message.fromKind === 'human' ? 'you' : message.from}</strong>
        <span data-message-role className={s.role}>{roles[role]}</span>
        <span>→ {message.to.length ? message.to.map(name => name === 'human' ? 'you' : name).join(', ') : 'you'}</span>
        <span>{shownKind}</span>
        {showTopic && <span data-message-topic={message.topic}>{connection.topics?.find(topic => topic.id === message.topic)?.title ?? message.topic}</span>}
        {verdict && <span data-verdict={verdict.result} className={verdict.result === 'clear' ? s.verified : s.failed}>
          {verdict.result === 'clear' && message.fromKind === 'agent' ? <ItemText text={message.text.split(/[\r\n]/)[0]!} /> : `${verdict.kind} ${verdict.result}`}
        </span>}
        {verdict?.result === 'clear' && <>{typeof message.detail?.item === 'string' && <ItemText text={message.detail.item} />}{criteria}</>}
        {!phone && delivery}
        <time dateTime={message.ts}>{new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
      </header>}
      {card ? <AskCard id={message.id} topic={message.topic} card={card} connection={connection} sender={message.from} since={message.ts} /> : verdict?.result !== 'clear' && <div className={s.body}><MarkdownBody text={message.text} /></div>}
      {verdict?.result === 'not clear' && <div className={s.criteria}>{criteria}</div>}
      {artifacts.length > 0 && <div className={s.artifacts}>{artifacts.map(artifact => <InlineArtifact key={artifact.id} artifact={connection.artifacts?.find(row => row.id === artifact.id) ?? artifact} connection={connection} />)}</div>}
      {phone && !folded && <div className={s.delivery}>{delivery}</div>}
    </div>
  </article>;
}
