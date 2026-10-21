// Browser-safe wire shapes, restated from the hub at the T-979 expand step.
// No runtime behaviour or transport changes. Conformance lives in hub/test/wire-conformance.ts.
// Imports and re-exports must stay inside shared/wire/, including type-only references.
// Keep these independent declarations in step with their owners via the conformance check.
// ItemSummary and VerifyResult spell out selected fields to avoid importing backend types.

// hub/src/protocol.ts
export type FromKind = 'human' | 'agent' | 'hub';

// hub/src/protocol.ts
export type Via = 'session' | 'hub';

// hub/src/protocol.ts
export type SendKind = 'progress' | 'report' | 'question' | 'decision' | 'request';

// hub/src/protocol.ts
export type RequestKind = 'review' | 'qa' | 'handover';

// hub/src/protocol.ts
export type Outcome = 'delivered' | 'queued' | 'unknown' | 'refused' | 'empty';

// hub/src/protocol.ts
export type SubscriptionSubject = { session: string } | { item: string } | { topic: string } | { role: string } | { subtree: string };

// hub/src/protocol.ts
export type SubscriptionEvent = 'session.state' | 'task' | 'topic' | 'usage' | 'artifact';

// hub/src/protocol.ts
export type UsageThreshold = { cost: number } | { tokens: number };

// hub/src/protocol.ts
export type Subscription = { id: string; subject: SubscriptionSubject; events: SubscriptionEvent[]; digest: 'turn' | 'now'; threshold?: UsageThreshold; default?: true };

// hub/src/protocol.ts
export type SubscriptionRequest = (
  | { type: 'event.subscribe'; id: string; subject: SubscriptionSubject; events: SubscriptionEvent[]; digest?: 'turn' | 'now'; threshold?: UsageThreshold }
  | { type: 'event.unsubscribe'; id: string; subscription: string }
  | { type: 'event.subscriptions'; id: string }
) & { as?: { name: string; sessionId?: string; shell?: boolean } };

// hub/src/protocol.ts
export type SessionHold = { item: string; role: 'item' | 'review' | 'qa'; heldAt?: string };

// hub/src/protocol.ts
export type PendingVerification = { item: string; kind: 'review' | 'qa' };

// hub/src/protocol.ts
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

// hub/src/hub/visibility.ts
export type Layer = 'now' | 'watch' | 'background' | 'archive';

// hub/src/protocol.ts
export type SessionState = 'idle' | 'busy' | 'waiting for human' | 'waiting for approval' | 'unknown';

// hub/src/protocol.ts
export type ArtifactKind = 'prompt' | 'note' | 'page' | 'diagram' | 'file';

// hub/src/protocol.ts
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

// hub/src/protocol.ts
export type ArtifactCreate = { type: 'artifact.create'; id: string; kind: string; title: string; topic: string; path?: string; content?: string; folder?: boolean; entry?: string; status?: 'draft' | 'shared' };

// hub/src/protocol.ts
export type PromptSend = { type: 'prompt.send'; id: string; artifact: string; attach?: boolean };

// hub/src/protocol.ts
export type ArtifactPromote = { type: 'artifact.promote'; id: string; artifact: string; path: string };

// hub/src/protocol.ts
export type ArtifactList = { type: 'artifact.list'; id: string; topic?: string; artifact?: string; before?: string };

// hub/src/protocol.ts
export type ArtifactKeep = { type: 'artifact.keep'; id: string; artifact: string; kept?: boolean };

// hub/src/protocol.ts
export type ArtifactDelete = { type: 'artifact.delete'; id: string; artifact: string };

// hub/src/protocol.ts
export type ArtifactArchive = { type: 'artifact.archive'; id: string; artifact: string };

// hub/src/protocol.ts
export type ArtifactMove = { type: 'artifact.move'; id: string; artifact: string; folder: string; name?: string };

// hub/src/protocol.ts
export type AgentsHistoryFilter = { item?: string; session?: string };

// hub/src/protocol.ts
export type MarkedCriterion = { id: string; mark: 'verified' | 'failed'; note?: string };

// hub/src/protocol.ts
export type AnswerAttribution = { answered_as: 'human' | 'stand-in'; answered_by?: string; relayed_by?: string };

// hub/src/protocol.ts
export type AskAnswer = AnswerAttribution & { ask: string; answer: string };

// hub/src/protocol.ts
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

// hub/src/protocol.ts
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
} & Partial<AnswerAttribution>;

// hub/src/protocol.ts
export type AskState = 'open' | 'answered' | 'withdrawn' | 'cancelled';

// hub/src/protocol.ts
export type HygieneRefusal = { code: 'hygiene'; rule: 'rate' | 'loop' | 'size'; until?: string };

// hub/src/protocol.ts
export type TopicStatus = 'open' | 'waiting for human' | 'waiting for agent' | 'closed';

// hub/src/protocol.ts
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
  unread: number;
  /** The latest message's time, or null for a topic with no message yet (listed last). */
  lastMessageAt: string | null;
  /** A message waits for a role nobody holds: `no coordinator` (or `no reviewer`, …); absent otherwise. */
  warning?: string;
  /** Parties that can currently settle an open ask, excluding forwarded parents. */
  waitingFor?: string[];
};

// hub/src/protocol.ts
export type TopicRef = { id: string; title: string; item?: string | null };

// hub/src/protocol.ts
export type DeliveryStage = 'queued' | 'delivered' | 'injected' | 'dropped';

// hub/src/protocol.ts
/** Exclusive numeric history cursors; string `before` preserves the Neovim message-id cursor. */
export type TopicHistoryFilter = AgentsHistoryFilter & { before?: number | string; after?: number };
export type TopicMessage = Message & { seq: number; topic: string; stage?: DeliveryStage; ask?: AskCard };

// hub/src/protocol.ts
export type InboxAsk = { layer?: Layer; id: string; topic: TopicRef; question: string; options: string[]; free: boolean; from: string; fromRole?: string; label: string; ts: string; since: string };

// hub/src/protocol.ts
export type InboxApproval = { layer?: Layer; id: string; session: string; role?: string; label: string; harness: string | null; since: string; attach: string | null; command?: string };

// hub/src/protocol.ts
export type InboxPlan = { layer?: Layer; id: string; subject: string; title: string; stages?: number; lanes?: number; items?: number; since: string };

// hub/src/protocol.ts
export type InboxRequest = { layer?: Layer; id: string; from: string; fromRole?: string; request: RequestKind; subject: string; topic: TopicRef; ts: string; since: string; text: string };

// hub/src/protocol.ts
export type InboxMessage = { layer?: Layer; severity?: 'warn'; id: string; from: string; fromRole?: string; subject: string; topic: TopicRef; ts: string; since: string; text: string };

// hub/src/protocol.ts
export type InboxRowKind = 'ask' | 'approval' | 'plan' | 'request' | 'message';

// hub/src/protocol.ts
export type InboxDeparture = { kind: InboxRowKind; id: string; subject: string; since: string; ts: string; text?: string; reason: 'answered' | 'withdrawn' | 'cancelled' | 'approved' | 'closed' | 'invalidated' | 'replied' | 'declined' | 'read' };

// hub/src/protocol.ts
export type NotificationKind = 'account-limited' | 'executor-fallback' | 'plan' | 'verdict' | 'role' | 'death' | 'idle' | 'delivery-stalled' | 'delivery-uncertain' | 'turn-failed' | 'release' | 'import';

// hub/src/protocol.ts
export type Inbox = { asks: InboxAsk[]; approvals: InboxApproval[]; plans: InboxPlan[]; requests: InboxRequest[]; messages: InboxMessage[]; waiting: Topic[]; needsYou: number; archiveToday?: number; archive?: InboxDeparture[] };

// hub/src/protocol.ts
export type EventKind = typeof EVENT_KINDS[number];

// hub/src/protocol.ts
export const EVENT_KINDS = ['session', 'task', 'verdict', 'suite', 'release', 'artifact', 'usage', 'topic', 'heartbeat', 'rule'] as const;

// hub/src/protocol.ts
export type EventSubject = { kind: 'item' | 'session' | 'topic' | 'artifact' | 'rule'; id: string };

// hub/src/protocol.ts
export type EventsFilter = { kinds?: EventKind[]; warnings?: boolean; subject?: EventSubject; muted?: EventSubject[] };

// hub/src/protocol.ts
export type EventRow = { count?: number; bookkeeping?: boolean; warning?: boolean; replaces?: string; firstTs?: string; id: string; ts: string; kind: EventKind; subject: EventSubject; text: string; glyph: string; item?: string; session?: string; topic?: string; artifact?: string; rule?: string };

// hub/src/protocol.ts
export type EventsPage = { rows: EventRow[]; before: string | null; more: boolean };

// hub/src/protocol.ts
export type HubEvent =
  | { type: 'event'; row: EventRow }
  | { type: 'verification.queue'; queue: VerificationQueue }
  | { type: 'visibility' }
  | { type: 'crew'; config: CrewConfig; summary: string }
  | { type: 'artifact'; artifact: Artifact }
  /** The connected sessions, replaced on a hello, last spoke leaving, rename, status or role change. */
  | { type: 'presence'; sessions: Presence[] }
  /** A process-table row changed: the same view as session.list, replaced by stable session id or name. */
  | { type: 'session.process'; process: HarnessProcessView; archived?: number }
  | { type: 'sessions.pruned'; sessionIds: string[]; archived: number }
  /** Failed launch supervision changed; no accepted process row is implied. */
  | { type: 'session.cleanup'; sessionId: string; state: 'pending stop' | 'settled' }
  /** Complete rulebook after a write or valid reload, for connected workbenches. */
  | { type: 'rules.changed'; rules: readonly Rule[] }
  /** Latest usage totals, coalesced per launch; old launches must never update a new row under the same name. */
  | { type: 'account'; account: AccountView }
  | { type: 'session.usage'; session: string; sessionId: string; usage: SessionUsage }
  /** A new message in a topic: the human's, an agent's. */
  | { type: 'message'; topic: TopicRef; message: TopicMessage }
  /** A message's stage changed. */
  | { type: 'delivery'; topic: string; message: string; stage: DeliveryStage }
  /** A session's state changed (spec 4.2), from its adapter: `source` names the signal (`hook`, `mod`, `poll`, `process`). */
  | { type: 'session.state'; layer?: Layer; session: string; sessionId: string; state: SessionState; source: string; ts: string; approvalCommand?: string }
  /** A session's role changed: assigned, moved, cleared (null), or vacated by its harness's death. */
  | { type: 'session.role'; session: string; role: string | null; previous: string | null; reason: string; ts: string }
  /** A topic changed: created, its status, its warning, its binding or the human's unread count. */
  | { type: 'topic'; topic: Topic }
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
  | { type: 'task'; id: string; item: ItemSummary | null; siblings?: string[]; layers?: Record<string, Layer> };

// hub/src/protocol.ts
export type VerificationQueue = {
  batch?: MergeBatchStatus | null;
  version: 1; at: string; holder: VerificationHolder | null; remote?: VerificationHolder[]; remoteBudget?: number; localFallback?: boolean; waiters: VerificationWaiter[];
  metrics: { window: number; count: number; wait: DurationStats; run: DurationStats; queueWait?: QueueWaitMetrics };
};

// hub/src/protocol.ts
export type MergeBatchStatus = { id: string; members: MergeQueueEntry[]; run?: string; candidate?: { tree: string }; failed?: string };

// hub/src/protocol.ts
export type MergeQueueEntry = { item: string; branch: string; head: string; verdictBase: string; enqueued: string; by: { id: string; name: string; role: string | null } };

// hub/src/protocol.ts
export type VerificationHolder = {
  occasion?: VerifyOccasion; shard?: string;
  executor?: 'local' | 'droplet'; machine?: { name: string; size: string; region: string };
  kind: 'run' | 'hand run'; id: string | null; session: string | null; item: string | null; mode: string | null;
  pid: number | null; worktree: string | null; since: string | null; runMs: number | null; etaMs: number | null;
};

// hub/src/protocol.ts
export type VerifyOccasion = typeof VERIFY_OCCASIONS[keyof typeof VERIFY_OCCASIONS];

// hub/src/protocol.ts
export const VERIFY_OCCASIONS = { batch: 'batch', stage: 'stage', epic: 'epic', release: 'release', soak: 'soak', 'dev-t3': 'dev-t3' } as const;

// hub/src/protocol.ts
export type VerificationWaiter = {
  waitingFor?: 'remote';
  occasion?: VerifyOccasion;
  kind?: 'run' | 'hand run';
  executor?: 'local' | 'droplet';
  id: string; session: string; item: string | null; mode: string; worktree: string;
  position: number; queuedAt: string | null; waitMs: number; etaMs: number | null; expectedRunMs: number | null;
};

// hub/src/protocol.ts
export type DurationStats = { count: number; medianMs: number | null; p90Ms: number | null };

// hub/src/protocol.ts
export type QueueWaitMetrics = {
  targetP90Ms: number;
  last24Hours: Record<'local' | 'droplet', QueueWaitStats>;
  last50Runs: Record<'local' | 'droplet', QueueWaitStats>;
};

// hub/src/protocol.ts
export type QueueWaitStats = { count: number; cacheHits: number; p50Ms: number | null; p90Ms: number | null };

// hub/src/crew.ts
export type CrewConfig = { leads: string[]; idle_from: string[]; idle_categories: IdleCategory[]; idle_ignored: Array<{ id: string; reason: string }>; crew: Record<string, CrewRole> };

// hub/src/crew.ts
export type IdleCategory = { id: string; title: string };

// hub/src/crew.ts
export type CrewRole = { policy: CrewPolicy; size: number | null; keep_context: boolean; stop_after: 'merge' | 'never'; subagents: boolean; heartbeat?: string; heartbeatDefault?: boolean };

// hub/src/crew.ts
export type CrewPolicy = 'per-item' | 'per-group' | 'pool' | 'singleton';

// hub/src/protocol.ts
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

// hub/src/protocol.ts
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

// hub/src/protocol.ts
export type UsageCounts = {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cost?: number;
};

// hub/src/rules/rulebook.ts
export type Rule = {
  number: number;
  title: string;
  scope: 'all' | string[];
  date: string;
  status: 'active' | 'retired';
  retired?: string;
  origin: string;
  retired_origin?: string;
  reason: string;
  text: string;
};

// hub/src/accounts/limits.ts
export type AccountView = Account & { limited?: AccountLimit; windows: LimitWindow[]; at: string | null; source: LimitSource | null; signedOut?: boolean };

// hub/src/accounts/registry.ts
export type Account = { name: string; harness: string; path: string | null; variable: string };

// hub/src/accounts/limits.ts
export type AccountLimit = { since: string; reason: string; session: string; resetsAt: string | null };

// hub/src/accounts/limits.ts
export type LimitWindow = { id: string; label: string; usedPercent: number; resetsAt: string; windowMins?: number; severity?: string; scope?: string };

// hub/src/accounts/limits.ts
export type LimitSource = { kind: 'session'; session: string } | { kind: 'poll' };

// hub/src/tracker/tracker.ts
export type ItemSummary = IndexedItem & { plan?: EpicPlan | null; planError?: string; approval?: { required: boolean; state: 'pending' | 'approved' | 'not required'; by?: string; at?: string }; open_blockers?: string[]; criteria: CriteriaCounts; verify?: VerifyResult | null; layer?: Layer; claim: Claim | null; holds: VerifierHold[]; verdicts: IndexedVerdict[]; verdictBase: string | null };

export type ExplorerSummary = Pick<ItemSummary, 'id' | 'kind' | 'title' | 'state' | 'status' | 'size' | 'labels' | 'parent' | 'blocked_by' | 'claim' | 'holds' | 'criteria' | 'updated' | 'closed' | 'version' | 'rank_set'> & {
  open_blockers: string[];
  rank?: number;
  verdicts: Array<Pick<IndexedVerdict, 'verdict' | 'result' | 'by' | 'run' | 'at' | 'scope' | 'current'> & { round: number }>;
};

// hub/src/tracker/index-db.ts
export type IndexedItem = {
  id: string;
  kind: Kind;
  version?: string;
  title: string;
  state: State;
  status?: Status;
  size?: Size;
  regression_of?: string;
  found_by?: FoundBy;
  rank: number;
  rank_set?: true;
  labels: string[];
  assignee: string | null;
  parent: string | null;
  blocked_by: string[];
  follows?: string[];
  topic: string | null;
  branch: string | null;
  created: string;
  updated: string;
  closed?: string;
  file: string;
};

// hub/src/tracker/item.ts
export type Kind = string & {};

// hub/src/tracker/item.ts
export type State = (typeof STATES)[number];

// hub/src/tracker/item.ts
export const STATES = ['open', 'closed'] as const;

// hub/src/tracker/item.ts
export type Status = (typeof STATUSES)[number];

// hub/src/tracker/item.ts
export const STATUSES = ['backlog', 'planned', 'in progress', 'review', 'qa', 'ready', 'done'] as const;

// hub/src/tracker/item.ts
export type Size = (typeof SIZES)[number];

// hub/src/tracker/item.ts
export const SIZES = ['XS', 'S', 'M', 'L', 'XL'] as const;

// hub/src/tracker/item.ts
export type FoundBy = (typeof FOUND_BY)[number];

// hub/src/tracker/item.ts
export const FOUND_BY = ['review', 'cover', 'droplet', 'qa', 'human'] as const;

// hub/src/tracker/plan.ts
export type EpicPlan = {
  stages: Array<{ name: string; qa: QaPolicy; lanes: string[][] }>;
  items?: Record<string, { qa?: QaPolicy; qa_criteria?: string[] }>;
};

// hub/src/tracker/plan.ts
export type QaPolicy = { scope: 'none' | 'affected' | 'full'; when: 'per-item' | 'after-stage' };

// hub/src/tracker/criteria.ts
export type CriteriaCounts = { total: number; done: number; verified: number; stale: number; failed: number };

// hub/src/hub/suites.ts
export type VerifyResult = { webPhase?: { status: 'not-run'; reason: string }; executor: ExecutorKind; id: string; state: 'queued' | 'launching' | 'running' | 'finished'; result: 'passed' | 'failed' | 'cancelled' | null; head: string; finished: string | null; artifact: string | null; cached?: { run: string; head: string; tree: string; occasion?: VerifyOccasion | null; executor?: ExecutorKind } | undefined };

// hub/src/executor/executor.ts
export type ExecutorKind = 'local' | 'droplet';

// hub/src/tracker/index-db.ts
export type Claim = { session: string; sessionId: string; role: string | null; claimedAt: string };

// hub/src/tracker/index-db.ts
export type VerifierHold = { session: string; sessionId: string; role: 'reviewer' | 'qa'; heldAt: string };

// hub/src/tracker/index-db.ts
export type IndexedVerdict = Verdict & { author: string; at: string; source: 'hub' | 'file'; writer?: { sessionId: string; role: string | null }; current?: boolean };

// hub/src/tracker/item.ts
export type Verdict = { verdict: VerdictKind; result: VerdictResult; by: string; run: string; commit?: string; scope?: ReviewScope; stage?: string; stage_hash?: string; findings?: Finding[]; findingCounts?: FindingCounts };

// hub/src/tracker/item.ts
export type VerdictKind = (typeof VERDICT_KINDS)[number];

// hub/src/tracker/item.ts
export const VERDICT_KINDS = ['review', 'qa'] as const;

// hub/src/tracker/item.ts
export type VerdictResult = (typeof RESULTS)[number];

// hub/src/tracker/item.ts
export const RESULTS = ['clear', 'not clear'] as const;

// hub/src/tracker/item.ts
export type ReviewScope = (typeof REVIEW_SCOPES)[number];

// hub/src/tracker/item.ts
export const REVIEW_SCOPES = ['full', 'delta', 'evidence'] as const;

// hub/src/tracker/findings.ts
export type Finding = { severity: Severity; text: string; file?: string; line?: number };

// hub/src/tracker/findings.ts
export type Severity = (typeof SEVERITIES)[number];

// hub/src/tracker/findings.ts
export const SEVERITIES = ['high', 'medium', 'low'] as const;

// hub/src/tracker/findings.ts
export type FindingCounts = Record<Severity, number>;

// hub/src/protocol.ts
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

// hub/src/protocol.ts
export type HandoverNote = { goals_now: string; work_in_flight: string; open_decisions: string; waiting_on: string };

// hub/src/protocol.ts
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

// hub/src/protocol.ts
export type RoleHolder = { name: string; role: string | null; label: string; live: boolean };

// hub/src/protocol.ts
export type ReleaseRequest = { type: 'release'; id: string; version?: string; item?: string; dryRun?: boolean };

// hub/src/protocol.ts
export type BatchSuite = { id: string; members: MergeQueueEntry[]; diagnostic?: { key: string; files: string[] } };

// hub/src/protocol.ts
export type MergeRequest = { type: 'merge'; id: string; item: string; override?: string; cancel?: boolean };

// hub/src/protocol.ts
export type MergeQueueRequest = { type: 'merge.queue'; id: string };

// hub/src/protocol.ts
export type RefusalCode = 'version' | 'unauthorized' | 'name-in-use' | 'bad-name' | 'bad-hello' | 'no-role';

// hub/src/protocol.ts
export type HubFrame =
  | { type: 'welcome'; name: string; presence: Presence[]; role?: string; features?: ClientFeature[] }
  | SnapshotFrame
  | SnapshotEnd
  | SnapshotRefused
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
  | { type: 'result'; id: string; ok: false; error: string; files?: string[]; recovery?: { commit: string; base: string }; account?: string; resetsAt?: string | null; code?: 'cli-neovim-only' | 'account-limited' | 'verify-all-reserved' | 'verify-tiers' | 'verify-test-lint' | 'verify-shards' | PushCode | PublishCode | ReleaseCode | MergeCode | 'forbidden' | 'note-incomplete' | 'invalid-cwd' | 'git-unavailable' | 'artifact-kind' | 'artifact-source' | 'artifact-topic' | 'artifact-title' | 'artifact-unavailable' | 'artifact-path' | 'artifact-busy'; permission?: string; role?: string | null; reason?: string; missing?: string[]; refusal?: HygieneRefusal }
  | { type: 'error'; code: RefusalCode; message: string }
  /** To a harness's in-session bridge (the Claude Code mod): submit this message as a turn, then confirm it (`session.signal` `injected`). */
  | { type: 'inject'; session: string; message: string; text: string }
  | HubEvent;

// hub/src/territory-push.ts
export type PushCode = 'push-territory' | 'push-state' | 'push-behind' | 'push-changed' | 'push-git' | 'push-outcome-unknown';

// hub/src/territory-publish.ts
export type PublishCode = 'publish-state' | 'publish-path' | 'publish-empty' | 'publish-changed' | 'publish-behind' | 'publish-git';

// hub/src/release.ts
export type ReleaseCode = 'release-item' | 'release-version' | 'release-tag' | 'release-empty' | 'release-github' | 'release-behind'
  | 'release-t3' | 'release-state' | 'release-territory' | 'release-changed' | 'sync-dirty' | 'sync-conflict' | 'sync-behind' | 'sync-recovery';

// hub/src/merge.ts
export type MergeCode = 'merge-bare' | 'merge-git' | 'merge-item' | 'merge-branch' | 'merge-territory' | 'merge-base' | 'merge-unpublished' | 'merge-checkout'
  | 'review-missing' | 'review-provenance' | 'review-role' | 'review-claimant' | 'review-not-clear' | 'review-stale' | 'review-pending'
  | 'qa-missing' | 'qa-provenance' | 'qa-role' | 'qa-claimant' | 'qa-not-clear' | 'qa-stale' | 'qa-pending'
  | 'merge-hold' | 'merge-budget' | 'merge-test-lint' | 'merge-tiers' | 'merge-shards' | 'merge-override-scope' | 'merge-conflict' | 'merge-dirty' | 'merge-changed' | 'merge-recovery' | 'verdict-missing' | 'criteria-incomplete';

// hub/src/protocol.ts
export type SendOutcome = { to: string; outcome: Outcome; reason?: string; refusal?: HygieneRefusal; resolvedTo?: string };

// hub/src/protocol.ts
/** Negotiated independently; unknown features are ignored. */
export type ClientFeature = 'snapshot' | 'numbered-deltas' | 'slim-frames';

/** Null removes the layer of a deleted item. Other entries replace just that layer. */
export type SlimTaskFrame = Omit<Extract<HubEvent, { type: 'task' }>, 'layers'> & { layers: Record<string, Layer | null> };
/** Re-project existing rows by their stable ids; this is not an append or an invalidation. */
export type VisibilityFrame = { type: 'visibility'; rows: { topics: Topic[]; sessions: Presence[]; processes: HarnessProcessView[]; messages: TopicMessage[]; artifacts: Artifact[] } };
export type ModelEvent = HubEvent | SlimTaskFrame | VisibilityFrame;
export type ModelDelta = ModelEvent & { epoch: string; seq: number };
export const SNAPSHOT_LIMITS = {
  tracker: 64 * 1024, items: 1024 * 1024, sessions: 1024 * 1024,
  topics: 1024 * 1024, inbox: 1024 * 1024, events: 1024 * 1024,
  accounts: 256 * 1024,
} as const;
export type SnapshotValues = {
  tracker: { levels: string[]; ladder: string[][]; prefixes: Record<string, string> };
  items: { items: ExplorerSummary[] };
  sessions: { processes: HarnessProcessView[]; presence: Presence[]; archived: number; roles: RoleList; crew: { config: CrewConfig; summary: string }; coordinator: string | null; verification: VerificationQueue | null };
  topics: { topics: Topic[] };
  inbox: Inbox & { needsYou: number };
  events: EventsPage;
  accounts: Omit<{ registry: string; error?: string; accounts: Account[] }, 'accounts'> & { accounts: AccountView[] };
};
export type SnapshotDomain = keyof SnapshotValues;
export type SnapshotFrame = { [D in SnapshotDomain]: { type: 'snapshot'; epoch: string; seq: number; domain: D; value: SnapshotValues[D] } }[SnapshotDomain];
export type SnapshotEnd = { type: 'snapshot.end'; epoch: string; seq: number };
export type SnapshotRefused = { type: 'snapshot.refused'; code: 'frame-too-large'; domain: SnapshotDomain; bytes: number; limit: number } | { type: 'snapshot.refused'; code: 'unavailable'; message: string };

export type ClientHello = {
  type: 'hello';
  protocol: number;
  /** The project's secret, from `.cland/secret` or `hub.json`; not needed on an edge that authenticated the peer. */
  secret?: string;
  /** What is connecting: `cli`, `ui`. */
  client: string;
  features?: string[];
};

// hub/src/protocol.ts
export type SuiteStart = { type: 'suite.start'; dryRun?: boolean; diagnostics?: boolean; workers?: number; size?: string; occasion?: VerifyOccasion; id: string; mode: 'auto' | 'all' | 'hub' | 'nvim'; cwd: string; report?: string; to?: string[]; fresh?: boolean; executor?: ExecutorKind };

// hub/src/protocol.ts
export type SuiteSlot = { type: 'suite.slot' | 'suite.forced'; id: string; mode: string; cwd: string; head: string; pid: number; token: string };

// hub/src/protocol.ts
export type SuiteSlotCheck = { type: 'suite.slot'; id: string; check: true; lease?: { pid: number; started: string; token: string } };

// hub/src/protocol.ts
export type SuiteSlotResult = { id: string; admitted: boolean; locks: string[]; queue: VerificationQueue };

// hub/src/protocol.ts
export type SuiteCancel = { type: 'suite.cancel'; id: string; suite?: string };

// hub/src/protocol.ts
export type SuiteClassify = { type: 'suite.classify'; id: string; suite: string; cause: 'load-flake'; note: string };

// hub/src/protocol.ts
export type RuleRequest =
  | { type: 'rule.add'; id: string; text: string; scope: string; reason: string; title?: string; origin?: string | { topic: string; msg_id: string } }
  | { type: 'rule.edit'; id: string; origin?: string | { topic: string; msg_id: string }; number: number; title?: string; text?: string; scope?: string; reason?: string }
  | { type: 'rule.retire'; id: string; origin?: string | { topic: string; msg_id: string }; number: number; reason: string }
  | { type: 'rule.list'; id: string; all?: boolean; role?: string }
  | { type: 'rule.show'; id: string; number: number };

// hub/src/protocol.ts
export type DemoRequest =
  | { type: 'demo.start'; id: string; epic: string; commit?: string }
  | { type: 'demo.exec'; id: string; epic: string; command: string[] }
  | { type: 'demo.stop' | 'demo.status'; id: string; epic: string; commit?: string };

// hub/src/protocol.ts
export type ArtifactUrl = { type: 'artifact.url'; id: string; artifact: string };
export type ArtifactUrlResult = { url: string };
export type WebLink = { type: 'web.link'; id: string };
export type WebLinkResult = { url: string };
export type WebSessions = { type: 'web.sessions'; id: string };
export type WebRevoke = { type: 'web.revoke'; id: string; session: string };
export type WebSession = { id: string; createdAt: string; lastUsedAt: string; sockets: number };
export type WebSessionsResult = { sessions: WebSession[] };
export type WebRevokeResult = { revoked: string };

export type ClientRequest =
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
  /** From here on the hub pushes `message` and `delivery` events on this connection: `{ subscribed: true }`. */
  | { type: 'subscribe'; id: string }
  /** The human assigns a role to a session, live or not yet connected: `{ session: RoleHolder }`. */
  | { type: 'role.set'; id: string; session: string; role: string; note?: HandoverNote | string; move?: boolean; item?: string }
  /** A role's state, as its holder would pull it: `RoleState`. */
  | { type: 'role.state'; id: string; role: string; session?: string }
  /** The human revokes a session's role: `{ session: RoleHolder }`. */
  | { type: 'role.clear'; id: string; session: string }
  /** The roles, their definitions and holders: `RoleList`. */
  | { type: 'role.list'; id: string }
  | { type: 'role.launch'; id: string; role: string; fields: LaunchFields }
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

// hub/src/roles/launch.ts
export type LaunchFields = Partial<Record<typeof LAUNCH_FIELDS[number], string>>;

// hub/src/roles/launch.ts
export const LAUNCH_FIELDS = ['harness', 'model', 'effort', 'account', 'permissions'] as const;

// hub/src/protocol.ts
export type RoleLaunch = {
  harness: string;
  account: string | null;
  permissions: string | null;
  model: string | null;
  effort: string | null;
  approval: string | null;
  sandbox: { mode: string; writableRoots: string[]; network: string } | null;
};

// hub/src/protocol.ts
export type RoleList = {
  roles: Array<{ role: string; label: string; exclusive: boolean; skills: string[]; launch: RoleLaunch; warnings?: string[]; holders: RoleHolder[] }>;
  /** The live Coordinator's name, or null: "no coordinator". */
  coordinator: string | null;
};

// hub/src/protocol.ts
export type CoverCause = 'test-failure' | 'budget' | 'load-flake' | 'cancel-head' | 'cancel-requester' | 'timeout';

// hub/src/protocol.ts
export type CoverRecord = { status: 'green' | 'red' | 'cancelled'; cause: CoverCause | null; tests: string[];
  derivedCause?: CoverCause | null; classification?: { note: string; by: string; at: string } };

// hub/src/protocol.ts
export type CoverStatus = { id: string; head: string; branch: string; completedAt: string | null; cover: CoverRecord };

// hub/src/protocol.ts
export type SuiteStatus = {
  webPhase?: { status: 'not-run'; reason: string };
  devT3Probe?: { key: string; files: string[] };
  batch?: BatchSuite;
  cover?: CoverRecord;
  workers?: number; size?: string;
  occasion?: VerifyOccasion;
  executor: ExecutorKind;
  platform?: Platform;
  id: string; pid: number | null; topic: string; reported: boolean;
  outcome: { code: number; cause: string } | null; error: string | null;
  state?: 'queued' | 'launching' | 'running' | 'finished'; queued?: string | null;
  priority?: number | null; item?: string | null; head?: string; branch?: string; integrated?: boolean;
  selection?: SuiteSelection;
  tree?: string | null; finished?: string | null; cached?: { run: string; head: string; tree: string; occasion?: VerifyOccasion | null; executor?: ExecutorKind };
  admittedAt?: string | null; completedAt?: string | null; waitMs?: number | null; runMs?: number | null;
  timingEstimated?: boolean;
};

// hub/src/executor/executor.ts
export type Platform = { os: string; arch: string; release: string; node: string; nvim: string };

// hub/src/suite-selection.ts
export type SuiteSelection = { web?: 'all' | 'smoke' | 'none'; tiers?: Array<'T1' | 'T2' | 'T3' | 'T4'>; mode: SuiteMode; files: string[]; reason: string; fallback?: string; loadGateKnownTests?: string[]; loadGateFiles?: string[]; loadGateTests?: string[]; loadGate?: boolean; soak?: boolean; loadGateBaseline?: { run: string | null; tests: string[] }; fetchedDev?: string; tests?: string[]; functions?: string[]; coverage?: { artifact: string; path: string; head: string }; nvimFull?: boolean; nvimTests?: string[]; recordCoverage?: CoverageRecording; shard?: { files: string[]; nvim: boolean } };

// hub/src/suite-selection.ts
export type SuiteMode = 'hub-only' | 'hub-selected' | 'nvim-only' | 'web-only' | 'full';

// hub/src/suite-coverage.ts
export type CoverageRecording = { head: string; tree: string; run: string };

// hub/src/protocol.ts
export type WebEdgeStatus = { port: number; available: boolean; reason?: string };

/** Latest completed result per suite kind/occasion; full receipts remain opt-in. */
export type SuiteSummary = {
  id: string; kind: 'task' | 'integrated'; occasion: VerifyOccasion | null;
  head: string; exit: number | null; finishedAt: string | null; artifact: string | null;
};

export type HubStatus = {
  /** The independent browser listener; absent on older or stdio-only hubs. */
  web?: WebEdgeStatus;
  /** Scheduling priority observed at hub startup. Absent on older hubs. */
  priority?: HubPriority;
  mergeQueue?: MergeQueueEntry[];
  covers?: CoverStatus[];
  verification?: VerificationQueue;
  /** Queued/running suites; history:true explicitly includes completed receipts. */
  suites?: SuiteStatus[];
  recentSuites?: SuiteSummary[];
  crew?: { config: CrewConfig; summary: string };
  /** Keyboard layouts from config.toml, read at hub start; the UI uses these for langmap. */
  keys?: { layouts: string[] };
  /** Flat first-kind levels for older clients; ladder carries every peer kind, ordered top-down. */
  tracker?: { levels: string[]; ladder?: string[][]; prefixes?: Record<string, string>; storage?: TrackerStorageStatus };
  pid: number;
  port: number;
  socket: string;
  version: string;
  root: string;
  startedAt: string;
  config?: ConfigStatus;
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

// hub/src/hub/priority.ts
export type HubPriority = {
  /** Startup niceness; null when the OS probe is unavailable. */
  nice: number | null;
  warning?: { detail: string; fix: string };
};

// hub/src/tracker/tracker.ts
export type TrackerStorageStatus = {
  stalled: boolean;
  active: (StorageOperation & { elapsedMs: number }) | null;
  queued: number;
  abandoned: StorageOperation[];
};

// hub/src/tracker/tracker.ts
export type StorageOperation = { operation: string; item: string | null; startedAt: string | null };

// hub/src/hub/configuration.ts
export type ConfigStatus = { loadedAt: string; sourceCommit: string | null };

// hub/src/adapters/requests.ts
export type SessionRequest =
  | { type: 'session.launch'; id: string; name: string; role?: string; model?: string; harness?: string; account?: string; cwd?: string; effort?: string; item?: string; brief?: string }
  | { type: 'session.list'; id: string; archived?: boolean }
  | { type: 'session.attach'; id: string; session: string }
  | { type: 'session.archive'; id: string; session: string }
  | { type: 'session.prune'; id: string; olderThan: string; dryRun?: boolean }
  | { type: 'session.stop'; id: string; session: string }
  | { type: 'session.resume'; id: string; session: string; relaunch?: boolean; fresh?: boolean }
  | { type: 'session.retry'; id: string; session: string; message: string }
  | { type: 'session.signal'; id: string; session?: string; sessionId?: string; launch?: string; event: string; at?: number; payload?: Record<string, unknown> }
  | { type: 'session.bridge'; id: string; session: string; launch?: string };

// hub/src/tracker/requests.ts
export type TaskRequest =
  | {
      type: 'task.create';
      id: string;
      title: string;
      kind?: Kind;
      size?: Size;
      version?: string;
      body?: string;
      labels?: string[];
      assignee?: string | null;
      parent?: string | null;
      blocked_by?: string[];
      follows?: string[];
      regression_of?: string;
      found_by?: FoundBy;
      topic?: string | null;
      branch?: string | null;
      as?: ActorField;
    }
  | { type: 'task.plan'; id: string; item?: string; op: 'set' | 'show' | 'migrate' | 'approve'; yaml?: string; reason?: string; allow_large?: Record<string, string>; as?: ActorField }
  | { type: 'task.view'; id: string; item: string; as?: ActorField }
  | { type: 'task.list'; id: string; projection?: 'summary'; under?: string; state?: State; labels?: string[]; kind?: Kind; assignee?: string; verdict?: string; as?: ActorField }
  | { type: 'task.criterion'; id: string; item: string; op: string; criterion?: string; text?: string; note?: string; run?: string; as?: ActorField }
  | { type: 'task.comment'; id: string; item: string; text: string; verdict?: VerdictInput; as?: ActorField }
  | {
      type: 'task.edit';
      found_by?: FoundBy | null;
      status?: Status;
      version?: string | null;
      id: string;
      item: string;
      title?: string;
      body?: string;
      kind?: Kind;
      size?: Size;
      state?: State;
      labels?: string[];
      add_labels?: string[];
      remove_labels?: string[];
      assignee?: string | null;
      as?: ActorField;
    }
  | { type: 'task.close'; id: string; item: string; comment?: string; override?: string; as?: ActorField }
  | { type: 'task.link'; id: string; item: string; parent?: string | null; regression_of?: string | null; blocked_by?: string[]; unblock?: string[]; follows?: string[]; unfollow?: string[]; topic?: string | null; branch?: string | null; as?: ActorField }
  | { type: 'task.hold'; id: string; item: string; release?: boolean; as?: ActorField }
  | { type: 'task.rank'; id: string; item: string; top?: boolean; before?: string; after?: string; as?: ActorField }
  | { type: 'task.claim'; id: string; item: string; release?: boolean; force?: boolean; as?: ActorField }
  | (ImportRequest & { as?: ActorField });

// hub/src/tracker/requests.ts
export type ActorField = { name: string; role?: string | null; sessionId?: string; shell?: boolean };

// hub/src/tracker/tracker.ts
export type VerdictInput = { verdict: VerdictKind; result: VerdictResult; run: string; commit?: string; scope?: ReviewScope; stage?: string; verified?: string; failed?: { criterion: string; note: string }[]; findings?: Finding[] };

// hub/src/tracker/import-github.ts
export type ImportRequest = { type: 'task.import'; id: string; repo: string; issues: ImportedIssue[] };

// hub/src/tracker/import-github.ts
export type ImportedIssue = {
  number: number;
  url: string;
  title: string;
  body: string;
  labels: string[];
  state: 'open' | 'closed';
  assignee: string | null;
  parent: IssueRef | null;
  blocked_by: IssueRef[];
  comments: ImportedComment[];
  created: string;
};

// hub/src/tracker/import-github.ts
export type IssueRef = { repo: string; number: number };

// hub/src/tracker/import-github.ts
export type ImportedComment = { id: number; author: string; at: string; body: string };

// hub/src/accounts/limits.ts
export type AccountList = Omit<Accounts, 'accounts'> & { accounts: AccountView[] };

// hub/src/accounts/registry.ts
export type Accounts = { registry: string; error?: string; accounts: Account[] };

/** Requests accepted from a workbench, including the separately dispatched item and session families. */
export type WorkbenchRequest = ClientRequest | SessionRequest | TaskRequest;
/** Client-facing reply envelopes; the result value remains unknown until the request is known. */
export type Welcome = Extract<HubFrame, { type: 'welcome' }>;
export type Result = Extract<HubFrame, { type: 'result' }>;
export type ErrorFrame = Extract<HubFrame, { type: 'error' }>;
export const PROTOCOL_VERSION = 2;
