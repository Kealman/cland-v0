import type { ClientRequest, HubFrame, Inbox } from '../protocol.ts';
import type { TaskRequest } from '../tracker/requests.ts';
import type { SessionRequest } from '../adapters/requests.ts';

type Rule = true | ((frame: Record<string, unknown>, topicOf: (message: string) => string | null) => string | null);

/** Pairing rows are local access grants, never remote cards or notices. */
export function gatewayInbox(inbox: Inbox): Inbox {
  const { pairings, ...visible } = inbox;
  return { ...visible, needsYou: visible.needsYou - (pairings?.length ?? 0) };
}

/** Deliberately partial: every absent action, including future frames, is refused. */
export const GATEWAY_AUTHORITY = {
  'topic.send': (frame, topicOf) => {
    if (Object.hasOwn(frame, 'artifacts')) return 'artifact actions are not available to remotes';
    if (frame.replyTo !== undefined) {
      const topic = typeof frame.replyTo === 'string' ? topicOf(frame.replyTo) : null;
      return topic !== null && topic === frame.topic ? null : 'a reply must name an existing message in the same topic';
    }
    return frame.topic === 'general' ? null : 'new messages may only go into General; other topics require a reply';
  },
  'topic.answer': true,
  'approval.answer': true,
  'hub.status': true,
  'task.list': true,
  'inbox.list': true,
} satisfies Partial<Record<(ClientRequest | TaskRequest | SessionRequest)['type'], Rule>>;

/** Checked before replay, validation or actor resolution, using the hub's stored message. */
export function gatewayAuthorityRefusal(frame: Record<string, unknown>, topicOf: (message: string) => string | null): Extract<HubFrame, { ok: false }> | null {
  let reason: string | null;
  if (Object.hasOwn(frame, 'as')) reason = 'a remote cannot act as another identity';
  else if (frame.type === 'topic.answer' && typeof frame.ask === 'string' && frame.ask.startsWith('pairing:')
    || frame.type === 'approval.answer' && typeof frame.approval === 'string' && frame.approval.startsWith('pairing:')) reason = 'pairing approval is only available locally';
  else if (typeof frame.type !== 'string' || !Object.hasOwn(GATEWAY_AUTHORITY, frame.type)) reason = 'the gateway has no authority for this request';
  else {
    const rule = GATEWAY_AUTHORITY[frame.type as keyof typeof GATEWAY_AUTHORITY];
    reason = rule === true ? null : rule(frame, topicOf);
  }
  return reason === null ? null : {
    type: 'result', id: typeof frame.id === 'string' ? frame.id : '?', ok: false,
    code: 'forbidden', permission: String(frame.type), role: 'human', reason,
    error: `${String(frame.type)} refused by the gateway: ${reason}`,
  };
}
