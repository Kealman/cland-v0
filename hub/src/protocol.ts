// The hub ↔ spoke protocol. One integer version, bumped on any incompatible change.
// Frames travel as JSON text over one WebSocket per spoke.

import type { Layer } from './hub/visibility.ts';
import type { ItemSummary } from './tracker/tracker.ts';
export type { ModelDelta, ModelEvent, SlimTaskFrame, VisibilityFrame } from '../../shared/wire/index.ts';
import type { ModelDelta, SlimTaskFrame, VisibilityFrame } from '../../shared/wire/index.ts';

export { PROTOCOL_VERSION, parseFrame, FRAME_LIMITS_BYTES, BINARY_RESERVED_CLOSE_CODE } from '../../shared/protocol-frame.ts';
import { FRAME_LIMITS_BYTES } from '../../shared/protocol-frame.ts';

/** The spoke's keepalive interval; the hub closes a socket silent for two of them. */
export const KEEPALIVE_MS = 30_000;

/**
 * The largest frame the hub reads; a bigger one closes the socket before it is parsed. Every frame
 * the protocol carries today is kilobytes (a message's text is capped by hygiene at 8 KiB).
 */
export const MAX_FRAME_BYTES = FRAME_LIMITS_BYTES.json;

/** The close code a hub older than T-51 sent a spoke when a newer spoke of its session took its name. Today's hub
 *  never sends it (every spoke of a session stands), and a spoke that gets it reconnects like after any close. */
export const REPLACED_CLOSE_CODE = 4002;

/** What a refused spoke is told to do: the message names the fix, never only the fact. */
export const UPDATE_HINT = 'update cland and restart the session';

export type FromKind = 'human' | 'agent' | 'hub';
export type Via = 'session' | 'hub';
export type SendKind = 'progress' | 'report' | 'question' | 'decision' | 'request';
export type RequestKind = 'review' | 'qa' | 'handover';
export const SEND_KINDS: readonly SendKind[] = ['progress', 'report', 'question', 'decision', 'request'];
export function isSendKind(value: unknown): value is SendKind {
  return typeof value === 'string' && SEND_KINDS.includes(value as SendKind);
}
export type Outcome = 'delivered' | 'queued' | 'unknown' | 'refused' | 'empty';

/** A standing request for hub events, owned by the caller's stable session identity. */
export type SubscriptionSubject = { session: string } | { item: string } | { topic: string } | { role: string } | { subtree: string };
export type SubscriptionEvent = 'session.state' | 'task' | 'topic' | 'usage' | 'artifact';
export type UsageThreshold = { cost: number } | { tokens: number };
export type OwnedSubscription = Subscription & { subscriberId: string };
export type Subscription = { id: string; subject: SubscriptionSubject; events: SubscriptionEvent[]; digest: 'turn' | 'now'; threshold?: UsageThreshold; default?: true };
export type SubscriptionRequest = (
  | { type: 'event.subscribe'; id: string; subject: SubscriptionSubject; events: SubscriptionEvent[]; digest?: 'turn' | 'now'; threshold?: UsageThreshold }
  | { type: 'event.unsubscribe'; id: string; subscription: string }
  | { type: 'event.subscriptions'; id: string }
) & { as?: { name: string; sessionId?: string; shell?: boolean } };
export function isHeldDelivery(message: { kind?: string | undefined; detail?: Record<string, unknown> }): boolean {
  return message.kind === 'progress' || (message.kind === 'event' && message.detail?.digest !== 'now');
}

/** Current work held by a session, with an Implementer's claim first. */
export type SessionHold = { item: string; role: 'item' | 'review' | 'qa'; heldAt?: string };
export type PendingVerification = { item: string; kind: 'review' | 'qa' };

export type Presence = {
  layer?: Layer;
  name: string;
  sessionId: string;
  cwd: string;
  /** The role the session holds (hub-held, ADR 0001), or null. */
  role: string | null;
  /** The name as it is shown everywhere: `rev-1 [Reviewer]`. */
  label?: string;
  status: string | null;
  connectedAt: string;
  /** What the session's harness is doing, from its adapter's signals only (spec 4.2); `unknown` when no adapter can tell. */
  state: SessionState;
  holds?: SessionHold[];
  pending?: PendingVerification;
};

/** A session's state (spec 4.2): fed by its harness adapter, never by the model's own `status`. */
export type SessionState = 'idle' | 'busy' | 'waiting for human' | 'waiting for approval' | 'unknown';
export const SESSION_STATES: readonly SessionState[] = ['idle', 'busy', 'waiting for human', 'waiting for approval', 'unknown'];

export type ArtifactKind = 'prompt' | 'note' | 'page' | 'diagram' | 'file';
export type Artifact = {
  layer?: Layer;
  id: string; title: string; kind: ArtifactKind; path: string; creator: string; time: string;
  topic: string; status: 'draft' | 'sent' | 'shared' | 'archived' | 'moved';
  creatorKind?: 'human' | 'agent'; creatorRole?: string | null;
  folder?: boolean; entry?: string; kept?: boolean;
  movedTo?: { folder: string; path: string }; explicitArchive?: boolean;
  promoted?: string; archivedAt?: string; fileDeleted?: boolean;
  /** Owned manual-delete storage, recorded before any bytes move. */
  deletion?: { path: string; backup: string };
};
export type ArtifactCreate = { type: 'artifact.create'; id: string; kind: string; title: string; topic: string; path?: string; content?: string; folder?: boolean; entry?: string; status?: 'draft' | 'shared' };
export type PromptSend = { type: 'prompt.send'; id: string; artifact: string; attach?: boolean };
export type ArtifactPromote = { type: 'artifact.promote'; id: string; artifact: string; path: string };
export type ArtifactList = { type: 'artifact.list'; id: string; topic?: string; artifact?: string; before?: string };
export type ArtifactKeep = { type: 'artifact.keep'; id: string; artifact: string; kept?: boolean };
export type ArtifactDelete = { type: 'artifact.delete'; id: string; artifact: string };
export type ArtifactArchive = { type: 'artifact.archive'; id: string; artifact: string };
export type ArtifactMove = { type: 'artifact.move'; id: string; artifact: string; folder: string; name?: string };
/** Filters on the Agents record; when both are given they intersect. */
export type AgentsHistoryFilter = { item?: string; session?: string };

export type MarkedCriterion = { id: string; mark: 'verified' | 'failed'; note?: string };

/** Answer origin; a human-shell stand-in self-identifies, and relays preserve that origin. */
export type AnswerAttribution = { answered_as: 'human' | 'stand-in'; answered_by?: string; relayed_by?: string };
export type AskAnswer = AnswerAttribution & { ask: string; answer: string };

export type Message = {
  layer?: Layer;
  /** Informational warning, independent of actionability. */
  severity?: 'warn';
  id: string;
  from: string;
  fromKind: FromKind;
  /** The sender's role when a session wrote it; absent on the hub's own message. */
  fromRole?: string;
  via: Via;
  /** The resolved addressees of this delivery. */
  to: string[];
  text: string;
  replyTo?: string;
  ts: string;
  /** The topic the message belongs to (its id); absent on the hub's own notices. */
  topic?: string;
  /** An agent's send kind, or a hub notice's lifecycle kind (`role`, `claim`, `mute`, …). */
  kind?: string;
  request?: RequestKind;
  subject?: string;
  /** Held progress and events attached to this addressee's turn-starting delivery, oldest first. */
  digest?: Message[];
  /** The notice's facts, typed by its kind: a mute carries its `HygieneRefusal` and the pair. */
  detail?: Record<string, unknown>;
  /** The human's answer to an ask (#33): the ask's message id. */
  answerTo?: string;
  /** A tracked question's card, also carried by agent deliveries. */
  ask?: AskCard;
  /** Criteria marked by a recorded verdict; consumers render these directly. */
  criteria?: MarkedCriterion[];
  artifact?: Artifact;
  artifacts?: Artifact[];
} & Partial<AnswerAttribution>;

/** Why hygiene refused a send (spec 4.2): the size cap, the session's rate limit, or the pair's loop breaker
 *  (with the mute's end). Carried by a refused outcome, a refused request's result, and the mute notice. */
export type HygieneRefusal = { code: 'hygiene'; rule: 'rate' | 'loop' | 'size'; until?: string };

// ------------------------------------------------------------------ topics (spec 4.5)

export type TopicStatus = 'open' | 'waiting for human' | 'waiting for agent' | 'closed';

export type Topic = {
  layer?: Layer;
  id: string;
  title: string;
  /** Set by message direction, `resolve` and `close` (spec 4.5, `src/hub/topics.ts`); Agents stays `open`. */
  status: TopicStatus;
  /** General and Agents: created at the project's first hub start, never renamed, deleted or closed. */
  standing: boolean;
  createdAt: string;
  updatedAt: string;
  /** The unit of work the topic is bound to (an item id, `T-12`), or null; one topic per item at most. */
  item: string | null;
  /** The human's unread messages: those from others since the human last read the topic (`topic.read`). */
  readSeq?: number;
  unread: number;
  /** The latest message's time, or null for a topic with no message yet (listed last). */
  lastMessageAt: string | null;
  /** A message waits for a role nobody holds: `no coordinator` (or `no reviewer`, …); absent otherwise. */
  warning?: string;
  /** Parties that can currently settle an open ask, excluding forwarded parents. */
  waitingFor?: string[];
};

/** How a topic travels with a delivery or an event: its id, its title and its binding. */
export type TopicRef = { id: string; title: string; item?: string | null };

/** A message's progress (spec 4.2): `queued` until every addressee's spoke acked it, then `delivered`;
 *  `injected` once every addressee's adapter confirmed the turn; `dropped` when it waited past the TTL. */
export type DeliveryStage = 'queued' | 'delivered' | 'injected' | 'dropped';

/** Exclusive numeric history cursors; string `before` preserves the Neovim message-id cursor. */
export type TopicHistoryFilter = AgentsHistoryFilter & { before?: number | string; after?: number };
/** A topic message: durable `seq`, delivery stage, and an ask card when applicable. */
export type TopicMessage = Message & { seq: number; topic: string; stage?: DeliveryStage; ask?: AskCard };

// ------------------------------------------------------------------ asks and the inbox (spec 4.5 and 5, #33)

/** An ask's life: open until the human answers it, the Coordinator withdraws it (`resolve`), or the topic or its
 *  item closes (cancelled). */
export type AskState = 'open' | 'answered' | 'withdrawn' | 'cancelled';

/** The durable decision carried by an ask and its inbox departure. */
export type AskOutcome = { by: string; at: string } & (
  | { status: 'answered'; text: string; option?: number }
  | { status: 'declined'; reason: string }
);

/** An ask as its message carries it: the question is the message's text. */
export type AskCard = {
  question: string;
  /** The numbered options, 1 first; may be empty when only a free answer makes sense. */
  options: string[];
  /** Whether a free answer is welcome beside the options. */
  free: boolean;
  state: AskState;
  /** Agent recipient; absent for a human ask. */
  to?: string;
  /** The unchanged ask forwarded to the next level. */
  forwarded?: string;
  /** The answer's message id, once answered. */
  answer?: string;
  /** The option the human chose (1-based), absent for a free answer. */
  option?: number;
  /** Present once an answer is recorded, independent of the answer message's retention. */
  outcome?: AskOutcome;
} & Partial<AnswerAttribution>;

/** An open ask as the inbox lists it. */
export type InboxAsk = { layer?: Layer; id: string; topic: TopicRef; question: string; options: string[]; free: boolean; from: string; fromRole?: string; label: string; ts: string; since: string };

/** A session waiting for approval: answered in the session itself (spec 4.3), so the row attaches it. */
export type InboxApproval = { layer?: Layer; id: string; session: string; role?: string; label: string; harness: string | null; since: string; attach: string | null; command?: string };
export type InboxPlan = { layer?: Layer; id: string; subject: string; title: string; stages?: number; lanes?: number; items?: number; since: string };
export type InboxRequest = { layer?: Layer; id: string; from: string; fromRole?: string; request: RequestKind; subject: string; topic: TopicRef; ts: string; since: string; text: string };
export type InboxMessage = { layer?: Layer; severity?: 'warn'; id: string; from: string; fromRole?: string; subject: string; topic: TopicRef; ts: string; since: string; text: string };
export type InboxRowKind = 'ask' | 'approval' | 'plan' | 'request' | 'message';
export type InboxDeparture = { outcome?: AskOutcome; kind: InboxRowKind; id: string; subject: string; since: string; ts: string; text?: string; reason: 'answered' | 'withdrawn' | 'cancelled' | 'approved' | 'closed' | 'invalidated' | 'replied' | 'declined' | 'read' };

export type NotificationKind = 'account-limited' | 'executor-fallback' | 'plan' | 'verdict' | 'role' | 'death' | 'idle' | 'delivery-stalled' | 'delivery-uncertain' | 'turn-failed' | 'release' | 'import';

/** The four now sections (§3.7); waiting remains as topic metadata for older clients. */
export type Inbox = { asks: InboxAsk[]; approvals: InboxApproval[]; plans: InboxPlan[]; requests: InboxRequest[]; messages: InboxMessage[]; waiting: Topic[]; needsYou: number; archiveToday?: number; archive?: InboxDeparture[]; departures?: InboxDeparture[] };

/** Journal rows, newest first; cursors are opaque continuations over the append-only file. */
export const EVENT_KINDS = ['session', 'task', 'verdict', 'suite', 'release', 'artifact', 'usage', 'topic', 'heartbeat', 'rule'] as const;
export type EventKind = typeof EVENT_KINDS[number];
export type EventSubject = { kind: 'item' | 'session' | 'topic' | 'artifact' | 'rule'; id: string };
export type EventsFilter = { kinds?: EventKind[]; warnings?: boolean; subject?: EventSubject; muted?: EventSubject[] };
export type EventRow = { count?: number; bookkeeping?: boolean; warning?: boolean; replaces?: string; firstTs?: string; id: string; ts: string; kind: EventKind; subject: EventSubject; text: string; glyph: string; item?: string; session?: string; topic?: string; artifact?: string; rule?: string };
export function isEventsFilter(f: unknown): boolean {
  if (f === undefined) return true;
  if (!isObject(f)) return false;
  const subject = (s: unknown) => isObject(s) && ['item', 'session', 'topic', 'artifact', 'rule'].includes(String(s.kind)) && typeof s.id === 'string' && s.id.length > 0;
  return (f.kinds === undefined || Array.isArray(f.kinds) && f.kinds.every(k => EVENT_KINDS.includes(k)))
    && (f.warnings === undefined || typeof f.warnings === 'boolean') && (f.subject === undefined || subject(f.subject))
    && (f.muted === undefined || Array.isArray(f.muted) && f.muted.every(subject));
}
export type EventsPage = { rows: EventRow[]; before: string | null; more: boolean };

/** What the hub pushes to a subscribed client. */
export type HubEvent =
  | { type: 'event'; row: EventRow }
  | { type: 'verification.queue'; queue: VerificationQueue }
  | { type: 'visibility' }
  | { type: 'crew'; config: import('./crew.ts').CrewConfig; summary: string }
  | { type: 'artifact'; artifact: Artifact }
  /** The connected sessions, replaced on a hello, last spoke leaving, rename, status or role change. */
  | { type: 'presence'; sessions: Presence[] }
  /** A process-table row changed: the same view as session.list, replaced by stable session id or name. */
  | { type: 'session.process'; process: HarnessProcessView; archived?: number }
  /** One complete replacement row, or a removal by stable key. Featured model clients only. */
  | { type: 'session.row'; key: string; row: SessionRow | null }
  | { type: 'sessions.pruned'; sessionIds: string[]; archived: number }
  /** Failed launch supervision changed; no accepted process row is implied. */
  | { type: 'session.cleanup'; sessionId: string; state: 'pending stop' | 'settled' }
  /** Complete rulebook after a write or valid reload, for connected workbenches. */
  | { type: 'rules.changed'; rules: readonly import('./rules/rulebook.ts').Rule[] }
  /** Latest usage totals, coalesced per launch; old launches must never update a new row under the same name. */
  | { type: 'account'; account: import('./accounts/limits.ts').AccountView }
  | { type: 'session.usage'; session: string; sessionId: string; usage: SessionUsage }
  /** A new message in a topic: the human's, an agent's. */
  | { type: 'message'; topic: TopicRef & Pick<Topic, 'unread' | 'lastMessageAt'>; message: TopicMessage }
  /** A message's stage changed. */
  | { type: 'delivery'; topic: string; message: string; stage: DeliveryStage }
  /** A session's state changed (spec 4.2), from its adapter: `source` names the signal (`hook`, `mod`, `poll`, `process`). */
  | { type: 'session.state'; layer?: Layer; session: string; sessionId: string; state: SessionState; source: string; ts: string; approvalCommand?: string }
  /** A session's role changed: assigned, moved, cleared (null), or vacated by its harness's death. */
  | { type: 'session.role'; session: string; role: string | null; previous: string | null; reason: string; ts: string }
  /** A topic changed: created, its status, its warning, its binding or the human's unread count. */
  | { type: 'topic'; topic: Topic }
  | { type: 'marks'; marks: HumanMarks }
  /** An ask's state changed (answered, withdrawn, cancelled): the thread's card follows it. */
  | { type: 'ask'; topic: string; ask: string; card: AskCard }
  /** The inbox changed (an ask, an approval, a plan, a request, a message): all of it, as `inbox.list` answers. */
  | { type: 'inbox'; inbox: Inbox }
  /** No live session holds the Coordinator any more: the UI shows "no coordinator". */
  | { type: 'role.vacant'; role: 'coordinator'; ts: string }
  /** A live session holds the Coordinator again. */
  | { type: 'role.filled'; role: 'coordinator'; session: string; ts: string }
  /** The tracker's index changed (a hub write, a hand edit the watcher read, a removed file, a claim): the item as
   *  `task.list` shows it, or null when its file is gone. */
  | { type: 'task'; id: string; item: ItemSummary | null; done_items?: number; siblings?: string[]; layers?: Record<string, Layer> };

/** A role's clause as the hub delivers it to the holder (spec 4.4): on assignment and on every reconnect.
 *  `role` null: the session's role was revoked. */
export type RoleClause = {
  role: string | null;
  clause: string;
  skills: string[];
  /** The handover note the role came with (#31): to the new holder, on the handover and on its reconnects. */
  note?: HandoverNote;
  /** Who held the role before: with `note`, the session that wrote it (`human` when the human did). */
  from?: string;
  /** On a revocation: why (`handover`: the role moved to `to`). */
  reason?: string;
  /** On a revocation by handover: the session that holds the role now. */
  to?: string;
};

/** The handover note (spec 4.4, decision #10): four sections, each non-empty text. */
export type HandoverNote = { goals_now: string; work_in_flight: string; open_decisions: string; waiting_on: string };

/** A role's state as its holder pulls it (`role.state`, #31): what a new holder continues from. */
export type RoleState = {
  /** The node whose Lead state is returned. */
  item?: string;
  role: string;
  label: string;
  /** The role's holders (live, or remembered within the queue's TTL). */
  holders: RoleHolder[];
  /** The latest handover note of the role, or null; `to` is the holder it was written for. */
  note: { sections: HandoverNote; markdown: string; from: string; to: string; at: string } | null;
  /** The latest move of the role (a handover by its holder, or the human's reassignment). */
  handover: { from: string | null; to: string; by: string; at: string } | null;
  /** The topics waiting for the role: their status says so (`waiting for agent`), or a message addressed to the role or
   *  its holders (current and previous) is newer than their last word in it. `reason` says which. */
  waiting: Array<{ topic: TopicRef; status: TopicStatus; reason: 'status' | 'addressed'; pending: number; last: string }>;
  /** The open asks the role put to the human (#33): asked by its holders, or by the holder it moved from. */
  asks: InboxAsk[];
  /** The tracker claims held by the role's holders. */
  claims: Array<{ item: string; title: string; session: string; sessionId: string; claimedAt: string }>;
};

export type Hello = {
  type: 'hello';
  protocol: number;
  sessionId: string;
  cwd: string;
  /** Requested name; absent means "assign me one". */
  name?: string;
  /** Proves this hello belongs to a particular pending launch; supplied through CLAND_LAUNCH_TOKEN. */
  launchToken?: string;
  /** The role the session asks for (`CLAND_ROLE`). A project's hub honours it only for a session it launched for
   *  that role; otherwise the role is the one the human assigned (`role.set`), and a session with none is refused. */
  role?: string;
};

export type ReleaseRequest = { type: 'release'; id: string; version?: string; item?: string; dryRun?: boolean };

export type MergeQueueEntry = { item: string; branch: string; head: string; verdictBase: string; enqueued: string; by: { id: string; name: string; role: string | null } };
export type BatchSuite = { id: string; members: MergeQueueEntry[]; diagnostic?: { key: string; files: string[] } };
export type MergeRequest = { type: 'merge'; id: string; item: string; override?: string; cancel?: boolean };
export type MergeQueueRequest = { type: 'merge.queue'; id: string };

export type SpokeRequest =
  | RuleRequest
  | SuiteStart
  | SubscriptionRequest
  | MergeRequest
  | MergeQueueRequest
  | ArtifactCreate
  | ArtifactList
  | ArtifactKeep
  | ArtifactArchive
  | ArtifactMove
  | ArtifactPromote
  /** `to` absent or empty: the message goes into the topic for the human only. `topic` defaults to General. */
  | { type: 'send'; id: string; to?: string[]; text: string; kind?: SendKind; request?: RequestKind; subject?: string; replyTo?: string; topic?: string; artifacts?: string[] }
  | { type: 'who'; id: string }
  /** `topic`: that topic's latest messages instead of the session's own traffic; Agents accepts item/session filters. */
  | ({ type: 'history'; id: string; limit?: number; with?: string; topic?: string } & AgentsHistoryFilter)
  | { type: 'status'; id: string; text: string }
  | { type: 'rename'; id: string; name: string }
  /** Open a topic, with a title and optionally bound to an item: `{ topic: Topic }`. */
  | { type: 'topic.create'; id: string; title: string; item?: string }
  /** Clear a topic's wait (`waiting for human` or `waiting for agent`) back to `open`, withdrawing its open asks: `{ topic: Topic }`. */
  | { type: 'resolve'; id: string; topic: string }
  /** The Coordinator hands its role to `to` with a note (#31); `then: "implementer"` keeps the caller as an Implementer. */
  | { type: 'role.handover'; id: string; to: string; note?: HandoverNote | string; then?: string }
  /** The state of the caller's role (`role` defaults to it): `RoleState`. */
  | { type: 'role.state'; id: string; role?: string }
  /** Ask the human (the Coordinator only): a question with numbered options and room for a free answer. `{ ask, topic }` */
  | { type: 'ask'; id: string; topic: string; question: string; options: string[]; free?: boolean }
  | { type: 'ask.forward'; id: string; ask: string }
  | { type: 'ask.answer'; id: string; ask: string; text: string }
  /** The keepalive. */
  | { type: 'ping'; id: string };

/** The spoke accepted a delivered message (spec 4.2, `delivered`): the hub stops re-sending it. No reply. */
export type Ack = { type: 'ack'; id: string };

export type SpokeFrame = Hello | SpokeRequest | Ack;

export type RefusalCode = 'version' | 'unauthorized' | 'name-in-use' | 'bad-name' | 'bad-hello' | 'no-role';

export type HubFrame =
  | { type: 'welcome'; name: string; presence: Presence[]; role?: string; features?: ClientFeature[]; buildStamp?: string | null }
  | SnapshotFrame
  | SnapshotEnd
  | SnapshotRefused
  | Resync
  | ModelDelta
  | SlimTaskFrame
  | VisibilityFrame
  /** `id` is the message's id; the spoke answers with an `ack` of it. Re-sent until acked, so a spoke may see it twice.
   *  `topic` is the topic the message belongs to; absent on the hub's own notices. */
  | { type: 'deliver'; id: string; message: Message; topic?: TopicRef }
  /** The session's role clause (or its revocation), carried by a hub message (`message`, id `id`) the spoke acks
   *  like a `deliver`; the message's text is what the model reads. */
  | ({ type: 'role'; id: string; message: Message } & RoleClause)
  | { type: 'result'; id: string; ok: true; value: unknown }
  /** A failed request. `code: 'forbidden'`: the permission table refused it (spec 4.4): `permission` is the one
   *  missing (`tool` or `tool:scope`), `role` the caller's at call time, `reason` why. `refusal`: a hygiene refusal (typed). */
  // cli-neovim-only: the web authority policy keeps this request in local clients.
  | { type: 'result'; id: string; ok: false; error: string; files?: string[]; recovery?: { commit: string; base: string }; account?: string; resetsAt?: string | null; code?: 'cli-neovim-only' | 'account-limited' | 'verify-all-reserved' | 'verify-tiers' | 'verify-test-lint' | 'verify-shards' | import('./territory-push.ts').PushCode | import('./territory-publish.ts').PublishCode | import('./release.ts').ReleaseCode | import('./merge.ts').MergeCode | 'forbidden' | 'note-incomplete' | 'invalid-cwd' | 'git-unavailable' | 'artifact-kind' | 'artifact-source' | 'artifact-topic' | 'artifact-title' | 'artifact-unavailable' | 'artifact-path' | 'artifact-busy'; permission?: string; role?: string | null; reason?: string; missing?: string[]; refusal?: HygieneRefusal }
  | { type: 'error'; code: RefusalCode; message: string; action?: 'restart-hub' }
  /** To a harness's in-session bridge (the Claude Code mod): submit this message as a turn, then confirm it (`session.signal` `injected`). */
  | { type: 'inject'; session: string; message: string; text: string }
  | HubEvent;

export type SendOutcome = { to: string; outcome: Outcome; reason?: string; refusal?: HygieneRefusal; resolvedTo?: string };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function isHello(f: Record<string, unknown>): f is Hello {
  return (
    f.type === 'hello' &&
    typeof f.protocol === 'number' &&
    typeof f.sessionId === 'string' &&
    typeof f.cwd === 'string' &&
    (f.name === undefined || typeof f.name === 'string') &&
    (f.launchToken === undefined || typeof f.launchToken === 'string') &&
    (f.role === undefined || typeof f.role === 'string')
  );
}

export function isAck(f: Record<string, unknown>): f is Ack {
  return f.type === 'ack' && typeof f.id === 'string';
}

export function isSpokeRequest(f: Record<string, unknown>): f is SpokeRequest {
  if (f.type === 'suite.start') return isClientRequest(f);
  if (typeof f.id !== 'string') return false;
  switch (f.type) {
    case 'rule.add':
    case 'rule.edit':
    case 'rule.retire':
    case 'rule.list':
    case 'rule.show':
      return isClientRequest(f);
    case 'event.subscribe':
    case 'event.unsubscribe':
    case 'event.subscriptions':
      return true;
    case 'merge.queue':
      return true;
    case 'merge':
      return typeof f.item === 'string' && (f.override === undefined || typeof f.override === 'string') && (f.cancel === undefined || typeof f.cancel === 'boolean');
    case 'artifact.create':
    case 'artifact.list':
      return isClientRequest(f);
    case 'artifact.keep':
    case 'artifact.archive':
    case 'artifact.move':
    case 'artifact.promote':
      return true;
    case 'who':
    case 'ping':
      return true;
    case 'history':
      return (f.limit === undefined || typeof f.limit === 'number') && (f.with === undefined || typeof f.with === 'string') && (f.topic === undefined || typeof f.topic === 'string') && isAgentsHistoryFilter(f);
    case 'role.handover':
      return typeof f.to === 'string' && (typeof f.note === 'string' || isObject(f.note) || f.note === undefined) && (f.then === undefined || typeof f.then === 'string');
    case 'role.state':
      return f.role === undefined || typeof f.role === 'string';
    case 'status':
      return typeof f.text === 'string';
    case 'rename':
      return typeof f.name === 'string';
    case 'topic.create':
      return typeof f.title === 'string' && (f.item === undefined || typeof f.item === 'string');
    case 'resolve':
      return typeof f.topic === 'string';
    case 'ask.forward':
      return typeof f.ask === 'string';
    case 'ask.answer':
      return typeof f.ask === 'string' && typeof f.text === 'string';
    case 'ask':
      return (
        typeof f.topic === 'string' &&
        typeof f.question === 'string' &&
        Array.isArray(f.options) &&
        f.options.every((o) => typeof o === 'string') &&
        (f.free === undefined || typeof f.free === 'boolean')
      );
    case 'send':
      return (
        (f.kind === undefined || isSendKind(f.kind)) &&
        (f.to === undefined || (Array.isArray(f.to) && f.to.every((t) => typeof t === 'string'))) &&
        typeof f.text === 'string' &&
        (f.replyTo === undefined || typeof f.replyTo === 'string') &&
        (f.topic === undefined || typeof f.topic === 'string')
      );
    default:
      return false;
  }
}

export function isHubFrame(f: Record<string, unknown>): f is HubFrame {
  switch (f.type) {
    case 'welcome':
      return typeof f.name === 'string' && Array.isArray(f.presence);
    case 'snapshot':
      return typeof f.epoch === 'string' && Number.isSafeInteger(f.seq) && typeof f.domain === 'string' && Object.hasOwn(SNAPSHOT_LIMITS, f.domain) && isObject(f.value);
    case 'snapshot.end':
      return typeof f.epoch === 'string' && Number.isSafeInteger(f.seq);
    case 'resync':
      return f.reason === 'queue-limit' || f.reason === 'snapshot-required';
    case 'snapshot.refused':
      return f.code === 'unavailable' ? typeof f.message === 'string' : f.code === 'frame-too-large' && typeof f.domain === 'string' && Object.hasOwn(SNAPSHOT_LIMITS, f.domain) && typeof f.bytes === 'number' && typeof f.limit === 'number';
    case 'deliver':
      return typeof f.id === 'string' && isObject(f.message) && typeof f.message.id === 'string' && typeof f.message.text === 'string';
    case 'role':
      return typeof f.id === 'string' && isObject(f.message) && typeof f.message.text === 'string' && (f.role === null || typeof f.role === 'string') && typeof f.clause === 'string' && Array.isArray(f.skills);
    case 'result':
      return typeof f.id === 'string' && typeof f.ok === 'boolean';
    case 'error':
      return typeof f.code === 'string' && typeof f.message === 'string';
    default:
      return false;
  }
}

// ------------------------------------------------------------------ the Unix socket (UI and CLI)
// The same frames as JSON lines, one per line. There is no upgrade request to carry the secret, so the
// client's hello carries it; on stdio the parent that spawned the hub vouches for the client instead.

/** Negotiated independently; unknown features are ignored. */
export type ClientFeature = 'snapshot' | 'numbered-deltas' | 'slim-frames';
export const SNAPSHOT_LIMITS = {
  tracker: 64 * 1024, items: MAX_FRAME_BYTES, sessions: MAX_FRAME_BYTES,
  topics: MAX_FRAME_BYTES, inbox: MAX_FRAME_BYTES, events: MAX_FRAME_BYTES,
  accounts: 256 * 1024,
} as const;
export type HumanMarks = { events: string | null; plans: Record<string, string>; imported: boolean };
export type SnapshotValues = {
  tracker: { levels: string[]; ladder: string[][]; prefixes: Record<string, string> };
  items: { items: import('./tracker/tracker.ts').ExplorerSummary[]; done_items?: number };
  sessions: { rows: SessionRow[]; processes: HarnessProcessView[]; presence: Presence[]; archived: number; roles: RoleList; crew: { config: import('./crew.ts').CrewConfig; summary: string }; coordinator: string | null; verification: VerificationQueue | null };
  topics: { topics: Topic[]; marks: HumanMarks };
  inbox: Inbox & { needsYou: number };
  events: EventsPage;
  accounts: import('./accounts/limits.ts').AccountList;
};
export type SnapshotDomain = keyof SnapshotValues;
export type SnapshotFrame = { [D in SnapshotDomain]: { type: 'snapshot'; epoch: string; seq: number; domain: D; value: SnapshotValues[D] } }[SnapshotDomain];
export type SnapshotEnd = { type: 'snapshot.end'; epoch: string; seq: number };
export type SnapshotRefused = { type: 'snapshot.refused'; code: 'frame-too-large'; domain: SnapshotDomain; bytes: number; limit: number } | { type: 'snapshot.refused'; code: 'unavailable'; message: string };

export type Resync = { type: 'resync'; reason: 'queue-limit' | 'snapshot-required' };

export type ClientHello = {
  type: 'hello';
  protocol: number;
  /** The project's secret, from `.cland/secret` or `hub.json`; not needed on an edge that authenticated the peer. */
  secret?: string;
  /** What is connecting: `cli`, `ui`. */
  client: string;
  /** Unknown features are ignored; welcome echoes only implemented features. */
  features?: string[];
  /** Atomically replay after this cursor instead of taking an initial snapshot. */
  resume?: { epoch: string; seq: number };
};

// Operational verification occasions are independent of configured tracker container kinds.
export const VERIFY_OCCASIONS = { batch: 'batch', stage: 'stage', epic: 'epic', release: 'release', soak: 'soak', 'dev-t3': 'dev-t3' } as const;
export type VerifyOccasion = typeof VERIFY_OCCASIONS[keyof typeof VERIFY_OCCASIONS];
export function isVerifyOccasion(value: unknown): value is VerifyOccasion {
  return Object.values(VERIFY_OCCASIONS).some(occasion => occasion === value);
}
/** Field diagnostics shared by frame validation and verification admission. */
export function suiteStartIssues(f: Record<string, unknown>): string[] {
  const issues: string[] = [];
  if (typeof f.id !== 'string') issues.push('id must be a string');
  if (typeof f.cwd !== 'string') issues.push('cwd must be an absolute directory; supply cwd when no item is claimed');
  if (!['auto', 'all', 'hub', 'nvim'].some(mode => mode === f.mode)) issues.push('mode must be auto, all, hub or nvim');
  if (f.executor !== undefined && !['local', 'droplet'].some(executor => executor === f.executor)) issues.push('executor must be local or droplet');
  if (typeof f.report !== 'string' && !(f.report === undefined && f.dryRun === true)) issues.push('report must be a string (required unless dryRun is true)');
  if (f.to !== undefined && !(Array.isArray(f.to) && f.to.every(value => typeof value === 'string'))) issues.push('to must be an array of strings');
  if (f.occasion !== undefined && !isVerifyOccasion(f.occasion)) issues.push(`occasion must be ${Object.values(VERIFY_OCCASIONS).join(', ')}`);
  for (const field of ['dryRun', 'fresh', 'diagnostics']) {
    if (f[field] !== undefined && typeof f[field] !== 'boolean') issues.push(`${field} must be a boolean`);
  }
  if (f.diagnostics === true && f.dryRun !== true) issues.push('diagnostics requires dryRun: true');
  if (f.workers !== undefined && !(typeof f.workers === 'number' && Number.isSafeInteger(f.workers) && f.workers > 0)) issues.push('workers must be a positive safe integer');
  if (f.size !== undefined && !(typeof f.size === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(f.size))) issues.push('size must be a slug starting with a letter or digit, using letters, digits, dots, underscores or hyphens');
  return issues;
}

export type SuiteStart = { type: 'suite.start'; dryRun?: boolean; diagnostics?: boolean; workers?: number; size?: string; occasion?: VerifyOccasion; id: string; mode: 'auto' | 'all' | 'hub' | 'nvim'; cwd: string; report?: string; to?: string[]; fresh?: boolean; executor?: import('./executor/executor.ts').ExecutorKind };
export type SuiteSlot = { type: 'suite.slot' | 'suite.forced'; id: string; mode: string; cwd: string; head: string; pid: number; token: string };
/** Read-only targeted-test admission; never reserves a human queue position. */
export type SuiteSlotCheck = { type: 'suite.slot'; id: string; check: true; lease?: { pid: number; started: string; token: string } };
export type SuiteSlotResult = { id: string; admitted: boolean; locks: string[]; queue: VerificationQueue };
export type SuiteCancel = { type: 'suite.cancel'; id: string; suite?: string };
export type SuiteClassify = { type: 'suite.classify'; id: string; suite: string; cause: 'load-flake'; note: string };

export type RuleRequest =
  | { type: 'rule.add'; id: string; text: string; scope: string; reason: string; title?: string; origin?: string | { topic: string; msg_id: string } }
  | { type: 'rule.edit'; id: string; origin?: string | { topic: string; msg_id: string }; number: number; title?: string; text?: string; scope?: string; reason?: string }
  | { type: 'rule.retire'; id: string; origin?: string | { topic: string; msg_id: string }; number: number; reason: string }
  | { type: 'rule.list'; id: string; all?: boolean; role?: string }
  | { type: 'rule.show'; id: string; number: number };

export type DemoRequest =
  | { type: 'demo.start'; id: string; epic: string; commit?: string }
  | { type: 'demo.exec'; id: string; epic: string; command: string[] }
  | { type: 'demo.stop' | 'demo.status'; id: string; epic: string; commit?: string };

export type ArtifactUrl = { type: 'artifact.url'; id: string; artifact: string };
export type ArtifactUrlResult = { url: string };
export type WebLink = { type: 'web.link'; id: string; qr?: boolean };
export type WebLinkResult = { url: string };
export type WebSessions = { type: 'web.sessions'; id: string };
export type WebRevoke = { type: 'web.revoke'; id: string; session: string };
export type WebSession = { id: string; createdAt: string; lastUsedAt: string; sockets: number };
export type WebSessionsResult = { sessions: WebSession[] };
export type WebRevokeResult = { revoked: string };

export type ClientRequest =
  | { type: 'resume'; id: string; epoch: string; seq: number }
  | ArtifactUrl | WebLink | WebSessions | WebRevoke
  | DemoRequest
  | RuleRequest
  | { type: 'account.clear'; id: string; account: string }
  | { type: 'models.list'; id: string; harness: 'claude-code' | 'codex' | 'opencode'; account?: string; refresh?: boolean }
  | { type: 'account.list'; id: string }
  | { type: 'account.poll'; id: string }
  | { type: 'task.migrate'; id: string; dryRun: true }
  | { type: 'suite.queue'; id: string }
  | { type: 'visibility.set'; id: string; surface: 'topics' | 'sessions' | 'artifacts'; target: string; mode: 'pin' | 'mute' }
  | SuiteStart
  | SuiteSlot
  | SuiteSlotCheck
  | SuiteCancel
  | SuiteClassify
  | ReleaseRequest
  | { type: 'sync'; id: string }
  | { type: 'push'; id: string }
  | { type: 'publish'; id: string; branch: string; item: string; dryRun?: boolean }
  | MergeRequest
  | MergeQueueRequest
  | ArtifactCreate
  | ArtifactList
  | ArtifactKeep
  | ArtifactDelete
  | ArtifactArchive
  | ArtifactMove
  | PromptSend
  | ArtifactPromote
  /** What runs: the hub's process and the connected sessions. */
  | { type: 'crew.show'; id: string }
  | { type: 'executor.status' | 'executor.reap'; id: string }
  | { type: 'executor.prepare'; id: string; report?: string }
  | { type: 'executor.retire-legacy'; id: string; confirmRegisteredHubs: boolean }
  | { type: 'crew.set'; id: string; key: string; value: unknown }
  | { type: 'config.set'; id: string; key: string; value: unknown }
  | { type: 'hub.subscriptions'; id: string }
  | { type: 'hub.status'; id: string; flushLogs?: boolean; history?: boolean }
  /** Shut the hub down gracefully; the result is sent before the socket closes. */
  | { type: 'hub.stop'; id: string }
  | { type: 'hub.reload'; id: string }
  /** The project's topics, standing ones first: `{ topics: Topic[] }`. */
  | { type: 'topic.list'; id: string }
  /** Oldest-first history: latest by default, exclusive numeric before/after pages (max 200). */
  | ({ type: 'topic.history'; id: string; topic: string; limit?: number } & TopicHistoryFilter)
  /** The human writes into a topic: to `to` when given, else to the `@role` and `@session` mentions in the text, else
   *  to the Coordinator. `{ message: TopicMessage, outcomes }`. In Agents only a reply is accepted: `replyTo` names an
   *  agent's message there, and the reply addresses its sender. */
  | { type: 'topic.send'; id: string; topic: string; text: string; to?: string[]; replyTo?: string; artifacts?: string[] }
  | { type: 'topic.rename'; id: string; topic: string; title: string }
  | { type: 'topic.delete'; id: string; topic: string }
  /** The human opens a topic, optionally bound to an item: `{ topic: Topic }`. */
  | { type: 'topic.create'; id: string; title: string; item?: string }
  /** The human closes a topic; a new message reopens it: `{ topic: Topic }`. */
  | { type: 'topic.close'; id: string; topic: string }
  /** The human clears a topic's wait back to `open`: `{ topic: Topic }`. */
  | { type: 'topic.resolve'; id: string; topic: string }
  /** The human read the topic up to a message (its id; absent: the latest): `{ topic: Topic }` with `unread`. */
  | { type: 'topic.read'; id: string; topic: string; upTo?: string }
  | { type: 'marks.get'; id: string }
  | { type: 'marks.set'; id: string; events?: string; plans?: Record<string, string>; import?: boolean }
  /** Subscribe/update the connection's events filter. With filter, returns `{ subscribed: true, events: EventsPage }`; absent resets to all rows. */
  | { type: 'subscribe'; id: string; filter?: EventsFilter }
  /** The human assigns a role to a session, live or not yet connected: `{ session: RoleHolder }`. */
  | { type: 'role.set'; id: string; session: string; role: string; note?: HandoverNote | string; move?: boolean; item?: string }
  /** A role's state, as its holder would pull it: `RoleState`. */
  | { type: 'role.state'; id: string; role: string; session?: string }
  /** The human revokes a session's role: `{ session: RoleHolder }`. */
  | { type: 'role.clear'; id: string; session: string }
  /** The roles, their definitions and holders: `RoleList`. */
  | { type: 'role.list'; id: string }
  | { type: 'role.launch'; id: string; role: string; fields: import('./roles/launch.ts').LaunchFields }
  /** A person lifts the loop breaker's mute of a pair of sessions (by name): `{ lifted: boolean, pair: [a, b] }`. */
  | { type: 'hygiene.unmute'; id: string; a: string; b: string }

  /** The human answers an ask with an option (1-based) or a free text: `{ message: TopicMessage, outcomes }`. */
  | { type: 'topic.answer'; id: string; ask: string; option?: number; text?: string; as?: { name: string; sessionId?: string; shell?: boolean } }
  /** The inbox: `Inbox`. */
  | { type: 'inbox.list'; id: string; archive?: boolean }
  /** Human-only row actions, returning Inbox. */
  | { type: 'inbox.decline'; id: string; request: string }
  | { type: 'inbox.read'; id: string; message: string }
  /** At most 200 journal rows older than before: EventsPage. */
  | { type: 'events.list'; id: string; before?: string; limit?: number; filter?: EventsFilter }
  /** The task worktrees with their items and the sessions inside (T-58): `{ worktrees: WorktreeEntry[] }`. */
  | { type: 'worktree.list'; id: string }
  /** The human's prune: without items (or `dryRun`), the closed items' worktrees `{ candidates }`; with items, each
   *  one's worktree and branch removed: `{ removed, failed }`. Refused from a session's shell. */
  | { type: 'worktree.prune'; id: string; items?: string[]; dryRun?: boolean };

/** A session and its role as the role frames answer. */
export type RoleHolder = { name: string; role: string | null; label: string; live: boolean };

/** A role's launch defaults (roles.toml): `approval` and `sandbox` are null where the file gives none. */
export type RoleLaunch = {
  harness: string;
  account: string | null;
  permissions: string | null;
  model: string | null;
  effort: string | null;
  approval: string | null;
  sandbox: { mode: string; writableRoots: string[]; network: string } | null;
};

export type RoleList = {
  roles: Array<{ role: string; label: string; exclusive: boolean; skills: string[]; launch: RoleLaunch; warnings?: string[]; holders: RoleHolder[] }>;
  /** The live Coordinator's name, or null: "no coordinator". */
  coordinator: string | null;
};

export type CoverCause = 'test-failure' | 'budget' | 'load-flake' | 'cancel-head' | 'cancel-requester' | 'timeout';
export type CoverRecord = { status: 'green' | 'red' | 'cancelled'; cause: CoverCause | null; tests: string[];
  derivedCause?: CoverCause | null; classification?: { note: string; by: string; at: string } };
export type CoverStatus = { id: string; head: string; branch: string; completedAt: string | null; cover: CoverRecord };

/** Admission and completion facts; extra fields are absent on pre-V1 hubs. */
export type SuiteStatus = {
  webPhase?: { status: 'not-run'; reason: string };
  devT3Probe?: { key: string; files: string[] };
  batch?: BatchSuite;
  cover?: CoverRecord;
  workers?: number; size?: string;
  occasion?: VerifyOccasion;
  executor: import('./executor/executor.ts').ExecutorKind;
  platform?: import('./executor/executor.ts').Platform;
  id: string; pid: number | null; topic: string; reported: boolean;
  outcome: { code: number; cause: string } | null; error: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished'; queued?: string | null;
  priority?: number | null; item?: string | null; head?: string; branch?: string; integrated?: boolean;
  selection?: import('./suite-selection.ts').SuiteSelection;
  tree?: string | null; finished?: string | null; cached?: { run: string; head: string; tree: string; occasion?: VerifyOccasion | null; executor?: import('./executor/executor.ts').ExecutorKind };
  admittedAt?: string | null; completedAt?: string | null; waitMs?: number | null; runMs?: number | null;
  timingEstimated?: boolean;
};

/** Milliseconds throughout. Null means there is no duration evidence yet. ETA is time until admission. */
export type VerificationWaiter = {
  waitingFor?: 'remote';
  occasion?: VerifyOccasion;
  kind?: 'run' | 'hand run';
  executor?: 'local' | 'droplet';
  id: string; session: string; item: string | null; mode: string; worktree: string;
  position: number; queuedAt: string | null; waitMs: number; etaMs: number | null; expectedRunMs: number | null;
};
export type VerificationHolder = {
  occasion?: VerifyOccasion; shard?: string;
  executor?: 'local' | 'droplet'; machine?: { name: string; size: string; region: string };
  kind: 'run' | 'hand run'; id: string | null; session: string | null; item: string | null; mode: string | null;
  pid: number | null; worktree: string | null; since: string | null; runMs: number | null; etaMs: number | null;
};
export type DurationStats = { count: number; medianMs: number | null; p90Ms: number | null };
export type QueueWaitStats = { count: number; cacheHits: number; p50Ms: number | null; p90Ms: number | null };
export type QueueWaitMetrics = {
  targetP90Ms: number;
  last24Hours: Record<'local' | 'droplet', QueueWaitStats>;
  last50Runs: Record<'local' | 'droplet', QueueWaitStats>;
};
export type MergeBatchStatus = { id: string; members: MergeQueueEntry[]; run?: string; candidate?: { tree: string }; failed?: string };
export type VerificationQueue = {
  batch?: MergeBatchStatus | null;
  version: 1; at: string; holder: VerificationHolder | null; remote?: VerificationHolder[]; remoteBudget?: number; localFallback?: boolean; waiters: VerificationWaiter[];
  metrics: { window: number; count: number; wait: DurationStats; run: DurationStats; queueWait?: QueueWaitMetrics };
};

export type WebEdgeStatus = { port: number; bind?: string; available: boolean; reason?: string };

/** Latest completed result per suite kind/occasion; full receipts remain opt-in. */
export type SuiteSummary = {
  id: string; kind: 'task' | 'integrated'; occasion: VerifyOccasion | null;
  head: string; exit: number | null; finishedAt: string | null; artifact: string | null;
};

export type HubStatus = {
  /** Actual spoke listener address; absent on older or stdio-only hubs. */
  spokeBind?: string;
  /** The independent browser listener; absent on older or stdio-only hubs. */
  web?: WebEdgeStatus;
  /** Scheduling priority observed at hub startup. Absent on older hubs. */
  priority?: import('./hub/priority.ts').HubPriority;
  mergeQueue?: MergeQueueEntry[];
  covers?: CoverStatus[];
  verification?: VerificationQueue;
  /** Queued/running suites; history:true explicitly includes completed receipts. */
  suites?: SuiteStatus[];
  recentSuites?: SuiteSummary[];
  crew?: { config: import('./crew.ts').CrewConfig; summary: string };
  /** Keyboard layouts from config.toml, read at hub start; the UI uses these for langmap. */
  keys?: { layouts: string[] };
  /** Flat first-kind levels for older clients; ladder carries every peer kind, ordered top-down. */
  tracker?: { levels: string[]; ladder?: string[][]; prefixes?: Record<string, string>; storage?: import('./tracker/tracker.ts').TrackerStorageStatus };
  pid: number;
  port: number;
  socket: string;
  version: string;
  root: string;
  startedAt: string;
  config?: import('./hub/configuration.ts').ConfigStatus;
  uptimeMs: number;
  sessions: Presence[];
  /** The live session holding the Coordinator, or null ("no coordinator"). */
  coordinator?: string | null;
  /** The harness processes the hub launched (its process table), each with its state. */
  harnesses?: HarnessProcessView[];
  /** The top bar's "needs you" count: open asks, sessions waiting for approval, topics waiting for the human (#33). */
  needsYou?: number;
  /** Request health: blocking (`slow-request`), answer latency including waits (`slow-answer`), repeated reads. */
  requests?: { slow: number; lastSlow?: { tool: string; client: string; ms: number; at: string; phase?: 'resumed' | 'answer' }; replayed: number; slowAnswers: number; lastSlowAnswer?: { tool: string; client: string; ms: number; at: string } };
};

/** Comparable token counts: input excludes cache; reasoning is a subset of output. Cost, when reported, is USD. */
export type UsageCounts = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost?: number;
};

/** Running session totals and the latest turn/step. Counts are absent until the harness reports them. */
export type SessionUsage = {
  total?: UsageCounts;
  last?: UsageCounts;
  model?: string;
  /** Codex's original token report, including its context window. */
  tokens?: Record<string, unknown>;
  rateLimits?: Record<string, unknown>;
  rateLimitsByLimitId?: Record<string, unknown>;
  rateLimitsAt?: string;
};

/** Complete workbench row. `key` is stable across rename; unknown identities use the name. */
export type SessionRow = Omit<Partial<HarnessProcessView>, 'harness' | 'status' | 'holds'> & {
  key: string;
  name: string;
  sessionId: string;
  role: string | null;
  label: string;
  cwd: string;
  harness: string | null;
  status: HarnessProcessView['status'] | 'connected';
  state: SessionState;
  /** Transition timestamp, so age advances without timer-only deltas. Null means unknown. */
  stateSince: string | null;
  launched: boolean;
  live: boolean;
  presence: Presence | null;
  holds: SessionHold[];
  item: string | null;
  itemKind: SessionHold['role'] | null;
  itemRequested: boolean;
  additionalHolds: number;
};

/** A row of the hub's process table as clients see it. */
export type HarnessProcessView = {
  account?: string | null;
  stateReason?: string;
  /** Warning from an explicit recovery launch; absent from stored rows. */
  warning?: string;
  layer?: Layer;
  name: string;
  harness: string;
  role: string | null;
  /** `name [Role]`. */
  label?: string;
  model: string | null;
  cwd: string;
  /** The Lead’s epic or release, or the item whose task worktree the session was launched in (`session.launch` with an item), else null. */
  item: string | null;
  /** Live claims and verifier holds, independent of the launch directory's item. */
  holds?: SessionHold[];
  pending?: PendingVerification;
  pid: number | null;
  /** The harness's own handle for the session (Claude Code: the background session id). */
  harnessId: string | null;
  /** The harness's conversation id (Claude Code: the session UUID); also the spoke's `CLAND_SESSION_ID`. */
  sessionId: string;
  /** The harness's own conversation id, where it differs from `sessionId` (Claude Code's background sessions pick their own). */
  harnessSessionId: string | null;
  startedAt: string;
  stoppedAt?: string | null;
  archived?: boolean;
  archivedAt?: string | null;
  archivedBy?: 'hand' | 'rule' | null;
  /** `running`, `exited` (the process died on its own), `stopped` (through cland). */
  status: 'running' | 'exited' | 'stopped';
  state: SessionState;
  attach: string | null;
  /** Pending approval command line, or just the tool name; never the tool input body. */
  approvalCommand?: string;
  /** Session totals and latest turn/step, where its adapter has the capability. */
  usage?: SessionUsage;
};

export function isClientHello(f: Record<string, unknown>): f is ClientHello {
  return f.type === 'hello' && typeof f.protocol === 'number' && (f.secret === undefined || typeof f.secret === 'string') && typeof f.client === 'string' && (f.features === undefined || Array.isArray(f.features) && f.features.every(feature => typeof feature === 'string')) && (f.resume === undefined || isObject(f.resume) && typeof f.resume.epoch === 'string' && Number.isSafeInteger(f.resume.seq) && Number(f.resume.seq) >= 0);
}

export function isClientRequest(f: Record<string, unknown>): f is ClientRequest {
  if (typeof f.id !== 'string') return false;
  switch (f.type) {
    case 'resume':
      return typeof f.epoch === 'string' && Number.isSafeInteger(f.seq) && Number(f.seq) >= 0;
    case 'demo.start':
      return typeof f.epic === 'string' && (f.commit === undefined || typeof f.commit === 'string');
    case 'demo.exec':
      return typeof f.epic === 'string' && Array.isArray(f.command) && f.command.length > 0 && f.command.every(c => typeof c === 'string' && !c.includes('\0'));
    case 'demo.stop':
    case 'demo.status':
      return typeof f.epic === 'string' && (f.commit === undefined || typeof f.commit === 'string');
    case 'visibility.set':
      return typeof f.surface === 'string' && ['topics', 'sessions', 'artifacts'].includes(f.surface) && typeof f.target === 'string' && f.target.length > 0 && (f.mode === 'pin' || f.mode === 'mute');
    case 'suite.slot':
      if (f.check !== undefined && f.check !== true) return false;
      if (f.check === true) {
        const lease = f.lease as Record<string, unknown> | undefined;
        return lease === undefined || typeof lease === 'object' && lease !== null && Object.hasOwn(lease, 'pid') && Number.isSafeInteger(lease.pid) && Number(lease.pid) > 0 && Object.hasOwn(lease, 'started') && typeof lease.started === 'string' && Object.hasOwn(lease, 'token') && typeof lease.token === 'string' && lease.token.length > 0;
      }
      // Normal package runners reserve their existing human slot.
    case 'suite.forced':
      return ['full', 'hub-only', 'hub-selected', 'nvim-only', 'web-only'].includes(String(f.mode)) && typeof f.cwd === 'string' && typeof f.head === 'string' && Number.isSafeInteger(f.pid) && Number(f.pid) > 0 && typeof f.token === 'string' && f.token.length > 0;
    case 'suite.start':
      return suiteStartIssues(f).length === 0;
    case 'suite.cancel':
      return f.suite === undefined || (typeof f.suite === 'string' && f.suite.trim().length > 0);
    case 'suite.classify':
      return typeof f.suite === 'string' && f.suite.trim().length > 0 && f.cause === 'load-flake' && typeof f.note === 'string' && f.note.trim().length > 0;
    case 'models.list':
      return ['claude-code', 'codex', 'opencode'].includes(String(f.harness)) && (f.account === undefined || typeof f.account === 'string' && f.account.length > 0) && (f.refresh === undefined || typeof f.refresh === 'boolean');
    case 'account.clear':
      return typeof f.account === 'string' && f.account.length > 0;
    case 'account.poll':
    case 'account.list':
    case 'suite.queue':
      return true;
    case 'push':
    case 'sync':
      return true;
    case 'publish':
      return typeof f.branch === 'string' && typeof f.item === 'string' && (f.dryRun === undefined || typeof f.dryRun === 'boolean');
    case 'release':
      return (f.version === undefined || typeof f.version === 'string') && (f.item === undefined || typeof f.item === 'string') && (f.dryRun === undefined || typeof f.dryRun === 'boolean');
    case 'merge.queue':
      return true;
    case 'merge':
      return typeof f.item === 'string' && (f.override === undefined || typeof f.override === 'string') && (f.cancel === undefined || typeof f.cancel === 'boolean');
    case 'artifact.url':
    case 'artifact.delete':
      return typeof f.artifact === 'string' && /^A-[1-9][0-9]*$/.test(f.artifact);
    case 'artifact.list':
      return (f.before === undefined || typeof f.before === 'string') && (f.topic === undefined || typeof f.topic === 'string') && (f.artifact === undefined || typeof f.artifact === 'string');
    case 'artifact.create':
    case 'artifact.keep':
    case 'artifact.archive':
    case 'artifact.move':
    case 'prompt.send':
    case 'artifact.promote':
      return true;
    case 'rule.add':
      return typeof f.text === 'string' && typeof f.scope === 'string' && typeof f.reason === 'string' && (f.title === undefined || typeof f.title === 'string');
    case 'rule.edit':
      return Number.isSafeInteger(f.number) && Number(f.number) > 0 && ['title', 'text', 'scope', 'reason'].every(key => f[key] === undefined || typeof f[key] === 'string');
    case 'rule.retire':
      return Number.isSafeInteger(f.number) && Number(f.number) > 0 && typeof f.reason === 'string';
    case 'rule.show':
      return Number.isSafeInteger(f.number) && Number(f.number) > 0;
    case 'rule.list':
      return (f.all === undefined || typeof f.all === 'boolean') && (f.role === undefined || typeof f.role === 'string');
    case 'config.set':
    case 'crew.set':
      return typeof f.key === 'string' && f.value !== undefined;
    case 'web.revoke':
      return typeof f.session === 'string' && f.session.length > 0;
    case 'task.migrate':
      return f.dryRun === true;
    case 'crew.show':
    case 'executor.status':
    case 'executor.reap':
    case 'hub.subscriptions':
    case 'hub.status':
      return (f.history === undefined || typeof f.history === 'boolean') && (f.flushLogs === undefined || typeof f.flushLogs === 'boolean');
    case 'web.link':
      return f.qr === undefined || typeof f.qr === 'boolean';
    case 'web.sessions':
    case 'hub.stop':
    case 'hub.reload':
    case 'topic.list':
    case 'role.list':
      return true;
    case 'executor.prepare':
      return f.report === undefined || typeof f.report === 'string';
    case 'executor.retire-legacy':
      return typeof f.confirmRegisteredHubs === 'boolean';
    case 'inbox.list':
      return f.archive === undefined || typeof f.archive === 'boolean';
    case 'inbox.decline':
      return typeof f.request === 'string';
    case 'inbox.read':
      return typeof f.message === 'string';
    case 'subscribe':
      return isEventsFilter(f.filter);
    case 'events.list':
      return (f.before === undefined || (typeof f.before === 'string' && (/^(0|[1-9]\d*)$/.test(f.before) && Number.isSafeInteger(Number(f.before)) || /^events:[A-Za-z0-9_-]+$/.test(f.before)))) && (f.limit === undefined || (typeof f.limit === 'number' && Number.isInteger(f.limit) && f.limit > 0)) && isEventsFilter(f.filter);
    case 'worktree.list':
      return true;
    case 'worktree.prune':
      return (f.items === undefined || (Array.isArray(f.items) && f.items.every((i) => typeof i === 'string'))) && (f.dryRun === undefined || typeof f.dryRun === 'boolean');
    case 'topic.answer':
      return typeof f.ask === 'string' && (f.option === undefined || typeof f.option === 'number') && (f.text === undefined || typeof f.text === 'string') && (f.as === undefined || isObject(f.as) && typeof f.as.name === 'string' && (f.as.sessionId === undefined || typeof f.as.sessionId === 'string') && (f.as.shell === undefined || typeof f.as.shell === 'boolean'));
    case 'role.launch':
      return typeof f.role === 'string' && isObject(f.fields) && Object.values(f.fields).every(value => typeof value === 'string');
    case 'role.set':
      return typeof f.session === 'string' && typeof f.role === 'string' && (f.note === undefined || typeof f.note === 'string' || isObject(f.note)) && (f.move === undefined || typeof f.move === 'boolean') && (f.item === undefined || typeof f.item === 'string');
    case 'role.state':
      return typeof f.role === 'string' && (f.session === undefined || typeof f.session === 'string');
    case 'role.clear':
      return typeof f.session === 'string';
    case 'topic.history':
      return typeof f.topic === 'string' && (f.limit === undefined || typeof f.limit === 'number') && (f.before === undefined || typeof f.before === 'string' || isMessageSeq(f.before)) && (f.after === undefined || isMessageSeq(f.after)) && (f.before === undefined || f.after === undefined) && isAgentsHistoryFilter(f);
    case 'topic.send':
      return (
        typeof f.topic === 'string' &&
        typeof f.text === 'string' &&
        (f.to === undefined || (Array.isArray(f.to) && f.to.every((t) => typeof t === 'string'))) &&
        (f.replyTo === undefined || typeof f.replyTo === 'string')
      );
    case 'hygiene.unmute':
      return typeof f.a === 'string' && typeof f.b === 'string';
    case 'topic.rename':
      return typeof f.topic === 'string' && typeof f.title === 'string';
    case 'topic.delete':
    case 'topic.close':
    case 'topic.resolve':
      return typeof f.topic === 'string';
    case 'topic.create':
      return typeof f.title === 'string' && (f.item === undefined || typeof f.item === 'string');
    case 'marks.get':
      return true;
    case 'marks.set':
      return (f.events === undefined || typeof f.events === 'string' && Number.isFinite(Date.parse(f.events)))
        && (f.plans === undefined || isObject(f.plans) && Object.values(f.plans).every(v => typeof v === 'string'))
        && (f.import === undefined || typeof f.import === 'boolean');
    case 'topic.read':
      return typeof f.topic === 'string' && (f.upTo === undefined || typeof f.upTo === 'string');
    default:
      return false;
  }
}

function isAgentsHistoryFilter(f: Record<string, unknown>): boolean {
  return (f.item === undefined || typeof f.item === 'string') && (f.session === undefined || typeof f.session === 'string');
}

/** Message sequences are exact, non-negative JSON integers; zero starts a forward traversal. */
function isMessageSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
