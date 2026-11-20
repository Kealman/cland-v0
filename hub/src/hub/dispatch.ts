import { suiteInfrastructureCauses } from '../suite-infrastructure.ts';
import { requireCandidateOwnership } from '../batch-candidate-ownership.ts';
import { selectHostPool } from '../host/pools.ts';
import { which } from '../doctor/report.ts';
import {removeLogin} from '../host/login-remove.ts';
import { installLoginRelease } from '../host/login-release.ts';
import { addKeyLogin } from '../host/login-keys.ts';
import { projectTag } from '../executor/droplet/droplet.ts';
import { onHostSpendChange } from '../executor/droplet/spend.ts';
import { DigitalOceanHostProvider } from '../host/provider/digitalocean.ts';
import { HostProviderRegistry } from '../host/provider/registry.ts';
import { providerTokens } from '../host/provider-tokens.ts';
import { hostStatus, roleLoginReadiness } from '../host/status.ts';
import { PoolCreationNotAdmitted } from '../host/pool-runtime.ts';
import { createHost, listHosts, destroyHost } from '../host/provision-host.ts';
import { type LoginSignIn, type LoginAddInput } from '../host/login-signin.ts';
import {signInNotAdmitted} from '../host/agent/signin-types.ts';
import {LoginCardSignIn,type LoginCardSignInOptions} from '../host/login-card-signin.ts';
import {remoteInputId,sameRemoteIngress,type GatewayAnswerInput} from '../remote/ingress.ts';
import { LoginSnapshots, snapshotHostIdentity } from '../host/login-snapshots.ts';
import { preparePoolLogin } from '../host/login-add.ts';
import { preparePools } from '../host/provider/pool-image.ts';
import { hostWorktreeMatches } from '../host/task-worktrees.ts';
import { flushHostBranch } from '../host/flush.ts';
import { territoryPath, territoryGitAsync } from '../territory.ts';
import { tunnelStatuses } from '../transport/transport.ts';
import { hostAuthorityRefusal } from '../host/host-authority.ts';
import { HUMAN_USER_WRITES, localUserName } from './cli-user.ts';
import { localHost } from '../host/local.ts';
import { MergeLandingReports } from './merge-landing-reports.ts';
import { uploadArtifacts } from './artifact-upload.ts';
import { suiteAuthor } from './suite-author.ts';
import { dependencyInstallText } from '../dependency-install.ts';
import { ModelOutput } from './model-output.ts';
import { composeSnapshot, snapshotFrames } from './snapshot.ts';
import { userAuthorityRefusal, webAuthorityRefusal } from './web-authority.ts';
import { gatewayAuthorityRefusal, gatewayUserRefusal, gatewayInbox } from '../remote/authority.ts';
import { PublishError } from '../territory-publish.ts';
import { sendRecipients } from '../send-input.ts';
import { InvalidArgument, validateToolFrame } from '../tool-arguments.ts';
import { defaultConfig } from '../init/config.ts';
import { DevT3Search, nonTrackerChanges } from './dev-t3-search.ts';
import { DevT3Probes } from './dev-t3-probe.ts';
import { reportDevT3Search } from './dev-t3-report.ts';
import { devT3Result } from './dev-t3-result.ts';
import { readDurationAllowanceWarnings } from '../suite-durations.ts';
import { reportSoakQuarantine } from './soak-quarantine.ts';
import { suiteStartIssues } from '../protocol.ts';
import { taskWorktreePath } from '../territory.ts';
import { gitIn } from '../tracker/verdict-git.ts';
import { interruptionLines } from '../suite-progress.ts';
import type { DropletDependencies } from '../executor/droplet/dependencies.ts';
import type { ClockTimer } from './clock.ts';
import { authorizeVerifyMode, VerifyAllReserved } from '../verification-occasion.ts';
import { HarnessModels } from '../models.ts';
import { AccountLimited } from '../accounts/limits.ts';
import { prefixOf } from '../tracker/prefixes.ts';
import { Demos } from './demos.ts';
import { DropletExecutor } from '../executor/droplet/droplet.ts';
// The hub's frame dispatcher: one conversation per connection, transport-agnostic. A transport hands it
// raw frames and a peer to answer through (send a frame, close); the WebSocket edge, the Unix socket edge
// and the stdio edge share it, so the protocol lives in one place.
//
// A conversation is a spoke (its hello carries a session id) or a client — the UI, the CLI — (its hello
// names the client). A transport that authenticated the peer already (the WebSocket's bearer header) says
// so; otherwise the hello must carry the project's secret.
//
// Every spoke tool call passes the permission table here (spec 4.4, `roles/permissions.ts`), by the role the hub
// holds for the session at call time: a refused call is answered with a typed `forbidden` result and a hub notice
// in the Agents topic. Client calls carry human authority; the web edge checks its own explicit policy first.
// Every call, a spoke's or a client's, is audited (`audit.ts`).
import { isSubscriptionRequest, subscriptionInput } from '../subscriptions.ts';
import { createHash, randomUUID } from 'node:crypto';
import type { SubscriptionRequest } from '../protocol.ts';
import { Suites, releaseT3Cover, SuiteAdmissionError, suiteSummary, machineAccounting, type SuiteJob, type TestSlotWaiter, type SuiteSchedulerOptions } from './suites.ts';
import { machineHealthSummary } from '../executor/droplet/health.ts';
import { reportSharedDefects } from './shared-defects.ts';
import { quarantineResults, recordQuarantineResults, type QuarantineHistory } from '../suite-quarantine.ts';
import { describeSelection, selectPackageSuite } from '../suite-selection.ts';
import { isAbsolute, join, resolve } from 'node:path';
import { readFile, stat, mkdir, writeFile, rename } from 'node:fs/promises';
import { registerCoverageMap, parseCoverageMap } from '../suite-coverage.ts';
import { timingSafeEqual } from 'node:crypto';
import { AGENTS, COORDINATOR, GENERAL, UNKNOWN_SESSION, type Connection, type HubCore, type SpokeSocket, type LaunchIdentityProof, type TopicNotice } from './core.ts';
import { summarize, type AuditOutcome, type AuditRecord } from './audit.ts';
import { decide, toolAvailability, LEAD_ROOT_TOOLS, KNOWN_TOOLS, ToolForbidden, type ToolCall } from '../roles/permissions.ts';
import { crewSummary, parseIdleFrom, resolveCrewIdle } from '../crew.ts';
import type { RolesConfig } from '../roles/config.ts';
import { isCustomRole, withRole } from '../names.ts';
import {
  PROTOCOL_VERSION, VERIFY_OCCASIONS,
  UPDATE_HINT,
  isAck,
  isClientHello,
  isClientRequest,
  isHello,
  isSpokeRequest,
  requestValidationFailure,
  parseFrame,
  type HubFrame,
  type RemoteVia,
  type HubStatus,
  type Message,
  type RefusalCode,
  type RoleClause,
} from '../protocol.ts';
import type { LogFn } from '../log.ts';
import { HygieneError } from './hygiene.ts';
import { answerTask, isTaskRequest, sessionActor, type TaskRequest } from '../tracker/requests.ts';
import { readsAsVerdict, verdictOfText } from '../tracker/item.ts';
import type { Actor, ItemView, Tracker } from '../tracker/tracker.ts';
import { answerSession, isSessionRequest, SPOKE_SESSION_REQUESTS } from '../adapters/requests.ts';
import type { Sessions } from '../adapters/sessions.ts';
import { handOver, roleState, settleAllClaims, type HandoverContext } from '../roles/handover.ts';
import { verifierRequest } from './verifier-request.ts';
import { NoteIncomplete } from '../roles/note.ts';
import { ArtifactLifecycle, type ArtifactFiles } from './artifact-lifecycle.ts';
import { artifactEntry, folderFiles } from './artifact-folder.ts';
import { ArtifactError, createArtifact } from './artifacts.ts';
import type { ArtifactCreate, ArtifactList, ArtifactPromote, ArtifactKeep, ArtifactArchive, ArtifactMove } from '../protocol.ts';
import { MergeQueue } from './merge-queue.ts';
import { taskTierEvidence, type SuiteDryRun } from '../suite-tier-report.ts';
import { MergeBatches, BatchRefusal, BatchRebuild, batchNoticeId } from './merge-batches.ts';
import { prepareMergeBatch, checkoutMergeBatch, removeMergeBatch, batchRebuildReason } from './merge-batch-territory.ts';
import { TaskMerges, MergeCleanupIncomplete, type MergeCleanupStop } from './merge.ts';
import { Releases } from './releases.ts';
import { PushError } from '../territory-push.ts';
import { ReleaseError } from '../release.ts';
import { releasePermissionTool } from '../release-tools.ts';
import { MergeError } from '../merge.ts';
import { TaskWorktrees, type SessionCwd } from './worktrees.ts';
import type { AccountPoller } from '../accounts/poller.ts';
import { readAccounts } from '../accounts/registry.ts';
import { RequestGuard, type GuardOptions } from './budget.ts';

/** How a conversation answers: a frame to the peer, or the end of the connection. */
export type Peer = {
  /** Every frame uses this boundary, including shared model JSON and replay. */
  send: (frame: HubFrame, serialized?: string) => void;
  /** Bytes accepted by the transport but not yet flushed to its reader. */
  bufferedBytes?: () => number;
  /** End the connection. `code` is a WebSocket close code; a transport without codes ignores it. */
  close: (code: number, reason: string) => void;
  /** Whether frames from the peer still count: false once the connection is closing. */
  isOpen: () => boolean;
};

/** What only the process running the hub can answer: its facts, and stopping it. */
export type Control = {
  remoteMuteDefault?: () => boolean;
  remoteTest?: (messenger: RemoteVia, pairing: import('../remote/state.ts').Pairing | null) => Promise<void>;
  remoteStatus?: () => import('../protocol.ts').RemoteStatusResult;
  pairingApproved?: (messenger: RemoteVia, pairing: import('../remote/state.ts').Pairing) => void;
  pairingReplaced?: (messenger: RemoteVia, previous: import('../remote/state.ts').Pairing) => void;
  authMode?: (mode: 'users' | 'single', resumed: import('./budget.ts').Resumed) => Promise<unknown>;
  userAdd?: (name: string, displayName?: string) => unknown;
  userInvite?: (name: string) => unknown;
  userList?: (setup?: boolean) => unknown;
  webLink?: (qr?: boolean, userId?: string) => import('../protocol.ts').WebLinkResult;
  webSessions?: () => import('../protocol.ts').WebSessionsResult;
  webRevoke?: (id: string) => Promise<import('../protocol.ts').WebRevokeResult>;
  status: () => Omit<HubStatus, 'sessions'>;
  stop: () => void;
  reload?: (resumed?: import('./budget.ts').Resumed) => Promise<import('./configuration.ts').ConfigReloadResult>;
  setConfig?: (key: string, value: unknown, resumed: import('./budget.ts').Resumed, authorize: () => void) => Promise<import('./configuration.ts').ConfigSetResult>;
  switchExecutor?: (executor: 'local' | 'droplet', workers: number | undefined, resumed: import('./budget.ts').Resumed, authorize: () => void) => Promise<unknown>;
  setRoleLaunch?: (role: string, fields: import('../roles/launch.ts').LaunchFields, resumed: import('./budget.ts').Resumed, authorize: () => void) => Promise<import('../roles/launch.ts').RoleLaunchResult>;
  flushLogs?: () => Promise<void>;
};

export type Conversation = {
  /** Trusted gateway only: synchronous frame work; never accepts an async callback. */
  commitBatch?: (write: () => void) => void;
  /** One frame; only the in-process gateway supplies trusted messenger provenance. */
  receive: (raw: string, via?: RemoteVia, messageId?: string, bytes?: readonly Buffer[], userId?: string, answerInput?: GatewayAnswerInput) => void;
  /** Native gateway recovery only; not an action in the frame protocol. */
  messageReceipt?: (messageId: string, via?: import('../protocol.ts').RemoteVia) => import('../protocol.ts').TopicMessage | null;
  /** Join native upload writers and rollback after closing admission. */
  drainUploads: () => Promise<void>;
  /** The transport closed. */
  closed: () => void;
};

export type DispatcherOptions = {
  runLoginSignIn?:LoginCardSignInOptions['run'];
  prepareLogin?: typeof preparePoolLogin;
  createHost?: typeof createHost;
  registerHostSecrets?: (values:readonly string[])=>void;
  uploadOpen?: typeof import('node:fs/promises').open;
  uploadRedactor?: Pick<import('../remote/redact.ts').RemoteRedactor, 'containsSecret' | 'text'>;
  /** The project daemon admits provider recovery only after publishing serving. */
  deferExecutorRecovery?: boolean;
  publishRelease?: typeof import('../territory-release.ts').releaseGit;
  devT3Repository?: import('./dev-t3-probe.ts').ProbeRepository;
  batchRepository?: import('./merge-batch-territory.ts').BatchRepository;
  hasTerritory?: typeof import('../territory.ts').hasTerritory;
  territoryLock?: typeof import('../territory.ts').withTerritoryLockAsync;
  git?: import('../tracker/verdict-git.ts').Git;
  env?: NodeJS.ProcessEnv;
  journal?: import('./journal.ts').Journal;
  droplet?: DropletDependencies;
  verification?: SuiteSchedulerOptions;
  projectConfig?: () => import('../init/config.ts').ProjectConfig;
  core: HubCore;
  secret: string;
  control?: Control;
  /** How long a fresh connection may stay silent before its hello, ms. */
  helloTimeoutMs?: number;
  log?: LogFn;
  /** The project's tracker, answering the `task.*` requests; absent on a hub with no project. */
  tracker?: Tracker;
  /** The request budget and the repeat guard's timings (tests). */
  guard?: Omit<GuardOptions, 'log'>;
  requestGuard?: RequestGuard;
  /** Artifact file read port; defaults to async filesystem I/O. */
  readArtifact?: (path: string) => Promise<Buffer>;
  /** Package selection port for reserved-mode refusal guidance. */
  selectSuite?: typeof selectPackageSuite;
  artifactFiles?: ArtifactFiles;
};

/** Who the UI's and the CLI's calls are audited as. */
const HUMAN_SESSION = 'human';

/**
 * What a CLI call made as a session may send beside the permission table's tools: reading the hub's state. Any
 * other frame is the human's alone.
 */
const SESSION_CLI_FRAMES: ReadonlySet<string> = new Set(['auth.mode', 'auth.reset', 'user.list', 'user.add', 'user.invite', 'demo.start', 'demo.exec', 'demo.stop', 'demo.status', 'models.list', 'account.clear', 'account.list', 'account.poll', 'executor.switch', 'executor.status', 'executor.reap', 'executor.prepare', 'executor.retire-legacy', 'task.migrate', 'rule.add', 'rule.edit', 'rule.retire', 'rule.list', 'rule.show', 'crew.show', 'crew.set', 'role.launch', 'config.set', 'artifact.list', 'hub.reload', 'hub.status', 'merge.queue', 'inbox.list', 'role.list', 'worktree.list', 'suite.start', 'suite.cancel', 'suite.classify', 'suite.queue', 'suite.slot']);

/** Who a call is checked and audited as: a spoke's session, or the session a CLI call acts as. */
type Caller = Pick<Connection, 'name' | 'sessionId' | 'role'>;

export const secretMatches = (given: string, secret: string): boolean => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Both executor owners must retain the producing core's durable notice receipt. */
export function executorSnapshotNotice(core: Pick<HubCore, 'noticeTo'>) {
  return (id: string, text: string): string | null => core.noticeTo(AGENTS.id, { id, kind: 'report', to: ['coordinator'], text });
}

export class Dispatcher {
  readonly #options: DispatcherOptions;
  readonly #log: LogFn;
  /** The adapters' side of the hub (`session.*`); set by the daemon once the hub runs. */
  #sessions: Sessions | undefined;
  readonly #hostPeers = new Map<string, Set<() => void>>();

  /** Project lifecycle owner; providers register durable records before add. */
  hostOwner: Awaited<ReturnType<typeof import('../host/registry.ts').projectSshHosts>> | undefined;
  hostOutageSince: (id: string) => string | null = () => null;

  hostAdmission(secret: string) { return this.core.store.hosts.identify(secret); }

  async revokeHost(id: string) {
    if (!this.core.store.hosts.get(id)) throw new Error('unknown host');
    let cutDone = false;
    const cut = () => {
      if (cutDone) return; cutDone = true;
      this.core.store.hosts.revoke(id, this.core.clock.now().toISOString());
      for (const close of this.#hostPeers.get(id) ?? []) close();
    };
    if (this.core.store.hosts.get(id)?.state === 'revoked') return;
    if (this.#sessions) {
      try { return await this.#sessions.settleHostBeforeCut(id, cut); }
      finally { cut(); }
    }
    cut();
  }

  #accountPoller: AccountPoller | undefined;
  readonly #models: HarnessModels | null;
  /** The task worktrees (T-58): made at a task's claim and by a launch with an item; a hub with a tracker only. */
  readonly #worktrees: TaskWorktrees | null;
  readonly #merges: TaskMerges | null;
  readonly #mergeQueue: MergeQueue | null;
  readonly #mergeQueueReady: Promise<unknown>;
  readonly #releases: Releases | null;
  /** Every frame's handling timed against the budget; reads repeated too fast answered from their last answer. */
  readonly #guard: RequestGuard;
  #rolesSnapshot: RolesConfig | undefined;
  readonly #processWork = new Map<string, string>();
  #workImmediate: ReturnType<typeof setImmediate> | null = null;
  #closed = false;
  #artifactQueue: Promise<unknown> = Promise.resolve();
  readonly artifacts: ArtifactLifecycle;
  readonly #devT3Search: DevT3Search | null;
  readonly #batches: MergeBatches | null;
  readonly #suites: Suites | null;
  readonly #droplets: DropletExecutor | null;
  readonly #demos: Demos | null;
  readonly #dropletReady: Promise<void>;
  readonly #admitExecutorRecovery: () => void;
  readonly #dropletTimer: ClockTimer | null;
  #dropletWork: Promise<void> | null = null;

  readonly loginSnapshots: LoginSnapshots | null;

  constructor(options: DispatcherOptions) {
    this.#options = options;
    this.#log = options.log ?? (() => {});
    this.#guard = options.requestGuard ?? new RequestGuard({ ...options.guard, log: this.#log });
    this.#worktrees = options.tracker ? new TaskWorktrees({ checkpoint: options.territoryLock, store:options.core.store, resolveHost:name=>{if(!this.#sessions)throw new Error("sessions unavailable");return this.#sessions.validateLaunchHost({name:'',role:'implementer',host:name} as never);}, ...(options.hasTerritory ? { hasTerritory: options.hasTerritory } : {}), ...(options.env ? { env: options.env } : {}), tracker: options.tracker, log: this.#log, sessions: () => this.#sessionCwds() }) : null;
    this.#mergeQueue = options.tracker ? new MergeQueue(options.core.store, options.tracker, options.core.clock, () => options.projectConfig?.().merge.queue ?? false, options.git, options.env, (entry, reason) => {
      const item = options.tracker?.summary(entry.item);
      const requester = options.core.store.nameOfSession(options.core.sessionIdentity(entry.by.id)) ?? entry.by.name;
      const lead = item?.state === 'open' ? `lead ${entry.item}` : 'coordinator';
      options.core.noticeTo(item?.topic ?? AGENTS.id, { kind: 'merge-queue-dropped', to: [...new Set([requester, lead])], text: `merge-queue-dropped ${entry.item}: ${reason}`, detail: { event: 'merge-queue-dropped', item: entry.item, head: entry.head, reason } });
      this.#guard.changed();
      this.#log({ event: 'merge-queue-dropped', item: entry.item, head: entry.head, reason });
    }, (view, warnings) => {
      for (const warning of warnings) options.core.noticeTo(view.topic ?? AGENTS.id, {
        kind: 'report', to: ['coordinator', `lead ${view.id}`],
        text: 'unavailable' in warning
          ? `merge-demo-warning-unavailable ${view.id}: ${warning.unavailable}. Enqueue succeeded.`
          : `merge-demo-warning ${view.id}: ${warning.epic} demo ${warning.state}; overlapping files: ${warning.files.join(', ')}. Landing may make the demo stale.`,
        detail: { event: 'unavailable' in warning ? 'merge-demo-warning-unavailable' : 'merge-demo-warning', item: view.id, ...warning },
      });
    }) : null;
    this.#mergeQueueReady = this.#mergeQueue?.refresh().catch(error => this.#log({ event: 'merge-queue-reconcile-failed', error: String(error) })) ?? Promise.resolve();
    options.tracker?.useMergeQueue(id => this.#mergeQueue?.position(id));
    this.#merges = options.tracker && this.#worktrees ? new TaskMerges(options.tracker, this.#worktrees, this.#log, async (item, resumed) => { await this.#sessions?.stopAfterMerge(item, resumed); }, options.env, options.territoryLock, this.#mergeQueue ?? undefined, undefined, undefined, options.git) : null;
    this.#releases = options.tracker && this.#worktrees ? new Releases(options.tracker, this.#worktrees, this.#log, options.env, (head, tree) => {
      if (!releaseT3Cover(options.core.store, tree)) throw new ReleaseError('release-t3', `no green T3 covers release head ${head} (tree ${tree}); needs cland verify all --occasion release --report agents on this dev tree (or a green dev-t3, soak or stage run)`);
    }, { ...(options.publishRelease ? { publish: options.publishRelease } : {}), ...(options.territoryLock ? { lock: options.territoryLock } : {}) }) : null;
    this.artifacts = new ArtifactLifecycle(options.core.store, options.control?.status().root, a => options.core.artifactChanged(a), options.artifactFiles, options.core.clock);
    this.#rolesSnapshot = options.core.roles?.get();
    const root = options.control?.status().root;
    const snapshotProviders = root ? new HostProviderRegistry({env:options.env??process.env,now:()=>options.core.clock.now().getTime(),digitalocean:{root,clock:options.core.clock}}) : null;
    this.loginSnapshots = snapshotProviders ? new LoginSnapshots({logins:options.core.store.hosts.logins,clock:options.core.clock,report:error=>this.#log({event:'login-snapshot-failed',error:String(error)}),resolve:async row=>{
      const provider=snapshotProviders.resolve(row);
      const volumes=await provider.listVolumes({project:root!});
      if(volumes.state!=='listed')throw Error('login volume inventory unavailable');
      const volume=volumes.volumes.find(volume=>volume.id===row.volumeId);
      if(!volume)throw Error('login volume unavailable');
      if(volume.attachedTo===null)return {provider,volume};
      const binding=options.core.store.hosts.logins.bindings(row.name).find(binding=>binding.role==='writer'&&binding.volumeId===volume.id);
      if(!binding)throw Error('attached login has no writer binding');
      const provision=options.core.store.hosts.provisions.get(binding.host);
      const host=this.hostOwner?.hosts.find(host=>host.name===binding.host);
      if(provision?.machine?.id!==volume.attachedTo||!host)throw Error('login writer host unavailable');
      const identity=snapshotHostIdentity(provision.machine,provision.created,options.core.store.hosts.get(binding.host));
      const authorizeCleanup=()=>{
        const live=options.core.store.hosts.provisions.get(binding.host);
        if(snapshotHostIdentity(live?.machine,live?.created,options.core.store.hosts.get(binding.host))!==identity||!this.hostOwner?.hosts.includes(host))throw Error('login snapshot host generation changed');
      };
      const authorize=()=>{authorizeCleanup();if(options.core.store.hosts.provisions.get(binding.host)?.state!=='ready')throw Error('login snapshot host is stopping');};
      return {provider,volume,host,identity,authorize,authorizeCleanup};
    }}) : null;
    this.#loginRelease=installLoginRelease(options.core.store.hosts,{clock:options.core.clock,retry:id=>destroyHost({clock:options.core.clock,root:root!,id,env:options.env??process.env,records:options.core.store.hosts,owner:this.hostOwner!,settleDeleted:(id,read)=>this.#sessions?.hostDeleted(id,read),log:event=>this.#log(event)}),host:id=>this.hostOwner?.hosts.find(host=>host.name===id),beginRelease:(name,options)=>this.loginSnapshots?this.loginSnapshots.beginRelease(name,options):Promise.reject(Error('login snapshots unavailable')),onReleased:(name,receipt)=>this.loginSnapshots?.onReleased(name,receipt),notice:text=>options.core.noticeTo('agents',{kind:'report',to:['coordinator'],text})});
    this.#models = root ? new HarnessModels(options.core.store, root, options.env) : null;
    const snapshotNotice = executorSnapshotNotice(options.core);
    this.#droplets = root ? new DropletExecutor(root, options.core.store, this.#log, options.env, options.projectConfig, { ...options.droplet, clock: options.core.clock, snapshotNotice }) : null;
    this.#demos = root && options.tracker && this.#droplets ? new Demos(root, options.tracker, this.#droplets, options.env, (lease, text) => {
      const id = `demo-attention:${lease.lease}`;
      if (options.core.store.message(id)) return;
      const item = options.tracker!.view(lease.demo!.epic);
      options.core.noticeTo(item.topic ?? AGENTS.id, { id, kind: 'report', to: ['coordinator'], text: options.core.boundedText(text), detail: { event: 'executor-release-unconfirmed', lease: lease.lease, item: item.id } });
    }, options.git) : null;
    const recovery = Promise.withResolvers<void>();
    this.#admitExecutorRecovery = () => recovery.resolve();
    this.#dropletReady = recovery.promise.then(async () => {
      if (this.#closed || !this.#droplets) return;
      this.#log({ event: 'executor-recovery-started' });
      await this.#droplets.sweep(true);
      if (!this.#closed) await this.#suites?.executorRecovered();
      if (!this.#closed) await this.#demos?.reconcile();
    }).catch(() => this.#log({ event: 'executor-reconcile-failed', reason: 'lease recovery deferred' }));
    if (!options.deferExecutorRecovery) this.startExecutorRecovery();
    const retryMs = Number((options.env ?? process.env).CLAND_TEST_EXECUTOR_SWEEP_MS);
    const sweepMs = retryMs > 0 && Number.isFinite(retryMs) ? retryMs : 600000;
    let nextSweep = options.core.clock.now().getTime() + sweepMs;
    this.#dropletTimer = this.#droplets ? options.core.clock.setInterval(() => {
      if (this.#closed || this.#dropletWork) return;
      this.#dropletWork = this.#dropletReady.then(() => {
        const now = options.core.clock.now().getTime();
        if (now >= nextSweep) { nextSweep = now + sweepMs; return this.#droplets!.sweep(); }
        // An accepted deletion can finish just after a short release attempt.
        // Retry durable lease recovery every minute (D18: within six minutes),
        // independently of the more expensive ten-minute orphan sweep.
        return this.#droplets!.reconcile(false);
      }).then(async () => {
        if (!this.#closed) await this.#suites?.executorRecovered();
        await this.#demos?.reconcile();
      }).catch(() => this.#log({ event: 'executor-reconcile-failed', reason: 'lease recovery deferred' })).finally(() => { this.#dropletWork = null; });
    }, Math.min(sweepMs, 60000)) : null;
    this.#dropletTimer?.unref();
    this.#suites = root ? new Suites(options.core.store, root, (job, checkpointArtifact) => this.#reportSuite(job, checkpointArtifact), { ...options.verification, runReferenced: id => options.tracker?.retainsSuiteRun(id) ?? true, taskLanding: item => options.tracker?.summary(item)?.state === 'closed' ? options.tracker.landingReceipt(item) : null, clock: options.core.clock, waitClock: options.core.clock, dropletServices: { ...options.droplet, snapshotNotice }, ...(options.projectConfig ? { projectConfig: options.projectConfig } : {}), ...(options.env ? { env: options.env } : {}), onTestSlotAvailable: waiter => this.#reportTestSlot(waiter), onSoakNotice: (id, text) => { options.core.noticeTo(AGENTS.id, { id, kind: 'report', to: ['coordinator'], text }); }, onAccountingConfirmed: job => this.#reportAccounting(job), onShardingSkipped: (job, text) => options.core.noticeTo(job.topic, { id: `sharding-skipped:${job.id}`, kind: 'report', to: job.to, text, detail: { event: 'verification-sharding-skipped', id: job.id, item: job.item ?? null } }), onRemoteReclaimed: job => options.core.noticeTo(job.topic, { id: `executor-reclaimed:${job.id}`, kind: 'report', to: job.to, text: `verify ${job.id}: remote capacity available; moving queued local fallback to droplet`, detail: { event: 'verification-executor-reclaimed', id: job.id, item: job.item ?? null } }), onFallback: (job, cause) => options.core.noticeTo(job.topic, { id: `executor-fallback:${job.id}`, kind: 'report', to: job.to, text: cause === 'remote budget full' ? `verify ${job.id}: remote budget ${options.projectConfig?.().verification.remoteBudget ?? options.verification?.remoteBudget ?? 4}/${options.projectConfig?.().verification.remoteBudget ?? options.verification?.remoteBudget ?? 4} full; running locally` : `verify ${job.id}: droplet unavailable (${cause}); running locally`, detail: { event: 'verification-executor-fallback', id: job.id, item: job.item ?? null, cause } }), log: this.#log, onQueue: queue => options.core.publishVerification({ ...queue, batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } }), onJob: job => options.tracker?.verifyChanged(job.item ?? null, job.branch), requesterDead: actor => [...(this.#sessions?.list() ?? []), ...(this.#sessions?.list(true) ?? [])].some(p => p.sessionId === actor.sessionId && p.status !== 'running') }) : null;
    const devT3Probes = root && this.#suites ? new DevT3Probes(options.core.store, this.#suites, root, options.env ?? process.env, options.devT3Repository, this.#log) : null;
    this.#devT3Search = devT3Probes && options.tracker ? new DevT3Search(options.core.store, {
      log: this.#log,
      currentDev: async () => {
        const head = await (options.git ?? gitIn(root!, options.env))(['rev-parse', '--verify', 'refs/heads/dev']);
        if (!head) throw new Error('current dev tip unavailable');
        return head.trim();
      },
      nonTrackerChanges: (red, tip) => nonTrackerChanges(options.git ?? gitIn(root!, options.env), red, tip),
      probe: (input, head, file, repetition) => devT3Probes.probe(input, head, file, repetition),
      report: report => reportDevT3Search(options.core, options.tracker!, report),
      blocked: (input, reason) => { options.core.noticeTo(AGENTS.id, { id: `dev-t3-search-blocked:${input.run}`, kind: 'report', to: ['coordinator'], text: options.core.boundedText(`Periodic dev T3 search ${input.run} blocked: ${reason}`), detail: { event: 'verification-dev-t3-search-blocked', run: input.run, reason } }); },
    }) : null;
    this.#devT3Search?.start(options.core.clock);
    const landingReports = options.tracker ? new MergeLandingReports(options.core.store, options.tracker,
      (topic, notice, ids) => options.core.noticeToSessions(topic, notice, ids)) : null;
    this.#batches = root && this.#suites && this.#merges && this.#mergeQueue ? new MergeBatches(options.core.store, this.#suites, options.core.clock, {
      log: this.#log,
      changed: () => { landingReports?.reconcile(); options.core.publishVerification({ ...this.#suites!.snapshot(), batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } }); },
      entries: () => { landingReports?.reconcile(); return this.#mergeQueue!.entries(); },
      build: (id, members, base) => this.#worktrees!.serial(() => prepareMergeBatch(root, id, members, options.env, options.batchRepository, base)),
      rebuildReason: (tested, current) => batchRebuildReason(root, tested, current, options.env, options.batchRepository),
      ...(!options.batchRepository ? { validateOwnership: (candidate: import('./merge-batches.ts').BatchCandidate) => requireCandidateOwnership(root, candidate, options.env ?? process.env) } : {}),
      cleanup: candidate => this.#worktrees!.serial(() => options.batchRepository ? options.batchRepository.remove(candidate) : removeMergeBatch(root, candidate, options.env)),
      checkout: candidate => this.#worktrees!.serial(() => options.batchRepository ? options.batchRepository.checkout(candidate) : checkoutMergeBatch(root, candidate, options.env)),
      isLanded: entry => options.tracker!.summary(entry.item)?.state === 'closed' && !!options.tracker!.mergeReceipt(entry.item),
      land: async (entry, candidate) => {
        const claim = options.tracker!.summary(entry.item)?.claim;
        const batch = this.#batches!.snapshot()!.id;
        landingReports!.capture({ item: entry.item, head: entry.head, branch: entry.branch,
          batch, topic: options.tracker!.summary(entry.item)?.topic ?? AGENTS.id,
          recipients: [...(entry.by.id === 'human' ? [] : [entry.by.id]), ...(claim ? [claim.sessionId] : [])] });
        try {
          const result = await this.#merges!.merge(entry.item, entry.by, work => work(), undefined, () => {
            if (this.#closed || !(options.projectConfig?.().merge.queue ?? false)) throw new Error('merge batch execution stopped');
          }, { head: entry.head, base: candidate.base });
          if ('queued' in result) throw new Error('batch landing requeued its member');
          landingReports!.reconcile();
          if (result.dependencies) {
            const topic = options.tracker!.summary(entry.item)?.topic ?? AGENTS.id;
            options.core.noticeTo(topic, { id: `merge-install:${result.commit}`, kind: 'report', to: [entry.by.name, `lead ${entry.item}`],
              text: `${entry.item}: merged ${result.commit} onto ${result.base}. ${dependencyInstallText(result.dependencies)}`,
              detail: { event: 'merge-install-required', item: entry.item, commit: result.commit, dependencies: result.dependencies } });
          }
          if (result.followUp) throw new Error(result.followUp.error);
        } catch (error) {
          // A recoverable landing must keep its receipt and membership for retry;
          // only an ordinary gate refusal drops an entry from the next batch.
          if (error instanceof MergeError && error.code === 'merge-changed' && /(?:batch|integration) base moved/.test(error.message)) {
            landingReports!.retire(entry.item, batch);
            throw new BatchRebuild(error.message);
          }
          if (error instanceof MergeError && !['merge-recovery', 'merge-git', 'merge-unpublished', 'merge-checkout', 'merge-dirty'].includes(error.code)) {
            landingReports!.retire(entry.item, batch);
            throw new BatchRefusal(entry, error.message);
          }
          throw error;
        }
      },
      drop: (entry, reason) => this.#mergeQueue!.drop(entry, reason),
      notice: notice => { if (!options.core.noticeTo(AGENTS.id, notice)) throw new Error('batch notice topic unavailable'); },
      report: (batch, text, reportPhase) => {
        const selected = batch.diagnosis?.selected === undefined ? batch.candidate : batch.diagnosis.jobs[batch.diagnosis.selected]?.candidate;
        const detail = { event: 'merge-batch-result', batch: batch.id, members: batch.members.map(e => e.item), tree: selected?.tree ?? null,
          ...(batch.diagnosis ? { diagnosis: batch.diagnosis } : {}) };
        for (const entry of batch.members) {
          const item = options.tracker!.summary(entry.item);
          const topic = item?.topic ?? AGENTS.id;
          const lead = item ? `lead ${entry.item}` : 'coordinator';
          const cleanup = reportPhase?.startsWith('cleanup:');
          const notice: TopicNotice = { id: batchNoticeId(batch, reportPhase, entry.item), kind: 'report', to: cleanup ? [lead] : [entry.by.name, lead], text, detail };
          if (!options.core.noticeTo(topic, notice)) throw new Error('batch item notice topic unavailable');
          if (cleanup && entry.by.id !== 'human') {
            const direct = options.core.noticeToSessions(topic, notice, [entry.by.id]);
            if (!direct || direct.pending.length) throw new Error('cleanup notice awaiting captured requester delivery receipt');
          }
        }
        if (!options.core.noticeTo(AGENTS.id, { id: batchNoticeId(batch, reportPhase), kind: 'report', text, detail })) throw new Error('batch notice topic unavailable');
      },
    }, () => options.projectConfig?.().merge ?? { queue: false, batch: 3, batchWaitMs: 600_000 }) : null;
    void this.#mergeQueueReady.then(() => { if (!this.#closed) { landingReports?.reconcile(); this.#batches?.start(); } });
    options.tracker?.useReadyAdmission(async view=>{
      try{
        if(view.claim)await this.#flushHostItem(view.id,view.claim.sessionId);
        else if(options.core.store.hostWorktrees().some(row=>row.item===view.id))throw new Error('host-flush-refused: claimant unavailable; worktree HEAD unknown; territory HEAD unknown');
      }catch(error){
        const reason=error instanceof Error?error.message:String(error);
        options.core.noticeTo(view.topic??AGENTS.id,{id:`host-ready-refused:${view.id}:${createHash('sha256').update(reason).digest('hex')}`,kind:'report',to:[`lead ${view.id}`],text:`${view.id} ready refused: ${reason}`});
        throw error;
      }
    });
    options.tracker?.useVerify((item, branch) => this.#suites?.latest(item, branch) ?? null, () => this.#suites?.stageCovers() ?? []);
    options.core.inbox.pairingCodes.onChange(() => this.#guard.changed());
    // what a read shows changed: no earlier answer is replayed
    options.core.subscribe(event => {
      this.#guard.changed();
      if (event.type === 'presence' || event.type === 'delivery') this.#refreshSessionWork();
      if (event.type === 'session.process') this.#processWork.set(event.process.sessionId, JSON.stringify([event.process.holds ?? [], event.process.pending ?? null]));
      if (event.type === 'session.process' && event.process.status !== 'running') {
        options.tracker?.releaseHolds(event.process.sessionId, event.process.name);
        this.#suites?.requesterExited(event.process.sessionId);
      }
      if (event.type === 'session.role' && event.role !== null) {
        const sessionId = options.core.store.sessionIdOf(event.session);
        if (sessionId) this.#suites?.reportPermissionsChanged(sessionId);
      }
      if (event.type === 'session.cleanup' && event.state === 'settled') options.tracker?.releaseHolds(event.sessionId);
    });
    options.tracker?.onChange(() => {
      this.#guard.changed();
      options.core.refreshPresence();
      this.#refreshSessionWork();
    });
    const reconcileDemos = () => {
      if (!this.#closed) void this.#dropletReady.then(() => this.#demos?.reconcile()).catch(() => this.#log({ event: 'demo-reconcile-failed' }));
    };
    options.tracker?.onVerdict((_id, _author, verdict) => { if (verdict.verdict === 'qa' && verdict.stage === undefined) reconcileDemos(); });
    options.tracker?.onClosed(reconcileDemos);
    // A crash after the tracker commit but before alias cleanup must not reserve the old name forever.
    if (options.tracker) for (const { name, id } of options.core.store.sessionAliases()) {
      if (!options.tracker.hasProvisionalSession(name)) options.core.store.settleSessionAlias(name, id);
    }
    options.tracker?.useSessionIdentity(id => options.core.sessionIdentity(id), (name, id) => options.core.store.settleSessionAlias(name, id));
    // a role moved to a name with no session yet: its claims follow at that session's hello; and what a hub that
    // died between a move's commit and its claims left pending is finished now
    options.core.onSessionHello((name, sessionId) => {
      options.tracker?.adoptSession(name, sessionId);
      this.#settleClaims({ name, sessionId });
    });
    this.#settleClaims();
  }

  #settleClaims(hello?: { name: string; sessionId: string }): void {
    try {
      settleAllClaims(this.#handover(), hello);
    } catch (err) {
      this.#log({ event: 'claims-settle-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  /** Join admitted verification I/O without admitting another scheduler tick. */
  async verificationSettled(): Promise<void> {
    await this.#dropletReady;
    do {
      await this.#dropletWork;
      await this.#suites?.settled();
      await this.#devT3Search?.tick();
    } while (this.#dropletWork);
  }

  /** Fence periodic metrics before daemon shutdown begins awaiting its owners. */
  stopWaitMetrics(): void { this.#suites?.stopWaitMetrics(); }

  #hostProvisionAbort = new AbortController();
  #stopHostSpend: (() => void) | undefined;
  #poolPrepares = new Set<Promise<unknown>>();
  readonly #loginRelease:ReturnType<typeof installLoginRelease>;
  readonly #loginClosers = new Set<() => Promise<unknown>>();
  readonly #loginPins = new Map<string, number>();
  #cardSignIn:LoginCardSignIn|undefined;
  stopMergeCleanup(): Promise<MergeCleanupStop> {
    this.#closed = true;
    return this.#merges?.stop() ?? Promise.resolve({ status: 'complete' });
  }

  async close(): Promise<void> {
    this.#closed = true;
    const mergeCleanup = await this.stopMergeCleanup();
    if (mergeCleanup.status === 'incomplete') throw new MergeCleanupIncomplete(mergeCleanup);
    const failures:unknown[]=[];
    const attempt=async(close:()=>unknown|Promise<unknown>)=>{try{await close();}catch(error){failures.push(error);}};
    this.#hostProvisionAbort.abort();
    await attempt(()=>this.#cardSignIn?.stop());
    await attempt(()=>this.#loginRelease.close());
    await attempt(()=>this.loginSnapshots?.close());
    await attempt(()=>this.#stopHostSpend?.());
    await Promise.allSettled([...this.#poolPrepares]);
    const logins=await Promise.allSettled([...this.#loginClosers].map(close=>Promise.resolve().then(close)));
    for(const result of logins)if(result.status==='rejected'){
      failures.push(result.reason);
      await attempt(()=>this.#log({event:'login-cleanup-failed',error:String(result.reason)}));
    }
    // A startup failure can close the dispatcher before serving admits recovery.
    this.#admitExecutorRecovery();
    if (this.#dropletTimer) this.#options.core.clock.clearInterval(this.#dropletTimer);
    const closingDroplets = attempt(()=>this.#droplets?.close());
    await attempt(()=>this.#dropletReady);
    await attempt(()=>this.#dropletWork);
    await attempt(()=>this.#demos?.close());
    await closingDroplets;
    if (this.#workImmediate) clearImmediate(this.#workImmediate);
    this.#workImmediate = null;
    await attempt(()=>this.#devT3Search?.close(this.#options.core.clock));
    await attempt(()=>this.#batches?.close());
    await attempt(()=>this.#mergeQueue?.stop());
    await attempt(()=>this.#mergeQueueReady);
    await attempt(()=>this.#models?.close());
    await attempt(()=>this.#suites?.close());
    if(failures.length)throw new AggregateError(failures,'dispatcher cleanup failed');
  }

  /** Idempotent startup admission; ordinary frames never await provider recovery. */
  startExecutorRecovery(): void { this.#admitExecutorRecovery(); queueMicrotask(() => this.#suites?.startRetention()); }

  /** Holds and delivered requests share one trailing process projection per tick. */
  #refreshSessionWork(): void {
    if (this.#closed || this.#workImmediate) return;
    this.#workImmediate = setImmediate(() => {
      this.#workImmediate = null;
      for (const process of this.#sessions?.list() ?? []) {
        const work = JSON.stringify([process.holds ?? [], process.pending ?? null]);
        const previous = this.#processWork.get(process.sessionId) ?? '[[],null]';
        this.#processWork.set(process.sessionId, work);
        if (work !== previous) this.#options.core.publishProcess(process);
      }
    });
  }

  useAccountPoller(poller: AccountPoller): void { this.#accountPoller = poller; this.core.useAccountPoller(poller); }

  configure(config: import('../init/config.ts').ProjectConfig): void { this.#suites?.configure(config); this.#sessions?.configurePools(config); }

  #validateSessionCaller(frame: { type: string; name?: unknown } & Record<string, unknown>, original: {name:string;sessionId:string} | null, current: Caller | null, peer: Peer, inferredRole?: string | null): void {
    if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, frame.type, 'the session is no longer current');
    if (current) this.#requirePermission(current, frame, peer);
    if (frame.type === 'session.launch' && this.core.store.users.list().some(user => user.name === frame.name)) throw new Error(`session name is a user name: ${String(frame.name)}`);
    if (inferredRole !== undefined && this.core.store.roleOf(String(frame.name)) !== inferredRole) throw new Error(`session "${String(frame.name)}" changed role while launching; retry the launch`);
  }

  restoreWaitingLaunches(): void {
    const sessions = this.#sessions;
    if (!sessions) return;
    sessions.restoreWaitingLaunches((request, authorize) => sessions.withLaunchPlacement<unknown>(request, placed => {
      if (!request.item) return sessions.launch(placed, undefined, authorize);
      if (!this.#worktrees) throw new Error('waiting item launch needs tracker');
      return this.#worktrees.launch(sessions, { ...placed, item: request.item }, undefined, authorize);
    }, undefined, authorize), record => {
      const caller = record.actor ? this.#asSession({as:{...record.actor,shell:true}}) : null;
      this.#validateSessionCaller({type:'session.launch',id:'waiting-recovery',...record.request}, record.actor, caller, {send:()=>{},close:()=>{},isOpen:()=>true}, record.inferredRole);
    });
  }

  #createPoolHost(pool?: string, authorize: () => void = () => {}, demand?:()=>readonly import('../host/login-binding.ts').ProvisionLoginDemand[]): ReturnType<typeof createHost> {
    if (this.#closed || !this.hostOwner || !this.#options.control) return Promise.reject(new Error('host runtime unavailable'));
    const work = (this.#options.createHost ?? createHost)({...(demand?{onConnecting:(record,signal)=>this.#sessions!.provisionLogins(record,demand(),signal)}:{}),onBootFailure:record=>this.#log({event:'host-boot-failed',host:record.id,pool:record.pool,reason:record.reason ?? 'boot failed'}),inUse:id=>this.#sessions?.hostInUse(id) ?? false,clock:this.core.clock,root:this.#options.control.status().root,pool,env:this.#options.env ?? process.env,signal:this.#hostProvisionAbort.signal,...(this.#options.registerHostSecrets ? {registerSecrets:this.#options.registerHostSecrets} : {}),records:this.core.store.hosts,owner:this.hostOwner,admit:(name,prepared)=>{
      try { authorize();
      if(this.#closed)throw new Error('host provisioning stopped');
      const pool=this.#options.projectConfig?.().hosts.pools[name];
      if(!pool)throw new Error(`unknown host pool ${name}`);
      for(const key of ['provider','size','region','transport','slots'] as const)if(pool[key]!==prepared[key])throw new Error(`pool ${name} changed during host preparation`);
      if(this.core.store.hosts.provisions.occupied(name)>=pool.maxHosts)throw new Error(`pool ${name} reached max_hosts ${pool.maxHosts}`);
      } catch(error) { throw new PoolCreationNotAdmitted((error as Error).message,{cause:error}); }
    }});
    const name=selectHostPool(this.#options.projectConfig?.().hosts.pools??{},pool);
    const observed=work.then(result=>{if(name)this.#sessions?.recordHostCreateResult(name,result);return result;},error=>{
      if(name)this.#sessions?.recordHostCreateResult(name,error);throw error;
    });
    this.#poolPrepares.add(observed);
    void observed.finally(() => this.#poolPrepares.delete(observed)).catch(() => {});
    return observed;
  }

  async restoreSessions(sessions: Sessions, restoreHosts: () => Promise<void>): Promise<void> {
    this.useSessions(sessions, false);
    await restoreHosts();
    this.#startPoolScaling();
  }

  #startPoolScaling(): void {
    const sessions=this.#sessions;
    if (sessions && this.hostOwner && this.#options.control) {
      const env = this.#options.env ?? process.env;
      const providers = new HostProviderRegistry({ env, now: () => this.core.clock.now().getTime(), digitalocean: { root: this.#options.control.status().root, clock: this.core.clock } });
      this.#stopHostSpend?.();
      this.#stopHostSpend = onHostSpendChange(env, this.#options.control.status().root, spend => {
        if (this.#closed) return;
        const cap = this.#options.projectConfig?.().hosts.dailySpendUsd;
        if (cap === undefined || cap <= 0 || spend.spent + spend.reserved < cap * 0.8 || this.core.store.meta('hosts-spend-warning-day') === spend.day) return;
        const id = this.core.noticeInTopic('general', { id: `hosts-spend-warning:${spend.day}`, kind: 'report', text: `hosts daily spend and reservations reached 80% of $${cap}`, detail: { pools: spend.pools } });
        if (id) this.core.store.setMeta('hosts-spend-warning-day', spend.day);
      });
      sessions.startPoolScaling((pool,authorize,demand) => this.#createPoolHost(pool,authorize,demand), {
        busyHost: id => this.#loginPins.has(id),
        failed: record => {if(!record.bootFailureAt)this.#log({event:'host-boot-failed',host:record.id,pool:record.pool,reason:record.reason ?? 'boot failed'});},
        declarations: record => {
          const provider = providers.resolve(record);
          return provider instanceof DigitalOceanHostProvider ? provider.refreshDeclarations() : provider.declarations;
        },
        destroy: id => destroyHost({clock:this.core.clock,root:this.#options.control!.status().root,id,env,records:this.core.store.hosts,provider:providers.resolve(this.core.store.hosts.provisions.get(id)!),owner:this.hostOwner!,settleDeleted:(id,read)=>this.#sessions?.hostDeleted(id,read),log:event=>this.#log(event)}),
      });
    }
  }

  #prepareLogin(input:LoginAddInput&{signin?:boolean},signal?:AbortSignal){
    const core=this.core,root=this.#options.control!.status().root,env=this.#options.env??process.env;
    return (this.#options.prepareLogin??preparePoolLogin)({afterSignIn:async(host,harness)=>{if(!this.#sessions)throw Error('session runtime unavailable');await this.#sessions.relaunchAfterSignIn(host,harness);},root,env,pools:this.#options.projectConfig!().hosts.pools,records:core.store.hosts,hosts:this.hostOwner!.hosts,clock:core.clock,signal:signal?AbortSignal.any([signal,this.#hostProvisionAbort.signal]):this.#hostProvisionAbort.signal,createHost:pool=>this.#createPoolHost(pool),...(this.loginSnapshots?{snapshots:this.loginSnapshots}:{}),pinHost:id=>{
      this.#loginPins.set(id,(this.#loginPins.get(id)??0)+1);
      let released=false;
      return ()=>{if(released)return;released=true;const n=this.#loginPins.get(id)!-1;if(n)this.#loginPins.set(id,n);else this.#loginPins.delete(id);};
    }},input);
  }

  useSessions(sessions: Sessions | undefined, startScaling = true): void {
    this.#sessions = sessions;
    if(sessions&&!this.#cardSignIn&&this.#options.registerHostSecrets){
      this.#cardSignIn=new LoginCardSignIn({store:this.core.store,cards:this.core.cards,clock:this.core.clock,
        prepare:async(input,signal)=>{const {pending,plan,nativeHost}=await this.#prepareLogin(input,signal);return {pending,host:plan.host,...(nativeHost?{nativeHost}:{})};},
        run:this.#options.runLoginSignIn??(async(input,output)=>{
          const host=input.nativeHost;
          if(!host?.signIn)throw signInNotAdmitted('CLAND_SIGNIN_UNAVAILABLE','host signin-v1 capability unavailable');
          return host.signIn({harness:input.harness,path:input.path},output);
        }),registerSecret:text=>this.#options.registerHostSecrets!([text]),
        notice:text=>{this.core.noticeTo('agents',{kind:'report',to:['coordinator'],text});},
      });
    }
    sessions?.waitingAdmission(async (request,authorize) => {
      if (!request.item) return authorize;
      if (!this.#worktrees) throw new Error('this hub has no tracker: a launch with an item needs a project');
      return this.#worktrees.admitWaiting({...request,item:request.item},authorize);
    });
    if (startScaling) this.#startPoolScaling();
    this.core.useSessionRows(() => this.#sessions?.list() ?? []);
    this.#processWork.clear();
    for (const process of sessions?.list() ?? []) this.#processWork.set(process.sessionId, JSON.stringify([process.holds ?? [], process.pending ?? null]));
    this.#options.tracker?.reconcileSessionIdentities();
    // A crash can follow the durable process-row update but precede queued hold cleanup.
    // Reconcile only known process identities; direct and unknown sessions retain their work.
    for (const process of sessions?.list() ?? []) if (process.status !== 'running') {
      this.#options.tracker?.releaseHolds(process.sessionId, process.name);
    }
    // the inbox's approvals are the launched sessions waiting for approval, with their attach commands (#33)
    this.#options.core.inbox.useProcesses(sessions ? () => sessions.list() : null);
    this.#options.core.inbox.useWaitingLaunches(sessions ? () => sessions.waitingLaunches() : null);
  }

  /** Where the sessions stand: the connected spokes' cwds and the running launched harnesses'. */
  #sessionCwds(): SessionCwd[] {
    const out: SessionCwd[] = this.#options.core.presence().filter((p) => typeof p.cwd === 'string' && p.cwd !== '').map((p) => ({ name: p.name, cwd: p.cwd, host:this.#sessions?.hostForSession(p.sessionId).name ?? 'local' }));
    for (const p of this.#sessions?.list() ?? []) if (p.status === 'running') out.push({ name: p.name, cwd: p.cwd, host:this.#sessions!.hostForSession(p.sessionId).name });
    for (const { process } of this.#sessions?.pendingStops() ?? []) out.push({ name: process.name, cwd: process.cwd, host:process.host ?? 'local' });
    return out;
  }

  /**
   * A task request's result, with what a claim of an open task made of its branch and worktree (decision D7): the
   * worktree, or the reason there is none; the claim stands either way. Its write after Git runs through `resumed`.
   */
  async #withWorktree(frame: TaskRequest, result: HubFrame, resumed: <T>(write: () => T) => T): Promise<HubFrame> {
    if (frame.type !== 'task.claim' || frame.release === true || result.type !== 'result' || !result.ok || !this.#worktrees) return result;
    const value = result.value as { id: string; claim: { session: string } | null };
    return { ...result, value: { ...value, ...(await this.#worktrees.afterClaim(value.id, value.claim?.session ?? null, resumed)) } };
  }

  /** What a handover and `role.state` read beyond the core (#31): the tracker's claims, the launched sessions. */
  #handover(): HandoverContext {
    return {
      core: this.#options.core,
      tracker: this.#options.tracker,
      launched: (name) => this.#sessions?.list().find((p) => p.name === name && p.status === 'running') ?? null,
    };
  }

  /** The task worktrees, or the error a hub without a tracker answers `worktree.*` with. */
  #needWorktrees(): TaskWorktrees {
    if (!this.#worktrees) throw new Error('this hub has no tracker: it was started without a project (`cland hub start` serves one)');
    return this.#worktrees;
  }

  /** A failed request's result: a handover note without its four sections is typed (`note-incomplete`, `missing`). */
  static #failure(id: string, err: unknown): HubFrame {
    if (err instanceof InvalidArgument) return { type: 'result', id, ok: false, error: err.message, code: err.code, reason: err.reason };
    if (err instanceof AccountLimited) return { type: 'result', id, ok: false, error: err.message, code: err.code, account: err.account, resetsAt: err.resetsAt };
    if (err instanceof PublishError) return { type: 'result', id, ok: false, error: err.message, code: err.code };
    if (err instanceof PushError) return { type: 'result', id, ok: false, error: err.message, code: err.code };
    if (err instanceof ReleaseError) return { type: 'result', id, ok: false, error: err.message, code: err.code, ...(err.files ? { files: err.files } : {}) };
    if (err instanceof SuiteAdmissionError) return { type: 'result', id, ok: false, error: err.message, code: err.code, files: err.files };
    if (err instanceof MergeError) return { type: 'result', id, ok: false, error: err.message, code: err.code, ...(err.files ? { files: err.files } : {}), ...(err.recovery ? { recovery: err.recovery } : {}) };
    if (err instanceof ArtifactError) return { type: 'result', id, ok: false, error: err.message, code: err.code };
    if (err instanceof NoteIncomplete) return { type: 'result', id, ok: false, error: err.message, code: 'note-incomplete', missing: err.missing };
    if (err instanceof ToolForbidden) return { type: 'result', id, ok: false, error: err.message, code: 'forbidden', permission: err.permission, role: err.role, reason: err.reason };
    // hygiene's typed refusal rides along (#34)
    return { type: 'result', id, ok: false, error: err instanceof Error ? err.message : String(err), ...(err instanceof HygieneError ? { refusal: err.refusal } : {}) };
  }

  get core(): HubCore {
    return this.#options.core;
  }

  /**
   * The permission table on one spoke frame (spec 4.4): true when it may go on. A refusal is answered here, with
   * the typed error, and posted to the Agents topic. A hub with no role definitions (no project) checks nothing;
   * a frame that is no tool the table knows goes on to its own "unknown request" answer.
   */
  #permitted(connection: Caller, frame: Record<string, unknown>, peer: Peer, answer = true): boolean {
    const core = this.#options.core;
    const roles = core.roles;
    const grants = connection.role === null ? undefined : roles?.get().get(connection.role)?.permissions.tools;
    const type = releasePermissionTool(String(frame.type));
    const tool = type.startsWith('event.') ? type.slice(6) : type === 'artifact.list' || type === 'merge.queue' ? 'history' : type;
    if (['rule.add', 'rule.edit', 'rule.retire'].includes(type) && !['coordinator', 'aide'].includes(connection.role ?? '')) {
      this.#refuse(connection, frame, peer, type, 'rule writes belong to the human, Coordinator or Aide; propose the rule to the Coordinator in your item topic', '', answer);
      return false;
    }
    if (roles && (KNOWN_TOOLS.includes(tool) || connection.role === 'aide' && (tool === 'role.state' || tool.startsWith('session.'))) && !(tool === 'send' && frame.kind === 'request')) {
      const availability = toolAvailability(connection.role, grants, tool);
      if (!availability.ok) {
        const target = tool === 'send' ? (!Array.isArray(frame.to) || frame.to.length === 0 ? ' to the human' : '') : typeof frame.item === 'string' ? ` ${frame.item}` : '';
        this.#refuse(connection, frame, peer, availability.permission, availability.reason, target, answer);
        return false;
      }
    }
    try { validateToolFrame(frame, this.#options.tracker ? [...this.#options.tracker.kinds, 'category'] : undefined); }
    catch (error) {
      if (answer) peer.send(Dispatcher.#failure(String(frame.id), error));
      else throw error;
      return false;
    }
    if (frame.type === 'send') {
      try { frame.to = sendRecipients(frame.to); }
      catch (error) {
        if (answer) peer.send(Dispatcher.#failure(String(frame.id), error));
        return false;
      }
    }
    if (frame.type === 'send' && frame.kind !== 'request' && (frame.request !== undefined || frame.subject !== undefined)) {
      const reason = 'request and subject require kind: request; remove them from this send';
      this.#log({ event: 'send-refused', session: connection.name, reason });
      if (answer) peer.send(Dispatcher.#failure(String(frame.id), new Error(reason)));
      return false;
    }
    if (!roles) return true;
    const call = this.#toolCall(connection, frame);
    if (!call) return true;
    const decision = decide(connection.role, grants, call);
    if (decision.ok) return true;
    const target = call.tool === 'send' ? (call.toHuman ? ' to the human' : '') : typeof call.item === 'string' ? ` ${call.item}` : '';
    this.#refuse(connection, frame, peer, decision.permission, decision.reason, target, answer);
    return false;
  }

  /** Async handlers retain the table's typed reason when their admission changes. */
  #requirePermission(connection: Caller, frame: Record<string, unknown>, peer: Peer): void {
    if (this.#permitted(connection, frame, peer, false)) return;
    const decision = decide(connection.role, this.core.roles?.get().get(connection.role ?? '')?.permissions.tools, this.#toolCall(connection, frame)!);
    if (!decision.ok) throw new ToolForbidden(connection.role, decision.permission, decision.reason);
  }

  /** Answer a frame with the typed `forbidden` error and post the refusal to the Agents topic. */
  #refuse(connection: Caller, frame: Record<string, unknown>, peer: Peer, permission: string, reason: string, target = '', answer = true): void {
    const core = this.#options.core;
    if (answer) peer.send({ type: 'result', id: String(frame.id), ok: false, error: `forbidden: ${permission} (${reason})`, code: 'forbidden', permission, role: connection.role, reason });
    try {
      core.noticeInTopic(AGENTS.id, { kind: 'refusal', text: `${withRole(connection.name, connection.role)} tried ${String(frame.type)}${target}: forbidden (${reason})`, detail: { session: connection.name, role: connection.role, tool: String(frame.type), permission } });
    } catch (err) {
      this.#log({ event: 'notice-failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Whether the human's latest message in the `send`'s topic (General by default, as for any message to the human)
   * was delivered to the caller, by its name or as a holder of its role (spec 4.5: the mention pulled it in).
   */
  #mentioned(connection: Caller, frame: Record<string, unknown>): boolean {
    const topic = typeof frame.topic === 'string' && frame.topic !== '' ? frame.topic : GENERAL.id;
    // by the session id each delivery was recorded for: another session that took the name later inherits nothing
    return this.#options.core.store
      .lastHumanDeliveries(topic)
      .some((d) => (d.sessionId !== null ? d.sessionId === connection.sessionId : d.session === connection.name) || (connection.role !== null && d.session === connection.role));
  }

  /**
   * The session a client's task frame acts as (`as`, the CLI's `--as` or `$CLAND_SESSION_NAME`), when it is one the
   * hub knows: by its session id (`as.sessionId`, `$CLAND_SESSION_ID`), else by a name a session holds or held. Its
   * role is the hub's, never the frame's. Null for the human, and for a name no session ever had (a CLI actor).
   * A session id decides before any name: a frame carrying one is that session's (an id the hub does not know is a
   * roleless session, refused what needs a role), whatever name it gives, the human's included. So does `as.shell`:
   * a name the calling shell gives as its own session is a session's even when the hub never heard of it.
   */
  #asSession(frame: Record<string, unknown>): Caller | null {
    const core = this.#options.core;
    const as = frame.as as { name?: unknown; sessionId?: unknown; shell?: unknown } | undefined;
    if (!as || typeof as !== 'object' || typeof as.name !== 'string') return null;
    const sessionId = typeof as.sessionId === 'string' && as.sessionId !== '' ? as.sessionId : null;
    // the calling shell's own identity (`$CLAND_SESSION_*`), as against a name the human gave with `--as`
    const own = as.shell === true;
    if (core.store.users.mode() === 'users' && !own && sessionId === null && HUMAN_USER_WRITES.has(String(frame.type))) return null;
    if (sessionId === null && as.name === HUMAN_SESSION && !own) return null;
    if (sessionId !== null) {
      const live = core.connectionOf(sessionId);
      if (live) return { name: live.name, sessionId, role: live.role };
      const known = core.store.nameOfSession(sessionId);
      return { name: known ?? (as.name === HUMAN_SESSION ? sessionId : as.name), sessionId, role: known !== null ? core.store.roleOf(known) : null };
    }
    const present = core.presence().find((p) => p.name === as.name);
    if (present) return { name: present.name, sessionId: present.sessionId, role: present.role };
    const id = core.store.sessionIdOf(as.name);
    const role = core.store.roleOf(as.name);
    // a name no session ever had: the human's CLI actor, unless the shell says it is its own session — a stale or
    // made-up identity is a roleless session, never promoted to the human
    if (id === null && role === null && !own) return null;
    return { name: as.name, sessionId: id ?? UNKNOWN_SESSION, role };
  }

  /** Authenticate external client claims before replay, audit, permission checks or writes. */
  #sessionCredentialRefusal(frame: Record<string, unknown>): string | null {
    const as = frame.as as { name?: unknown; sessionId?: unknown; shell?: unknown; credential?: unknown } | undefined;
    if (!as || typeof as !== 'object') return null;
    const caller = this.#asSession(frame);
    const claimed = as.shell === true || (typeof as.sessionId === 'string' && as.sessionId !== '');
    if (!caller && !claimed) return null;
    const id = caller?.sessionId ?? (typeof as.sessionId === 'string' ? as.sessionId : '');
    const expected = this.#options.core.store.sessionCredential(id);
    if (caller && expected && typeof as.credential === 'string' && secretMatches(as.credential, expected)) return null;
    const name = typeof as.name === 'string' ? as.name : caller?.name ?? 'session';
    return `session "${name}" credential is missing or invalid; reconnect this session's own MCP spoke to provision its shell credential, or resume with --relaunch`;
  }

  /**
   * A comment whose text carries a verdict header is a verdict: its fields are taken from the header and its `by` is
   * the caller's (the tracker writes it from the actor), never the one the text claims. A text that would still read
   * as a verdict after its header is refused. Returns an error, or null.
   */
  static #verdictFromText(frame: Record<string, unknown>): string | null {
    try {
      if (frame.type !== 'task.comment' || frame.verdict !== undefined || typeof frame.text !== 'string' || !readsAsVerdict(frame.text)) return null;
      const v = verdictOfText(frame.text);
      if (!v) return null;
      if (readsAsVerdict(v.text)) return 'a verdict comment carries one verdict header: its text may not start with another';
      frame.verdict = { ...(v.findings !== undefined ? { findings: v.findings } : {}), verdict: v.verdict, result: v.result, run: v.run, ...(v.commit ? { commit: v.commit } : {}), ...(v.scope !== undefined ? { scope: v.scope } : {}), ...(v.stage ? { stage: v.stage } : {}) };
      frame.text = v.text;
      return null;
    } catch (err) { return err instanceof Error ? err.message : String(err); }
  }

  /** After a task write that set an assignee: the item is bound to the assignee's session id, when the hub knows it
   *  (a rename never moves an assignment; another session taking the name later does not own the item). */
  #bindAssignee(frame: Record<string, unknown>, result: HubFrame): void {
    if (result.type !== 'result' || !result.ok || (frame.type !== 'task.create' && frame.type !== 'task.edit') || !(Object.hasOwn(frame, 'assignee'))) return;
    const item = (result.value as { item?: { id?: string } } | undefined)?.item?.id;
    if (typeof item !== 'string') return;
    const core = this.#options.core;
    const name = typeof frame.assignee === 'string' && frame.assignee.trim() !== '' ? frame.assignee.trim() : null;
    if (name === null) return core.store.bindAssignee(item, null, null);
    const id = core.presence().find((p) => p.name === name)?.sessionId ?? core.store.sessionIdOf(name);
    core.store.bindAssignee(item, name, id !== null && id !== UNKNOWN_SESSION ? id : null);
  }

  /** Scope comes from current claims/ancestry, never the session that launched a harness. */
  #leadRefusal(connection: Caller, frame: Record<string, unknown>): string | null {
    if (connection.role !== 'lead') return null;
    const type = String(frame.type);
    if (LEAD_ROOT_TOOLS.includes(type)) {
      return `root level: only the Coordinator may use ${type}`;
    }
    const request = type === 'send' && frame.kind !== 'request' && typeof frame.text === 'string'
      ? verifierRequest(frame.text)
      : null;
    if (!['session.launch', 'session.stop', 'merge'].includes(type) && !request) return null;
    const tracker = this.#options.tracker;
    const items = tracker?.list() ?? [];
    const node = items.find(i => i.state === 'open' && tracker?.ladder.canLead(i.kind) && i.claim?.role === 'lead' && this.core.sessionIdentity(i.claim.sessionId) === connection.sessionId);
    if (!node) return 'Lead level: no live container claim; only a claimed subtree may be managed';
    const reason = (target: string) => `Lead level at ${node.kind} ${node.id}: ${target} is outside your subtree; send the request to lead ${node.id}`;
    const inside = (id: string | null | undefined): boolean => {
      const seen = new Set<string>();
      let item = items.find(i => i.id === tracker?.resolveId(id ?? ''));
      while (item && !seen.has(item.id)) {
        if (item.id === node.id) return true;
        seen.add(item.id);
        item = items.find(i => i.id === item!.parent);
      }
      return false;
    };
    if (type === 'session.stop') {
      const waiting = this.#sessions?.waitingLaunches().find(row => row.name === frame.session);
      if (waiting) return !['coordinator', 'lead', 'aide'].includes(waiting.role ?? '') && inside(waiting.item) ? null : reason(`waiting session ${waiting.name}`);
      const process = this.#sessions?.list().find(p => p.name === frame.session);
      const role = process ? this.core.store.roleOf(process.name) ?? process.role : null;
      if (!process || ['coordinator', 'lead', 'aide'].includes(role ?? '')) return reason(`session ${String(frame.session)} (root or node role)`);
      const held = items.filter(i => i.state === 'open' && [i.claim, ...i.holds].some(h => h && this.core.sessionIdentity(h.sessionId) === process.sessionId));
      const work = held.length ? held.map(i => i.id) : [process.item];
      return work.every(inside) ? null : reason(`session ${process.name}`);
    }
    const item = request?.item ?? (typeof frame.item === 'string' ? frame.item : null);
    if (!inside(item)) return reason(item ?? 'a request with no item');
    if (type === 'session.launch') {
      const role = typeof frame.role === 'string' ? frame.role : typeof frame.name === 'string' ? this.core.store.roleOf(frame.name) : null;
      if (!['implementer', 'reviewer', 'qa'].includes(role ?? '')) return reason(`launch of role ${role ?? '(none)'}`);
    }
    if (type === 'merge') {
      let target = items.find(i => i.id === tracker?.resolveId(item!));
      const seen = new Set<string>();
      while (target && !seen.has(target.id)) {
        if (target.kind === tracker?.ladder.top) return null;
        seen.add(target.id);
        target = items.find(i => i.id === target!.parent);
      }
      return 'root level: only the Coordinator merges items outside a release subtree';
    }
    return null;
  }

  /** The table's view of a spoke frame, or null when it is no tool the table knows. */
  #toolCall(connection: Caller, frame: Record<string, unknown>): ToolCall | null {
    const type = releasePermissionTool(String(frame.type));
    const tool = type.startsWith('event.') ? type.slice(6) : type === 'artifact.list' || type === 'merge.queue' ? 'history' : type;
    if (!KNOWN_TOOLS.includes(tool) && !(connection.role === 'aide' && (tool === 'role.state' || tool.startsWith('session.')))) return null;
    const item = typeof frame.item === 'string' ? frame.item.trim() || null : null;
    const tracker = this.#options.tracker;
    const own = (): boolean | undefined => {
      if (!tracker || item === null) return false;
      // Ownership is an indexed permission fact; request authorization never reads an item file.
      const view = tracker.summary(item);
      if (!view) return undefined; // no such item: the tool says so itself
      const actor = sessionActor(connection, UNKNOWN_SESSION);
      if (view.claim && tracker.sameSession(view.claim.sessionId, actor.id)) return true;
      if (view.assignee === null) return false;
      // the assignee as the hub bound it, by session id: a rename, or another session taking the name, moves nothing
      const store = this.#options.core.store;
      const bound = store.assigneeOf(view.id);
      if (bound && bound.name === view.assignee && bound.sessionId !== null) return bound.sessionId === actor.id;
      // an assignee the hub never bound to a session (a hand edit, an import, a name no session held yet): the first
      // session under that name to act on it is bound to it
      if (view.assignee !== connection.name) return false;
      store.bindAssignee(view.id, view.assignee, actor.id);
      return true;
    };
    return {
      tool,
      levelRefusal: this.#leadRefusal(connection, frame),
      ...(tool === 'task.plan' ? { planOp: frame.op } : {}),
      item,
      own,
      ...(type === 'session.launch' ? { launchRole: typeof frame.role === 'string' ? frame.role : typeof frame.name === 'string' ? this.#options.core.store.roleOf(frame.name) : null } : {}),
      ...(tool === 'task.edit' || tool === 'task.criterion' || tool === 'task.plan' ? {
        criterionOp: frame.op,
        status: frame.status,
        statusOnly: Object.keys(frame).every(key => ['type', 'id', 'item', 'as', 'status'].includes(key)),
        claimed: () => {
          const claim = item !== null ? tracker?.summary(item)?.claim : null;
          return !!claim && !!tracker?.sameSession(claim.sessionId, sessionActor(connection, UNKNOWN_SESSION).id);
        },
      } : {}),
      ...(tool === 'send' ? { roleNames: this.core.roleNames(), to: Array.isArray(frame.to) ? frame.to as string[] : [], toHuman: !Array.isArray(frame.to) || frame.to.length === 0, request: frame.kind === 'request', mentioned: () => this.#mentioned(connection, frame) } : {}),
      // a plain comment whose text reads back as a verdict header is a verdict to every reader, so it is one here too
      ...(tool === 'task.comment'
        ? {
            verdictCriteria: typeof frame.verdict === 'object' && frame.verdict !== null && ((frame.verdict as { verified?: unknown }).verified !== undefined || (frame.verdict as { failed?: unknown }).failed !== undefined),
            verdict: (typeof frame.verdict === 'object' && frame.verdict !== null) || (typeof frame.text === 'string' && readsAsVerdict(frame.text)),
            ...(typeof frame.verdict === 'object' && frame.verdict !== null && typeof (frame.verdict as { verdict?: unknown }).verdict === 'string' ? { verdictKind: (frame.verdict as { verdict: string }).verdict } : {}),
          }
        : {}),
    };
  }

  #artifactTopic(caller: Caller | null, topicId: string) {
    const core = this.#options.core;
    const topic = typeof topicId === 'string' ? core.store.topic(topicId) : null;
    if (!topic) throw new ArtifactError('artifact-topic', 'no such artifact topic');
    if (caller !== null && caller.role !== 'coordinator' && caller.role !== 'aide') {
      const own = topic.item !== null && this.#toolCall(caller, { type: 'task.claim', item: topic.item })?.own?.() === true;
      if (topic.id === GENERAL.id || topic.id === AGENTS.id || !(own || core.store.addressedInTopic(caller.sessionId, topic.id))) {
        throw new ToolForbidden(caller.role, 'artifact.create', 'artifacts require your own item topic or a delivered request in this topic; General and Agents are the Coordinator’s');
      }
    }
    return topic;
  }

  #suiteRank(item: string | null): number {
    const value = this.#options.tracker?.list().find(i => i.id === item);
    return value ? value.rank ?? Number(value.id.slice(2)) * 10 : Number.MAX_SAFE_INTEGER;
  }

  #suitePermissions(actor: SuiteJob['actor'], topic: string, to: string[], quiet = false): Caller | null {
    const core = this.#options.core;
    const caller = actor ? this.#asSession({ as: actor }) : null;
    if (actor && !caller) throw new Error('suite caller identity is unavailable');
    if (caller) {
      const peer: Peer = { isOpen: () => true, close: () => {}, send: () => {} };
      for (const frame of [{ type: 'artifact.create', id: 'suite-permission', topic }, { type: 'send', id: 'suite-permission', topic, to }]) {
        const call = this.#toolCall(caller, frame)!;
        const decision = decide(caller.role, core.roles?.get().get(caller.role ?? '')?.permissions.tools, call);
        if (!decision.ok) {
          if (!quiet) this.#refuse(caller, frame, peer, decision.permission, decision.reason, '', false);
          throw new ToolForbidden(caller.role, decision.permission, decision.reason);
        }
      }
    }
    this.#artifactTopic(caller, topic);
    const names = new Set([...core.presence().map(p => p.name), ...core.store.knownSessions().map(p => p.name)]);
    for (const target of to) {
      if (!names.has(target) && !core.roleNames().includes(target) && target !== 'all' && !target.includes('*') && !/^lead (?:[A-Za-z]-)?\d+$/.test(target)) throw new Error(`no suite recipient named ${target}`);
    }
    return caller;
  }

  #reportAccounting(job: Readonly<SuiteJob>): void {
    const core = this.#options.core;
    const machines = (job.shards ?? [job]).filter(source => source.machine).map(source => `${source.shardName ? source.shardName + ': ' : ''}${source.machine!.name} · ${machineAccounting(source.machine!)}`);
    const id = core.noticeTo(job.topic, { id: `suite-accounting:${job.id}`, kind: 'report', to: job.to,
      text: `suite accounting correction ${job.id} · ${machines.join('; ')}`,
      detail: { event: 'verification-accounting-confirmed', id: job.id, item: job.item ?? null } });
    if (!id) throw new Error('accounting correction topic unavailable');
    for (const entry of job.batch?.members ?? []) {
      core.noticeTo(this.#options.tracker?.summary(entry.item)?.topic ?? AGENTS.id, { id: `suite-accounting:${job.id}:${entry.item}`, kind: 'report', to: [entry.by.name, `lead ${entry.item}`], text: `suite accounting correction ${job.id} · ${machines.join('; ')}` });
    }
  }
  #reportTestSlot(waiter: TestSlotWaiter): void {
    const name = this.#options.core.store.nameOfSession(waiter.sessionId);
    if (!name) return; // The requesting session was pruned.
    this.#options.core.noticeTo(AGENTS.id, {
      id: waiter.id, kind: 'report', to: [name],
      text: `test-slot-available: local test slot released after integrated run ${waiter.cover}; retry the targeted command (admission is checked again).`,
      detail: { event: 'test-slot-available', cover: waiter.cover },
    });
  }
  async #reportSuite(job: Readonly<SuiteJob>, checkpointArtifact: (id: string) => void): Promise<void> {
    const core = this.#options.core;
    if (job.outcome?.cause.includes('cleanup incomplete: unverified inherited-pipe writer')) {
      const id = `suite-cleanup:${job.id}`;
      if (!core.store.message(id)) {
        core.store.transaction(() => {
          const recorded = core.noticeTo(AGENTS.id, { id, kind: 'report', text: core.boundedText(`verify ${job.id}: stalled; cleanup incomplete: unverified inherited-pipe writer\n${job.outcome!.cause}\nBranch ${job.branch} · head ${job.head}\nVerified processes were terminated; the queue is released. An unverified detached writer may remain.`), detail: { event: 'verification-cleanup-incomplete', id: job.id, item: job.item ?? null, topic: job.topic } });
          if (!recorded) throw new Error('cleanup warning topic is unavailable');
          this.#log({ event: 'verification-cleanup-incomplete', id: job.id, item: job.item ?? null, topic: job.topic, branch: job.branch, head: job.head, cause: job.outcome!.cause });
        });
      }
    }
    const messageId = `suite:${job.id}`;
    const platform = job.platform;
    const machine = job.machine;
    const execution = `Executor ${job.executor}${job.occasion ? ` · occasion ${job.occasion}` : ''}${job.shards ? ` · ${job.shards.length} shards` : ''}${machine ? ` · ${machine.size} ${machine.region} · ${machine.name}` : ''}${platform ? ` · ${platform.os} ${platform.arch}${job.executor === 'droplet' ? ` ${platform.release}` : ''} · Node ${platform.node} · Neovim ${platform.nvim}` : ' · platform unavailable'}${machine ? ` · ${machineAccounting(machine)}` : ''}${job.workers === undefined ? '' : ` · workers ${job.workers}`}${job.size ? ` · requested size ${job.size}` : ''}${job.cacheBypass ? `\nCache bypassed: ${job.cacheBypass}` : ''}${job.executor === 'droplet' ? '\n' + machineHealthSummary(job.health, job.shardHealth) : ''}`;
    if (job.requesterDied) {
      // A dead session's role/claim is vacated. This is a hub lifecycle note, not a tool call as that session.
      const key = `suite-death:${job.id}`;
      if (core.store.meta(key)) return;
      core.store.transaction(() => {
        const id = core.noticeTo(job.topic, { kind: 'report', to: job.to, text: core.boundedText(`suite result ${job.id}\n${job.mode} exit ${job.outcome!.code}; ${job.outcome!.cause}\nBranch ${job.branch} · head ${job.head}\n${execution}`) });
        if (!id) throw new Error('cancelled suite topic is unavailable');
        core.store.setMeta(key, id);
      });
      this.#log({ event: 'suite-result', id: job.id, item: job.item, session: job.actor?.name, topic: job.topic, branch: job.branch, head: job.head, outcome: job.outcome, cover: job.cover ?? null, counts: 'counts unavailable (requester died)', mode: job.selection?.mode ?? job.mode, executor: job.executor, platform: job.platform ?? null, machine: job.machine ?? null, health: job.health ?? null, shardHealth: job.shardHealth ?? null });
      return;
    }
    if (core.store.message(messageId)) return; // committed result wins over a crash before receipt update
    const callerNow = () => job.batch || job.devT3Probe ? null : this.#suitePermissions(job.actor, job.topic, job.to, true);
    callerNow();
    const title = `Suite ${job.id} · ${job.mode} at ${job.head.slice(0, 7)}`;
    // Artifact registration may have committed just before the hub died.
    const prior = core.store.artifacts(job.topic).find(a => a.title === title);
    let artifactId = job.artifact ?? prior?.id ?? null;
    if (!job.artifact && prior) checkpointArtifact(prior.id);
    if (!artifactId) {
      const create = () => job.batch || job.devT3Probe ? this.#batchArtifact(job, title) : this.#artifact({ type: 'artifact.create', id: job.id, kind: 'file', title, topic: job.topic, path: job.log }, callerNow, work => work(), job);
      const operation = this.#artifactQueue.then(create);
      this.#artifactQueue = operation.catch(() => {});
      const result = await operation as { id: string };
      artifactId = result.id; checkpointArtifact(artifactId);
    }
    // Child logs are separate durable artifacts; title lookup makes crash retries idempotent.
    for (const shard of job.shards ?? []) {
      const title = `Suite ${job.id} · ${shard.shardName} at ${job.head.slice(0, 7)}`;
      if (!core.store.artifacts(job.topic).some(a => a.title === title)) {
        await this.#artifact({ type: 'artifact.create', id: shard.id, kind: 'file', title, topic: job.topic, path: shard.log }, callerNow, work => work(), job);
      }
    }
    if (job.integrated && job.selection?.recordCoverage && job.outcome?.code === 0 && !job.cached) {
      const title = `Coverage map ${job.id} at ${job.head}`;
      let coverage = core.store.artifacts(job.topic).find(a => a.title === title);
      if (!coverage) {
        const create = () => this.#artifact({ type: 'artifact.create', id: `coverage:${job.id}`, kind: 'file', title, topic: job.topic, path: join(this.#options.control!.status().root!, '.cland/run/suites', job.id, 'coverage-map.json') }, callerNow, work => work(), job);
        const operation = this.#artifactQueue.then(create);
        this.#artifactQueue = operation.catch(() => {});
        const result = await operation as { id: string };
        coverage = core.store.resolveArtifact(result.id) ?? undefined;
      }
      if (!coverage || coverage.fileDeleted || coverage.status === 'archived') throw new Error('coverage artifact unavailable');
      const map = parseCoverageMap(await readFile(coverage.path, 'utf8'));
      if (map.head !== job.head || map.tree !== job.tree) throw new Error('coverage artifact provenance mismatch');
      const register = () => registerCoverageMap(this.#options.control!.status().root!, job.id,
        { artifact: coverage!.id, path: coverage!.path, head: map.head, created: map.created },
        this.#options.projectConfig?.().verification.coverageMapRetention ?? 10, this.#log);
      const operation = this.#artifactQueue.then(register);
      this.#artifactQueue = operation.catch(() => {});
      await operation;
    }
    const artifact = core.store.resolveArtifact(artifactId);
    if (!artifact || artifact.fileDeleted || artifact.status === 'archived') throw new Error('suite log artifact unavailable');
    const log = await this.#suites!.evidence(job);
    await reportSharedDefects(core, job, log, artifact, callerNow);
    await reportSoakQuarantine(core, job, log, artifact, this.#options.git ?? gitIn(job.cwd, this.#options.env));
    // Keep each member's evidence in its own topic so ordinary attachment rules apply.
    // Copy the durable artifact, not the worker log which cleanup may already have removed.
    const memberTopics = (job.batch?.members ?? []).map(entry => ({ entry, topic: this.#options.tracker?.summary(entry.item)?.topic ?? AGENTS.id }));
    const memberLogs = new Map<string, { id: string; path: string }>([[job.topic, artifact]]);
    for (const { topic } of memberTopics) {
      if (memberLogs.has(topic)) continue;
      const operation = this.#artifactQueue.then(() => this.#batchArtifact({ ...job, topic, log: artifact.path }, title));
      this.#artifactQueue = operation.catch(() => {});
      memberLogs.set(topic, await operation);
    }
    const caller = callerNow(); // all checks after the final file read, then synchronous publication
    const quarantine = recordQuarantineResults(JSON.parse(core.store.meta('quarantine-results') ?? '{}') as QuarantineHistory, job.id, quarantineResults(log), !!job.cached);
    const summary = suiteSummary(log, quarantine.lines, { logArtifact: artifact.id, outcome: job.outcome!, shards: job.shards ?? [] });
    const outcome = job.outcome!;
    const interrupted = interruptionLines(log, { timeout: outcome.code === 124 });
    const selectionFallback = job.selection?.fallback ?? (job.selection?.reason.startsWith('fetch/diff unavailable:') ? `selection fallback: full; ${job.selection.reason}` : undefined);
    const fallback = selectionFallback ? `\n${Buffer.byteLength(selectionFallback) > 512 ? `Selection fallback: full details in log ${artifact.id}` : selectionFallback}` : '';
    const deferred = taskTierEvidence(job.selection, { enabled: this.#options.projectConfig?.().merge.queue ?? false, batchTiers: this.#options.projectConfig?.().merge.batchTiers, entries: this.#mergeQueue?.entries() ?? [], batch: this.#batches?.snapshot() ?? null }, job.item ?? null);
    const progress = `${interrupted.length ? `\n${interrupted.join('\n')}` : ''}${fallback}${deferred ? `\n${deferred}` : ''}`;
    const originalExecution = job.cached ? `Original occasion ${job.cached.occasion === undefined ? 'unknown' : job.cached.occasion ?? 'none'} · executor ${job.cached.executor ?? job.executor}` : '';
    const provenance = job.cached ? `\nCached tree ${job.cached.tree}\nOriginal run ${job.cached.run} · head ${job.cached.head}\n${originalExecution}` : '';
    const missing = job.occasion === 'stage' ? this.#suites!.stageMissing(job.tree, job) : [];
    const stageCover = job.occasion === 'stage' ? `\nstage cover ${missing.length ? `missing ${missing.join(', ')}` : 'complete (Linux droplet, macOS)'} · tree ${job.tree ?? 'unknown'}` : '';
    const incompleteInfrastructure = suiteInfrastructureCauses(job).length > 0;
    const unavailableExecution = incompleteInfrastructure ? `Execution incomplete.\n${summary}` : 'No tests executed.';
    const resultText = (artifact: { id: string; path: string }): string => {
      if (outcome.notRun) return core.boundedText(`suite result ${job.id}\n${job.mode} unavailable: ${outcome.notRun === 'provider-capacity' ? 'provider capacity' : outcome.notRun}\n${outcome.cause}\n${unavailableExecution}\nBranch ${job.branch} · head ${job.head}\n${execution}\nLog ${artifact.id}: ${artifact.path}`);
      const summary = suiteSummary(log, quarantine.lines, { logArtifact: artifact.id, outcome, shards: job.shards ?? [] });
      const report = (filesBytes: number) => `suite result ${job.id}\n${job.mode} exit ${outcome.code}${outcome.cause ? `; ${outcome.cause}` : ''}${progress}\n${summary}\n${job.selection ? describeSelection(job.selection, filesBytes) : 'mode full; legacy run (selection unavailable)'}\nBranch ${job.branch} · head ${job.head}\n${execution}${provenance}${stageCover}\nLog ${artifact.id}: ${artifact.path}`;
      let text = report(2048);
      // File counts and the artifact retain the complete decision when a broad diff
      // or a smaller configured cap cannot fit every path in the topic message.
      for (let bytes = 1024; !core.textFits(text) && bytes >= 0; bytes = bytes ? Math.floor(bytes / 2) : -1) text = report(bytes);
      if (!core.textFits(text)) {
        const priority = suiteSummary(log, [], { logArtifact: artifact.id, priorityOnly: true, outcome, shards: job.shards ?? [] });
        const header = `suite result ${job.id}\n${job.mode} exit ${outcome.code}${job.cached ? '; cached' : job.cancelled ? '; cancelled' : ''}; mode ${job.selection?.mode ?? 'full'}${progress}\nLog ${artifact.id}`;
        const required = `${header}\n${execution}\n${priority}${job.cached ? `\nhead ${job.head}${provenance}` : ''}`;
        // Reserve interruption identities, cache provenance and executor facts with the decision summary;
        // optional diagnostics and metadata cannot displace those required facts.
        if (core.textFits(required)) {
          text = core.boundedText(`${required}\nBranch ${job.branch.slice(0, 64)} · head ${job.head}\n${stageCover}\nDeciding files ${job.selection?.files.length ?? 'unknown'}; full list in log ${artifact.id}\n${job.selection?.reason ?? 'legacy run (selection unavailable)'}\n${outcome.cause}\nLog ${artifact.id}: ${artifact.path}`);
        } else {
          // If the summary and cache provenance cannot fit (for example, a tiny
          // configured cap), retain the result/mode/log and execution facts.
          text = job.cached ? core.boundedText(`suite result ${job.id}\n${job.mode} exit ${outcome.code}; cached${progress}${stageCover}\n${execution}\nhead ${job.head}\nOriginal run ${job.cached.run} · head ${job.cached.head}\nTree ${job.cached.tree}\n${originalExecution}\nLog ${artifact.id}`) : core.boundedText(`suite result ${job.id}\n${job.mode} exit ${outcome.code}${job.cancelled ? '; cancelled' : ''}; mode ${job.selection?.mode ?? 'full'}${progress}${stageCover}\nBranch ${job.branch.slice(0, 64)} · head ${job.head}\n${execution}\nDeciding files ${job.selection?.files.length ?? 'unknown'}; full list in log ${artifact.id}\n${job.selection?.reason ?? 'legacy run (selection unavailable)'}\n${summary}\n${outcome.cause}${provenance}\nLog ${artifact.id}: ${artifact.path}`);
        }
      }
      return text;
    };
    const periodic = job.occasion === 'dev-t3' ? await devT3Result(job, log, artifact, this.#options.git ?? gitIn(job.cwd, this.#options.env)) : null;
    let text = resultText(artifact);
    if (periodic) {
      const root = this.#options.tracker?.root ?? this.#options.control?.status().root;
      periodic.durationWarnings = root ? await readDurationAllowanceWarnings(root, () => core.clock.now().getTime()) : [];
      const merges = periodic.merges?.slice(0, 10).map(merge => `${merge.head} ${merge.subject}`).join(', ') ?? 'unavailable';
      text = core.boundedText(`Periodic dev T3 ${periodic.result} · head ${periodic.head}\nPrevious green ${periodic.previousGreenHead ?? 'none'}\n${execution}\nLog ${artifact.id}: ${artifact.path}\n${periodic.durationWarnings.length ? periodic.durationWarnings.join('\n') + '\n' : ''}Failing files ${periodic.failingFiles.slice(0, 20).join(', ') || 'none identified'}\nMerges ${periodic.merges?.length ?? 'unknown'}: ${merges}\nComplete range and failing files in message detail\n${text}`);
      if (periodic.notRun) text = core.boundedText(`Periodic dev T3 ${incompleteInfrastructure ? 'incomplete' : 'not run'}${periodic.notRun === 'provider-capacity' ? ': provider capacity' : ` · ${periodic.notRun}`} · head ${periodic.head}\n${periodic.cause}\n${incompleteInfrastructure ? "Execution incomplete; completed receipts are retained in the log" : "No tests executed"}; retry at the next eligible tip after the interval.\nPrevious green ${periodic.previousGreenHead ?? 'none'}\n${execution}\nLog ${artifact.id}: ${artifact.path}`);
    }
    const result = core.store.transaction(() => {
      if (job.batch) {
        const id = core.noticeTo(job.topic, { id: messageId, kind: 'report', text, to: job.to });
        if (!id) throw new Error('batch suite result topic unavailable');
        for (const { entry, topic } of memberTopics) {
          core.noticeTo(topic, { id: `${messageId}:${entry.item}`, kind: 'report', text: resultText(memberLogs.get(topic)!), to: [entry.by.name, `lead ${entry.item}`] });
        }
        core.store.setMeta('quarantine-results', JSON.stringify(quarantine.history));
        return null;
      }
      if (job.occasion === 'soak' || periodic || job.devT3Probe) {
        if (!core.noticeTo(job.topic, { id: messageId, kind: 'report', to: ['coordinator'], text,
          detail: periodic ?? { event: job.devT3Probe ? 'verification-dev-t3-probe-result' : 'verification-soak-result', run: job.id, artifact: artifact.id, path: artifact.path } })) throw new Error('nightly result topic unavailable');
        if (periodic) this.#devT3Search?.accept(periodic);
        core.store.setMeta('quarantine-results', JSON.stringify(quarantine.history));
        return { message: core.store.message(messageId)! };
      }
      if (!caller && job.topic === AGENTS.id) {
        if (!core.noticeTo(job.topic, { id: messageId, kind: 'report', to: job.to, text,
          detail: { event: 'verification-result', run: job.id, artifact: artifact.id, path: artifact.path } })) throw new Error('suite result topic unavailable');
        core.store.setMeta('quarantine-results', JSON.stringify(quarantine.history));
        return { message: core.store.message(messageId)! };
      }
      const result = caller ? core.sendFromSession(caller.name, job.to, text, undefined, job.topic, undefined, caller, [artifact], 'report', messageId, true)
        : core.sendFromHuman(job.topic, text, job.to, undefined, undefined, undefined, [artifact], messageId);
      if (core.store.message(result.message.id)) core.store.setMeta('quarantine-results', JSON.stringify(quarantine.history));
      return result;
    });
    if (result && !core.store.message(result.message.id)) throw new Error('suite result had no deliverable recipient');
    this.#log({ event: 'suite-result', id: job.id, item: job.item, session: job.actor?.name ?? ((job.devT3Probe || job.occasion === 'soak' || job.occasion === 'dev-t3') ? 'hub' : undefined), topic: job.topic, branch: job.branch, head: job.head, outcome, cover: job.cover ?? null, counts: summary, mode: job.selection?.mode ?? job.mode, executor: job.executor, platform: job.platform ?? null, machine: job.machine ?? null, health: job.health ?? null, shardHealth: job.shardHealth ?? null });
    this.#log({ event: 'audit', session: (job.devT3Probe || job.occasion === 'soak' || job.occasion === 'dev-t3') ? 'hub' : caller?.name ?? HUMAN_SESSION, sessionId: caller?.sessionId ?? null, role: (job.devT3Probe || job.occasion === 'soak' || job.occasion === 'dev-t3') ? 'hub' : caller?.role ?? HUMAN_SESSION, tool: 'send', args: { topic: job.topic, to: job.to, suite: job.id, artifacts: [artifact.id] }, outcome: 'ok', client: 'suite' });
  }
  async #batchArtifact(job: Readonly<SuiteJob>, title: string): Promise<{ id: string; path: string }> {
    const core = this.#options.core, root = this.#options.control?.status().root;
    const prior = core.store.artifacts(job.topic).find(a => a.title === title && a.status !== 'archived' && !a.fileDeleted);
    if (prior) return { id: prior.id, path: prior.path };
    const artifact = await createArtifact(core.store, root, { type: 'artifact.create', id: job.id, kind: 'file', title, topic: job.topic, path: job.log },
      { name: 'hub', cwd: root ?? '.', kind: 'agent', role: () => null },
      artifact => { core.noticeTo(job.topic, { id: `batch-artifact:${job.id}:${job.topic}`, kind: 'report', text: `▣ ${artifact.id} file · ${title}`, detail: { artifact: artifact.id } }); },
      work => work(), () => {}, this.#options.readArtifact ?? readFile, core.clock, localHost());
    core.artifactChanged(artifact);
    return { id: artifact.id, path: artifact.path };
  }

  async #artifact(frame: ArtifactCreate | ArtifactList, callerNow: () => Caller | null, resumed: <T>(work: () => T) => T, suite?: Readonly<SuiteJob>, user?: { name: string; id: string } | null): Promise<unknown> {
    const caller = callerNow();
    const core = this.#options.core;
    if (frame.type === 'artifact.list') {
      if (frame.artifact !== undefined) {
        const a = core.store.resolveArtifact(frame.artifact);
        if (!a || a.fileDeleted) throw new ArtifactError('artifact-unavailable', 'no artifact file is available');
        const files = a.folder ? await folderFiles(a.path, resumed) : undefined;
        return resumed(() => {
          const current = callerNow();
          const owner = a.movedTo ? core.store.artifact(a.movedTo.folder)! : a;
          const editable = !current || current.role === 'aide' || (!core.store.humanArtifact(a) && !core.store.humanArtifact(owner));
          return { artifact: a, ...(files ? { files } : {}), editable };
        });
      }
      if (frame.topic !== undefined && (typeof frame.topic !== 'string' || !core.store.topic(frame.topic))) throw new ArtifactError('artifact-topic', 'no such artifact topic');
      return core.store.artifactPage(frame.topic, frame.before);
    }
    const authorize = () => this.#artifactTopic(callerNow(), frame.topic);
    const topic = authorize();
    const root = this.#options.control?.status().root;
    const name = caller?.name ?? (suite ? suiteAuthor(suite) : user?.name ?? 'human');
    const cwd = caller ? core.presence().find((p) => p.sessionId === caller.sessionId)?.cwd ?? root : root;
    const host = caller && !suite ? this.#sessions?.hostForSession(caller.sessionId) ?? localHost() : localHost();
    const artifact = await createArtifact(core.store, root, frame, { name, ...(caller ? { identity: caller.sessionId } : {}), ...(!caller && !suite && user ? { userId: user.id } : {}), cwd: cwd ?? '.', kind: caller || name === 'hub' ? 'agent' : 'human', role: () => callerNow()?.role ?? null }, (a) => {
      if (a.status === 'draft') return;
      const text = `▣ ${a.id} ${a.kind} · ${a.title}`;
      const current = callerNow();
      if (current) core.sendFromSession(current.name, [], text, undefined, topic.id, a, current);
      else if (suite && (name === 'hub' || topic.id === AGENTS.id)) core.noticeTo(topic.id, { kind: 'report', to: ['coordinator'], text, detail: { artifact: a.id } });
      else core.sendFromHuman(topic.id, text, undefined, undefined, undefined, a);
    }, resumed, authorize, this.#options.readArtifact ?? readFile, core.clock, this.#options.readArtifact ? { ...host, readFile: this.#options.readArtifact } : host);
    return resumed(() => {
      core.artifactChanged(artifact);
      return { artifact, id: artifact.id, path: artifact.path };
    });
  }

  async #flushHostItem(item:string, sessionId:string, reported?:string):Promise<{head:string;branch:string}|undefined>{
    const id=this.#options.tracker?.summary(item)?.id??item;
    const host=this.#sessions?.hostForSession(sessionId);
    const row=this.#options.core.store.hostWorktrees().find(row=>row.item===id);
    if((!host||host.name==='local')&&!row)return;
    if(!host||host.name==='local'||!row||row.host!==host.name)throw new Error('host-flush-refused: worktree owner unavailable; worktree HEAD unknown; territory HEAD unknown');
    const root=this.#options.tracker!.root;
    const head=await flushHostBranch(host,row,()=>territoryGitAsync(territoryPath(root),['rev-parse','--verify',`refs/heads/${row.branch}`],false,undefined,this.#options.env),reported);
    const current=this.#options.core.store.hostWorktrees().find(current=>current.item===id);
    if(!current||!hostWorktreeMatches(current,row)||current.host!==row.host||current.path!==row.path||current.branch!==row.branch||this.#sessions?.hostForSession(sessionId).name!==host.name||this.#options.tracker?.summary(id)?.branch!==row.branch)throw new Error(`host-flush-refused: worktree ownership or item branch changed; worktree HEAD ${head}; territory HEAD ${head}`);
    return {head,branch:row.branch};
  }

  open(wire: Peer, transport: { authenticated: boolean; edge: string; hostId?: string; authorizeUpload?: () => void; ownsUploadBytes?: boolean; user?: () => import('./users.ts').User | null; buildStamp?: () => string | null; webSession?: () => import('../protocol.ts').WebSessionResult; artifactUrl?: (artifact: string) => import('../protocol.ts').ArtifactUrlResult }): Conversation {
    const uploads = new Set<Promise<unknown>>();
    const core = this.#options.core;
    const log = this.#log;
    let hostId = transport.hostId;
    const closeHost = () => { done = true; wire.close(4001, 'host revoked'); };
    const trackHost = () => {
      if (!hostId) return;
      const peers = this.#hostPeers.get(hostId) ?? new Set<() => void>();
      peers.add(closeHost); this.#hostPeers.set(hostId, peers);
    };
    trackHost();
    const admittedUsers = new WeakMap<object, string>();
    // Web identity is supplied only by the authenticated upgrade/upload, never a frame.
    const humanUser = (frame?: Record<string, unknown>) => {
      if (hostId || core.store.users.mode() !== 'users') return null;
      const name = frame && (transport.edge === 'socket' || transport.edge === 'stdio') ? localUserName(frame) : undefined;
      const admitted = frame && admittedUsers.get(frame);
      const user = transport.edge === 'web' ? transport.user?.() : admitted ? core.store.users.get(admitted) : transport.edge === 'gateway' && frame && frame.type !== 'hello' ? null : name !== undefined ? core.store.users.byName(name) : core.store.users.first();
      if (name !== undefined && (!user || user.state !== 'active')) throw new Error(`cannot act as user ${JSON.stringify(name)}: user is unknown or not active`);
      if (!user && transport.edge === 'gateway') return null;
      if (!user || user.state !== 'active') throw new Error('human connection requires an active user');
      if (frame) admittedUsers.set(frame, user.id);
      return user;
    };
    const humanAudit = (frame?: Record<string, unknown>) => {
      const user = humanUser(frame);
      return { session: user?.name ?? HUMAN_SESSION, sessionId: null, role: HUMAN_SESSION, ...(user ? { userId: user.id } : {}) };
    };
    /** The calls in flight, by request id, waiting for their result to be audited. */
    const audits = new Map<string, Array<Omit<AuditRecord, 'ts' | 'event' | 'outcome'>>>();
    const settle = (frame: HubFrame) => {
      if (frame.type !== 'result') return;
      const queue = audits.get(frame.id);
      const base = queue?.shift();
      if (!base) return;
      if (!queue?.length) audits.delete(frame.id);
      const outcome: AuditOutcome = frame.ok ? 'ok' : frame.code === 'forbidden' ? 'forbidden' : 'error';
      log({
        event: 'audit',
        ...base,
        outcome,
        ...(!frame.ok && frame.code === 'forbidden' ? { permission: frame.permission, reason: frame.reason } : {}),
        ...(!frame.ok && outcome === 'error' ? { error: frame.error.slice(0, 200) } : {}),
      });
    };
    const audit = (id: unknown, base: Omit<AuditRecord, 'ts' | 'event' | 'outcome'>) => {
      if (typeof id !== 'string') return;
      const queue = audits.get(id) ?? [];
      queue.push(base);
      audits.set(id, queue);
    };
    const guard = this.#guard.conversation();
    // every result passes the audit on its way out, and a read's answer is kept for a repeat
    const peer: Peer = {
      send: (frame) => {
        settle(frame);
        wire.send(core.visibility.frame(frame));
        for (const repeated of guard.answered(frame)) peer.send(repeated);
      },
      close: (code, reason) => wire.close(code, reason),
      isOpen: () => wire.isOpen(),
    };
    let client = '';
    let kind: 'spoke' | 'client' | null = null;
    let done = false;
    let credentialPending = false;
    let humanSlot = false;
    let name: string | null = null;
    let spoke: SpokeSocket | null = null;
    let connection: Connection | null = null;
    /** A client's event subscription, ended when the connection closes. */
    let unsubscribe: (() => void) | null = null;
    let features: import('../protocol.ts').ClientFeature[] = [];
    const modelOutput = new ModelOutput(wire);
    let preparingSnapshot = false;
    let modelGeneration = 0;
    let subscriptionRequested = false;
    let eventsFilter: import('../protocol.ts').EventsFilter | undefined;
    const filterModel = (frame: HubFrame): HubFrame | null => {
      if (frame.type !== 'event' || !eventsFilter || core.eventsMatch(eventsFilter)(frame.row)) return frame;
      return 'seq' in frame ? { type: 'model.advance', epoch: frame.epoch, seq: frame.seq } : null;
    };
    let holdingModel = false;
    const heldModel: Array<{ frame: HubFrame; serialized: () => string }> = [];
    const sendModel = (frame: HubFrame, serialized: () => string) => {
      if (done || !peer.isOpen()) return;
      const filtered = filterModel(frame);
      if (!filtered) return;
      if (filtered !== frame) serialized = () => JSON.stringify(filtered);
      frame = filtered;
      if (features.includes('numbered-deltas')) modelOutput.send(frame, serialized);
      else wire.send(frame, serialized());
    };
    const subscribeModel = () => {
      if (done || unsubscribe || preparingSnapshot) return;
      // Legacy hello and subscribe are separate requests. Capture replacement
      // facts and register synchronously, then hold reentrant publications until
      // the replacements are sent. Numbered clients use snapshot/resume instead.
      const replay: HubFrame[] = !hostId && !features.includes('numbered-deltas') ? [
        { type: 'presence', sessions: core.presence() },
        { type: 'remote.state', remotes: core.remoteState() },
        { type: 'hosts.state', pools: core.hostsState() },
      ] : [];
      const wasHolding = holdingModel;
      if (replay.length) holdingModel = true;
      const generation = modelGeneration;
      unsubscribe = core.subscribeClient(features, (frame, serialized) => {
        // Fan-out may have captured this callback before a reentrant resume replaced it.
        if (done || generation !== modelGeneration) return;
        if (holdingModel) heldModel.push({ frame, serialized });
        else sendModel(frame, serialized);
      });
      try { for (const frame of replay) peer.send(frame); }
      finally { if (replay.length && !wasHolding) releaseModel(); }
    };
    const releaseModel = () => {
      // Keep holding during drain: a synchronous peer can itself publish a new delta.
      for (let next; (next = heldModel.shift());) sendModel(next.frame, next.serialized);
      holdingModel = false;
    };
    const snapshotFinished = (complete: boolean) => {
      preparingSnapshot = false;
      if (subscriptionRequested || complete && features.includes('numbered-deltas')) subscribeModel();
    };
    const startSnapshot = (completed?: (complete: boolean) => void) => {
      preparingSnapshot = true;
      const generation = ++modelGeneration;
      const finish = (complete: boolean) => {
        snapshotFinished(complete);
        completed?.(complete);
      };
      // Disk inputs are prepared before composition. Journal revisions fence the page read.
      const prepare = async () => {
        const registry = await readAccounts(this.#options.env);
        for (let attempt = 0; attempt < 3 && peer.isOpen(); attempt++) {
          const journal = this.#options.journal;
          const revision = journal?.revision;
          const filter = eventsFilter;
          const events = journal ? await journal.events(undefined, undefined, core.eventsProject(filter)) : { rows: [], before: null, more: false };
          if (done || generation !== modelGeneration) return;
          if (journal?.revision !== revision || filter !== eventsFilter) continue;
          // No await below: composition, subscription and the transaction occupy one turn.
          const result = snapshotFrames(composeSnapshot({
            core, tracker: this.#options.tracker, sessions: this.#sessions ?? null,
            verification: this.#suites ? { ...this.#suites.snapshot(), batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } } : null,
            events, registry,
          }), core.modelCursor().epoch, core.modelCursor().seq);
          if (!peer.isOpen()) return;
          if ('refusal' in result) {
            log({ event: 'snapshot-refused', ...result.refusal }); peer.send(result.refusal); finish(false);
          } else {
            holdingModel = true;
            preparingSnapshot = false;
            if (subscriptionRequested || features.includes('numbered-deltas')) subscribeModel();
            let complete = true;
            for (const frame of result.frames) {
              if (features.includes('numbered-deltas')) {
                if (!modelOutput.send(frame)) { complete = false; break; }
              } else peer.send(frame);
            }
            releaseModel();
            finish(complete);
          }
          return;
        }
        if (done || generation !== modelGeneration) return;
        if (peer.isOpen()) peer.send({ type: 'snapshot.refused', code: 'unavailable', message: 'journal changed during snapshot preparation; retry or use individual reads' });
        finish(false);
      };
      void prepare().catch(() => {
        if (done || generation !== modelGeneration) return;
        releaseModel();
        if (peer.isOpen()) peer.send({ type: 'snapshot.refused', code: 'unavailable', message: 'snapshot preparation failed; use individual reads' });
        finish(false);
      });
    };
    const resumeModel = (cursor: { epoch: string; seq: number }, completed?: (replayed: boolean) => void) => {
      unsubscribe?.(); unsubscribe = null;
      ++modelGeneration;
      preparingSnapshot = false;
      modelOutput.resume();
      const replay = core.resumeModel(cursor.epoch, cursor.seq, features);
      if (replay !== null) {
        holdingModel = true;
        subscribeModel();
        let complete = true;
        for (const json of replay) {
          const frame = eventsFilter ? filterModel(JSON.parse(json) as HubFrame) : null;
          if (!(frame ? modelOutput.send(frame) : modelOutput.replay(json))) { complete = false; break; }
        }
        releaseModel();
        completed?.(complete);
      } else if (features.includes('snapshot')) startSnapshot(() => completed?.(false));
      else {
        modelOutput.pause('snapshot-required');
        completed?.(false);
      }
    };
    /** What else ends with the connection (an in-session bridge). */
    const onClose: Array<() => void> = [];
    const loginSignIns = new Map<string, LoginSignIn>();
    const loginClosing = () => {
      for(const pending of loginSignIns.values()) {
        const work=pending.interrupt?.()??pending.complete(null);
        this.#poolPrepares.add(work);
        void work.finally(()=>this.#poolPrepares.delete(work)).catch(error=>this.#log({event:'login-cleanup-incomplete',name:pending.name,error:String(error)}));
      }
    };
    onClose.push(loginClosing);
    /** A result that comes later (Git work): its answer going out is timed against the budget as `answer`. */
    const later = (tool: string, result: Promise<HubFrame>): void =>
      void result.then((frame) =>
        this.#guard.measure(tool, kind === 'spoke' ? (name ?? '?') : client, () => {
          if (peer.isOpen()) peer.send(frame);
          else settle(frame);
        }, 'answer'),
      );
    const artifact = (frame: ArtifactCreate | ArtifactList, callerNow: () => Caller | null) => {
      const tool = frame.type;
      const who = kind === 'spoke' ? (name ?? '?') : client;
      const resumed = <T,>(work: () => T): T => this.#guard.measure(tool, who, work, 'resumed');
      const original = callerNow();
      const authorizeCaller = () => {
        const current = callerNow();
        if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, tool, 'the session is no longer current');
        if (current && !this.#permitted(current, frame as unknown as Record<string, unknown>, peer, false)) throw new ToolForbidden(current.role, tool, 'permission changed during artifact preparation');
        return current;
      };
      const run = () => this.#artifact(frame, authorizeCaller, resumed, undefined, original ? null : humanUser(frame));
      const operation = frame.type === 'artifact.create' ? this.#artifactQueue.then(() => resumed(run)) : run();
      if (frame.type === 'artifact.create') this.#artifactQueue = operation.catch(() => resumed(() => {}));
      later(tool, operation.then(value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value } as HubFrame)), err => resumed(() => Dispatcher.#failure(frame.id, err))));
    };
    const attachedSend = (frame: Record<string, unknown>, callerNow: () => Caller | null) => {
      const tool = String(frame.type);
      const resumed = <T,>(work: () => T): T => this.#guard.measure(tool, kind === 'spoke' ? (name ?? '?') : client, work, 'resumed');
      const original = callerNow();
      const prompt = tool === 'prompt.send';
      const topicId = prompt ? core.store.artifact(String(frame.artifact))?.topic : (typeof frame.topic === 'string' ? frame.topic : (Array.isArray(frame.to) && frame.to.length ? AGENTS.id : GENERAL.id));
      const ids = prompt ? [frame.artifact] : frame.artifacts;
      const check = () => {
        const caller = callerNow();
        if (original && (!caller || caller.sessionId !== original.sessionId)) throw new ToolForbidden(null, 'send', 'the session is no longer current');
        if (caller) this.#requirePermission(caller, { ...frame, type: 'send' }, peer);
        if (!Array.isArray(ids) || !ids.length || !ids.every(id => typeof id === 'string')) throw new ArtifactError('artifact-source', 'artifacts must be a nonempty array of ids');
        const artifacts = ids.map(id => {
          const a = core.store.resolveArtifact(id);
          if (!a || a.status === 'archived' || a.topic !== topicId) throw new ArtifactError('artifact-unavailable', `artifact ${id} is unavailable in this topic`);
          if (prompt && (a.movedTo || a.kind !== 'prompt' || a.status !== 'draft' || !(a.creatorKind === 'human' || (a.creatorKind === undefined && a.creator === 'human')))) throw new ArtifactError('artifact-unavailable', 'only a human prompt draft can be sent here');
          return a;
        });
        return { caller, artifacts };
      };
      const operation = async (): Promise<HubFrame> => {
        try {
          const prepared = check();
          // Reserve the intended ids/topic/caller before I/O; no post or status is changed yet.
          const contents = await Promise.all(prepared.artifacts.map(a => this.#options.readArtifact ? this.#options.readArtifact(artifactEntry(a)) : readFile(artifactEntry(a))));
          const files = await resumed(() => {
            check();
            return Promise.all(prepared.artifacts.map(a => stat(artifactEntry(a))));
          });
          return resumed(() => {
            if (!files.every(info => info.isFile())) throw new ArtifactError('artifact-unavailable', 'an attachment file is unavailable');
            // Re-read availability, topic, draft status and caller permissions after final file I/O, then post without yielding.
            const { caller, artifacts } = check();
            if (artifacts.some((a, i) => a.path !== prepared.artifacts[i]?.path)) throw new ArtifactError('artifact-unavailable', 'an attachment path changed during preparation');
            const saved = contents[0]!.toString('utf8');
            const text = prompt ? (frame.attach === true || !core.textFits(saved) ? core.boundedText(`Prompt ${artifacts[0]!.id}: ${artifacts[0]!.title}`) : saved) : frame.text;
            if (typeof text !== 'string') throw new ArtifactError('artifact-source', 'send needs text');
            const reply = typeof frame.replyTo === 'string' ? frame.replyTo : undefined;
            const to = Array.isArray(frame.to) ? frame.to as string[] : undefined;
            const value = caller ? core.sendFromSession(caller.name, to ?? [], text, reply, topicId, undefined, caller, artifacts, frame.kind, undefined, false, undefined, frame.request, frame.subject)
              : core.sendFromHuman(topicId!, text, to, reply, undefined, undefined, artifacts, undefined, undefined, frame.kind as import('../protocol.ts').HumanMessageKind | undefined, undefined, false, humanUser(frame)?.id);
            return { type: 'result', id: String(frame.id), ok: true, value };
          });
        } catch (err) { return resumed(() => Dispatcher.#failure(String(frame.id), err)); }
      };
      later(tool, operation());
    };
    // a task request's answer may wait for Git (a verdict's commit, a claim's worktree), never on the event loop; every
    // stretch it runs on the loop is timed against the budget: the first in `receive`, the writes after Git answered,
    // the answer going out
    const task = (frame: TaskRequest, actor: Actor | 'client', callerNow?: () => Caller | null) => {
      const tool = String(frame.type);
      const who = kind === 'spoke' ? (name ?? '?') : client;
      const resumed = <T,>(write: () => T): T => this.#guard.measure(tool, who, write, 'resumed');
      const currentActor = callerNow ? () => {
        const caller = callerNow();
        if (!caller) throw new ToolForbidden(null, 'task.comment', 'the writing session is no longer current');
        const call = this.#toolCall(caller, frame as unknown as Record<string, unknown>);
        const roles = core.roles;
        if (roles && call) {
          const grants = caller.role === null ? undefined : roles.get().get(caller.role)?.permissions.tools;
          const decision = decide(caller.role, grants, call);
          if (!decision.ok) {
            this.#refuse(caller, frame as unknown as Record<string, unknown>, peer, decision.permission, decision.reason, ` ${frame.type === 'task.comment' ? frame.item : ''}`, false);
            throw new ToolForbidden(caller.role, decision.permission, decision.reason);
          }
        }
        return sessionActor(caller, UNKNOWN_SESSION);
      } : undefined;
      const admission=async()=>{
        if(frame.type==='task.edit'&&frame.status==='ready'&&callerNow){
          const caller=callerNow();currentActor?.();
          if(caller)await this.#flushHostItem(frame.item,caller.sessionId,frame.worktreeHead);
          currentActor?.();
        }
        return answerTask(this.#options.tracker, frame, actor, resumed, currentActor);
      };
      void admission()
        .then(async (result) => {
          if (frame.type === 'task.view' && result.type === 'result' && result.ok && this.#options.journal) {
            const value = result.value as { item: ItemView };
            const subagents = await this.#options.journal.subagents(value.item.id);
            result = resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { ...value, item: { ...value.item, usage: { subagents } } } }));
          }
          this.#bindAssignee(frame as unknown as Record<string, unknown>, result);
          return this.#withWorktree(frame, result, resumed);
        })
        // what fails after the answer is known (the assignee's binding) is that request's failure, never the hub's
        .catch((err: unknown) => Dispatcher.#failure(frame.id, err))
        .then((result) =>
          this.#guard.measure(tool, who, () => {
            if (peer.isOpen()) peer.send(result);
            else settle(result);
          }, 'answer'),
        );
    };
    const merge = (frame: import('../protocol.ts').MergeRequest, caller: Caller | null) => {
      if (caller !== null && frame.override !== undefined) return this.#refuse(caller, frame, peer, 'merge', 'only the human may override verdicts');
      if (frame.override !== undefined && !frame.override.trim()) return peer.send(Dispatcher.#failure(frame.id, new MergeError('merge-item', 'an override needs a reason')));
      if (!this.#merges) return peer.send(Dispatcher.#failure(frame.id, new MergeError('merge-item', 'this hub has no tracker')));
      const actor = caller ? sessionActor(caller, UNKNOWN_SESSION) : { id: 'human', name: 'human', role: null };
      const resumed = <T,>(write: () => T): T => this.#guard.measure('merge', kind === 'spoke' ? (name ?? '?') : client, write, 'resumed');
      const authorize = () => {
        if (!caller || !core.roles) return;
        const now = kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame);
        if (!now || now.sessionId !== caller.sessionId) throw new ToolForbidden(now?.role ?? null, 'merge', 'the calling session is no longer current');
        const call = this.#toolCall(now, frame)!;
        const decision = decide(now.role, core.roles?.get().get(now.role ?? '')?.permissions.tools, call);
        if (!decision.ok) {
          this.#refuse(now, frame, peer, decision.permission, decision.reason, '', false);
          throw new ToolForbidden(now.role, decision.permission, decision.reason);
        }
      };
      if (frame.cancel) {
        if (frame.override !== undefined) return peer.send(Dispatcher.#failure(frame.id, new MergeError('merge-item', 'cancel cannot be combined with override')));
        return later('merge', this.#worktrees!.serial(async () => resumed(() => {
          authorize();
          return { type: 'result', id: frame.id, ok: true, value: this.#mergeQueue!.cancel(frame.item) } as HubFrame;
        })).catch((err: unknown) => Dispatcher.#failure(frame.id, err)));
      }
      later('merge', this.#merges.merge(frame.item, actor, resumed, frame.override, authorize).then(
        (value): HubFrame => resumed(() => { this.#guard.changed(); return { type: 'result', id: frame.id, ok: true, value }; }),
        (err: unknown) => Dispatcher.#failure(frame.id, err),
      ));
    };
    const artifactChange = (frame: ArtifactKeep | ArtifactArchive | ArtifactMove, callerNow: () => Caller | null) => {
      const original = callerNow();
      const resumed = this.#guard.resumer(frame.type, kind === 'spoke' ? (name ?? '?') : client);
      const authorize = () => {
        const current = callerNow();
        if (original && (!current || current.sessionId !== original.sessionId)) throw new ToolForbidden(null, frame.type, 'the session is no longer current');
        if (current && !this.#permitted(current, frame as unknown as Record<string, unknown>, peer, false)) throw new ToolForbidden(current.role, frame.type, 'permission changed during artifact preparation');
        for (const id of [frame.artifact, ...(frame.type === 'artifact.move' ? [frame.folder] : [])]) {
          const a = core.store.artifact(id);
          if (!a) throw new ArtifactError('artifact-unavailable', 'no such artifact');
          if (current && current.role !== 'aide' && core.store.humanArtifact(a)) throw new ToolForbidden(current.role, frame.type, 'agents cannot change the human’s or an Aide’s artifacts');
        }
      };
      try {
        authorize();
        if (frame.type === 'artifact.move') {
          later(frame.type, this.artifacts.move(frame.artifact, frame.folder, frame.name, authorize, resumed).then(
            value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
            err => resumed(() => Dispatcher.#failure(frame.id, err)),
          )); return;
        }
        if (frame.type === 'artifact.keep' && frame.kept !== undefined && typeof frame.kept !== 'boolean') throw new ArtifactError('artifact-source', 'kept must be a boolean');
        peer.send({ type: 'result', id: frame.id, ok: true, value: { artifact: frame.type === 'artifact.keep' ? this.artifacts.keep(frame.artifact, frame.kept ?? true) : this.artifacts.archive(frame.artifact) } });
      } catch (err) { peer.send(Dispatcher.#failure(frame.id, err)); }
    };
    const promote = (frame: ArtifactPromote, caller: Caller | null) => {
      const resumed = <T,>(body: () => T): T => this.#guard.measure(frame.type, client, body, 'resumed');
      const authorize = () => {
        if (!caller) return;
        const now = kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame);
        const a = core.store.artifact(frame.artifact);
        if (a && core.store.humanArtifact(a) && now?.role !== 'aide') throw new ToolForbidden(now?.role ?? null, frame.type, 'agents cannot change the human’s or an Aide’s artifacts');
        const grants = core.roles?.get().get(now?.role ?? '')?.permissions.tools;
        const decision = decide(now?.role ?? null, grants, { tool: frame.type });
        if (!now || now.sessionId !== caller.sessionId || !decision.ok || !(now.role === 'aide' || (client === 'cli' && now.role === 'coordinator'))) throw new ToolForbidden(now?.role ?? null, frame.type, 'promotion belongs to the human, an Aide, or the Coordinator from its own shell');
      };
      later(frame.type, this.artifacts.promote(frame.artifact, frame.path, authorize, resumed).then(
        value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
        err => resumed(() => Dispatcher.#failure(frame.id, err)),
      ));
    };
    const session = (frame: Parameters<typeof answerSession>[1]) => {
      const original = kind === 'spoke' ? connection : this.#asSession(frame);
      // Item admission needs the effective role before preparing a worktree. Keep the original
      // frame for permission checks, and recheck an inferred assignment across launch awaits.
      const inferred = frame.type === 'session.launch' && frame.item !== undefined && frame.role === undefined;
      const inferredRole = inferred ? core.store.roleOf(frame.name) : null;
      const launchFrame = inferred && inferredRole !== null ? { ...frame, role: inferredRole } : frame;
      const validateCaller = (current: Caller | null) => this.#validateSessionCaller(frame, original, current, peer, inferred ? inferredRole : undefined);
      const authorize = () => validateCaller(kind === 'spoke' ? (connection && core.isCurrent(connection) ? connection : null) : this.#asSession(frame));
      // The accepted wait belongs to the admitted identity, independently of its original transport.
      const retainedAuthorize = () => validateCaller(original ? this.#asSession({ as: { name: original.name, sessionId: original.sessionId, shell: true } }) : null);
      void answerSession(
        this.#sessions,
        launchFrame,
        { send: (f) => peer.send(f), isOpen: () => peer.isOpen(), onClose: (fn) => onClose.push(fn) },
        this.#worktrees ?? undefined,
        (write) => this.#guard.measure(frame.type, kind === 'spoke' ? (name ?? '?') : client, write, 'resumed'),
        authorize,
        original?.name ?? 'human',
        retainedAuthorize,
        original ? { name: original.name, sessionId: original.sessionId } : null,
        inferred ? inferredRole : undefined,
        original ? undefined : humanUser(frame)?.id,
      ).then((result) => {
        if (peer.isOpen()) peer.send(result);
        else settle(result);
      });
    };

    const refuse = (code: RefusalCode, message: string) => {
      if (done) return;
      done = true;
      clearTimeout(helloTimer);
      peer.send({ type: 'error', code, message, ...(transport.edge === 'web' && code === 'version' ? { action: 'restart-hub' as const } : {}) });
      peer.close(4000, code);
    };
    const helloTimer = setTimeout(() => {
      if (kind === null || credentialPending) refuse('bad-hello', credentialPending ? 'session credential preparation timed out; reconnect its own MCP spoke' : 'no hello received');
    }, this.#options.helloTimeoutMs ?? 5000);

    const hello = (frame: Record<string, unknown>) => {
      if (!transport.authenticated && typeof frame.secret === 'string' && !secretMatches(frame.secret, this.#options.secret)) {
        const host = this.hostAdmission(frame.secret);
        if (host?.state === 'revoked') return refuse('unauthorized', 'host secret revoked');
        if (host && transport.edge === 'socket') { hostId = host.id; trackHost(); }
      }
      if (hostId && core.store.hosts.get(hostId)?.state !== 'registered') return refuse('unauthorized', 'host secret revoked');
      if (!transport.authenticated && !hostId && !(typeof frame.secret === 'string' && secretMatches(frame.secret, this.#options.secret))) {
        log({ event: 'refused', edge: transport.edge, code: 'unauthorized' });
        return refuse('unauthorized', "the secret does not match this project's hub");
      }
      if ((transport.edge === 'web' || transport.edge === 'gateway') && (!isClientHello(frame) || Object.hasOwn(frame, 'sessionId'))) {
        return refuse('bad-hello', `the ${transport.edge} edge accepts only a client hello`);
      }
      if (isHello(frame)) {
        let admittedHello = frame;
        let admittedLaunch: LaunchIdentityProof | undefined;
        if (hostId) {
          const token = frame.launchToken;
          if (!token) return refuse('unauthorized', 'host spoke requires a session launch credential');
          const binding = core.resolveLaunchIdentity(token, frame.sessionId);
          if (binding && ('refusal' in binding || frame.sessionId !== UNKNOWN_SESSION && frame.sessionId !== binding.sessionId
            || frame.name !== undefined && frame.name !== binding.name))
            return refuse('unauthorized', 'host launch credential does not prove the requested session');
          const id = binding ? binding.sessionId : frame.sessionId;
          const row = this.#sessions?.hostSession(id);
          const pending = binding ? this.#sessions?.hostLaunch(token) : null;
          const authority = row ?? pending;
          const retained = core.store.sessionCredential(id);
          if (!authority || authority.host !== hostId || authority.role === null || (!binding && !(retained && secretMatches(token, retained))))
            return refuse('unauthorized', 'host spoke requires its own role-holding session launch credential');
          // core.hello must receive the very identity proved above, including anonymous early hellos.
          if (binding) { admittedHello = { ...frame, sessionId: binding.sessionId, name: binding.name }; admittedLaunch = binding; }
        }
        credentialPending = true;
        const deliver = (message: Message): boolean => {
          if (credentialPending || !peer.isOpen()) return false;
          const topic = message.topic !== undefined ? core.topicRef(message.topic) : null;
          peer.send({ type: 'deliver', id: message.id, message, ...(topic ? { topic } : {}) });
          return true;
        };
        const deliverRole = (message: Message, clause: RoleClause): boolean => {
          if (credentialPending || !peer.isOpen()) return false;
          peer.send({ type: 'role', id: message.id, message, ...clause });
          return true;
        };
        const result = core.hello(admittedHello, deliver, (reason, code) => peer.close(code ?? 4001, reason), deliverRole, admittedLaunch);
        if (!result.ok) {
          log({ event: 'refused', edge: transport.edge, code: result.code, requested: frame.name ?? null });
          return refuse(result.code, result.message);
        }
        kind = 'spoke';
        // presence moved: `who` and `hub.status` answer anew
        this.#guard.changed();
        name = result.name;
        if (hostId && result.connection.role === null) {
          core.disconnect(result.connection);
          return refuse('no-role', 'host spoke requires a role-holding session');
        }
        connection = result.connection;
        spoke = result.spoke;
        const finish = () => {
          if (done || !peer.isOpen()) return;
          if (!core.isCurrent(result.connection)) return refuse('bad-hello', 'the session changed during credential preparation; reconnect its own MCP spoke');
          credentialPending = false;
          clearTimeout(helloTimer);
          name = result.connection.name;
          peer.send({ type: 'welcome', name, presence: core.presence(), ...(result.connection.role !== null ? { role: result.connection.role } : {}) });
          core.flushQueued(name);
        };
        const resumed = this.#guard.resumer('hello', result.name);
        try {
          const preparing = core.prepareShellCredential(result.connection.sessionId, frame.launchToken);
          if (preparing) void preparing.then(() => resumed(finish), () => resumed(() => {
            log({ event: 'session-credential-unavailable', sessionId: result.connection.sessionId });
            refuse('bad-hello', `session "${result.name}" credential preparation failed; reconnect its own MCP spoke`);
          }));
          else finish();
        } catch {
          refuse('bad-hello', `session "${result.name}" credential preparation failed; reconnect its own MCP spoke`);
        }
        return;
      }
      if (isClientHello(frame)) {
        if (hostId && (frame.resume || frame.features?.length)) return refuse('unauthorized', 'host clients require session-scoped requests');
        clearTimeout(helloTimer);
        if (frame.protocol !== PROTOCOL_VERSION) return refuse('version', `protocol ${frame.protocol} is not the hub's ${PROTOCOL_VERSION} — ${transport.edge === 'web' ? 'restart the hub to use this page' : UPDATE_HINT}`);
        // the human's side comes over the Unix socket or stdio: the spokes' WebSocket never makes a client (with
        // the spokes' bearer secret, a session would otherwise act as the human, unrestricted by its role). A hub with
        // no human side (`createHub`, no `control`: the in-process hub of the tests) has no other way in for a client.
        if (transport.edge === 'websocket' && this.#options.control !== undefined) {
          log({ event: 'refused', edge: transport.edge, code: 'unauthorized', client: frame.client });
          return refuse('unauthorized', "a client connects over the hub's Unix socket or stdio, not the spokes' WebSocket");
        }
        kind = 'client';
        client = transport.edge === 'web' || transport.edge === 'gateway' ? HUMAN_SESSION : frame.client;
        log({ event: 'client', edge: transport.edge, client: frame.client });
        features = (['snapshot', 'numbered-deltas', 'slim-frames'] as const).filter(feature => frame.features?.includes(feature));
        if (frame.resume && !features.includes('numbered-deltas')) return refuse('bad-hello', 'resume requires numbered-deltas');
        peer.send({ type: 'welcome', name: humanUser(frame)?.name ?? client, presence: core.presence(), ...(frame.features !== undefined || transport.edge === 'web' ? { features } : {}), ...(transport.buildStamp ? { buildStamp: transport.buildStamp() } : {}) });
        if (!hostId && !features.includes('snapshot') && !frame.resume) peer.send({ type: 'remote.state', remotes: core.remoteState() });
        if (!hostId && !features.includes('snapshot') && !frame.resume) peer.send({ type: 'hosts.state', pools: core.hostsState() });
        if (frame.resume) resumeModel(frame.resume);
        else if (features.includes('snapshot')) startSnapshot();
        else if (features.includes('numbered-deltas') || transport.edge === 'gateway') subscribeModel();
        return;
      }
      refuse('bad-hello', 'first frame must be a hello');
    };

    const subscriptionRequest = (frame: SubscriptionRequest, caller: Caller | null): void => {
      try {
        if (!caller || caller.sessionId === UNKNOWN_SESSION) throw new Error('subscriptions require a known session; use --as <session> from the human CLI');
        let value: unknown;
        switch (frame.type) {
          case 'event.subscribe': {
            const input = subscriptionInput(frame.subject, frame.events, frame.digest, frame.threshold, this.#options.tracker ? [...this.#options.tracker.kinds, 'category'] : undefined);
            const subject = input.subject;
            const itemId = 'item' in subject ? subject.item : 'subtree' in subject ? subject.subtree : null;
            if (itemId && !this.#options.tracker?.resolveId(itemId)) throw new Error(`no item ${itemId}`);
            if ('topic' in subject && !core.store.topic(subject.topic)) throw new Error(`no topic ${subject.topic}`);
            if ('role' in subject && !core.roleNames().includes(subject.role)) throw new Error(`unknown role ${subject.role}`);
            value = { subscription: core.store.addSubscription(caller.sessionId, { id: randomUUID(), ...input }) };
            break;
          }
          case 'event.unsubscribe':
            if (typeof frame.subscription !== 'string' || !frame.subscription) throw new Error('unsubscribe needs a subscription id');
            value = { removed: core.store.removeSubscription(caller.sessionId, frame.subscription) };
            break;
          case 'event.subscriptions':
            value = { subscriptions: core.subscriptions().filter(s => s.subscriberId === caller.sessionId).map(({ subscriberId: _, ...s }) => s) };
        }
        if (frame.type !== 'event.subscriptions') this.#guard.changed();
        peer.send({ type: 'result', id: frame.id, ok: true, value });
      } catch (err) { peer.send(Dispatcher.#failure(frame.id, err)); }
    };

    const spokeRequest = (frame: Record<string, unknown>, me: string) => {
      if (!isSpokeRequest(frame)) {
        peer.send(requestValidationFailure(frame, true));
        return;
      }
      try {
        switch (frame.type) {
          case 'rule.add':
          case 'rule.edit':
          case 'rule.retire':
          case 'rule.list': {
            const rules = core.rules;
            if (!rules) throw new Error('this hub has no rulebook');
            if (frame.type === 'rule.list') {
              if (frame.role !== undefined && !core.roles?.get().has(frame.role)) throw new Error(`unknown role ${frame.role}`);
              return peer.send({ type: 'result', id: frame.id, ok: true, value: { rules: rules.get().filter(rule => (frame.all || rule.status === 'active') && (frame.role === undefined || rule.scope === 'all' || rule.scope.includes(frame.role))) } });
            }
            const caller = connection!;
            const originOf = () => {
              if (!core.isCurrent(caller)) throw new ToolForbidden(caller.role, frame.type, 'rule writer disconnected; retry from the current session');
              this.#requirePermission(caller, frame, peer);
              if (caller.role === 'aide') return `session:${caller.name}`;
              const origin = frame.origin;
              const message = origin && typeof origin === 'object' && typeof origin.msg_id === 'string' ? core.store.message(origin.msg_id) : null;
              if (caller.role !== 'coordinator' || !message || message.fromKind !== 'human' || typeof origin !== 'object' || message.topic !== origin.topic)
                throw new ToolForbidden(caller.role, frame.type, 'origin must name an existing human message by topic and msg_id');
              return `message:${origin.topic}/${origin.msg_id}`;
            };
            const origin = originOf();
            const authorize = () => { if (originOf() !== origin) throw new ToolForbidden(caller.role, frame.type, 'rule writer changed; retry'); };
            const resumed = this.#guard.resumer(frame.type, caller.name);
            const writing = frame.type === 'rule.add' ? rules.add({ ...frame, origin }, resumed, authorize)
              : frame.type === 'rule.edit' ? rules.edit(frame.number, { ...frame, origin }, resumed, authorize)
              : rules.retire(frame.number, frame.reason, resumed, authorize, origin);
            return later(frame.type, writing.then(rule => resumed(() => {
              this.#guard.changed();
              return { type: 'result' as const, id: frame.id, ok: true, value: { rule } };
            }), error => resumed(() => Dispatcher.#failure(frame.id, error))));
          }
          case 'rule.show': throw new Error('use rule.list to read rules');
          case 'merge.queue':
            return later('merge.queue', (this.#mergeQueue?.refresh() ?? Promise.resolve([])).then(entries => ({ type: 'result', id: frame.id, ok: true, value: { entries, batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } } })));
          case 'merge':
            return merge(frame, connection);
          case 'artifact.promote':
            if (connection?.role === 'aide') return promote(frame, connection);
            throw new ToolForbidden(connection?.role ?? null, frame.type, 'promote from the Coordinator’s shell with cland artifact promote');
          case 'artifact.keep':
          case 'artifact.archive':
          case 'artifact.move':
            return artifactChange(frame, () => connection && core.isCurrent(connection) ? connection : null);
          case 'artifact.create':
          case 'artifact.list':
            return artifact(frame, () => connection && core.isCurrent(connection) ? connection : null);
          case 'verification.decline':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.declineVerification(connection!, frame.request, frame.reason) });
            break;
          case 'who':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { me, sessions: core.presence() } });
            break;
          case 'history':
            // with a topic: that topic's messages (a new role holder reads the topics waiting for it, #31)
            peer.send({ type: 'result', id: frame.id, ok: true, value: { messages: frame.topic !== undefined ? core.topicHistory(frame.topic, frame.limit, frame).messages : core.history(me, frame.limit, frame.with) } });
            break;
          case 'role.handover': {
            const role = connection?.role ?? null;
            if (role === null) throw new Error('this session holds no role to hand over');
            const holder = handOver(this.#handover(), { role, from: me, to: frame.to, by: me, note: frame.note, noteRequired: true, then: frame.then ?? null, requireKnown: true });
            peer.send({ type: 'result', id: frame.id, ok: true, value: { session: holder } });
            break;
          }
          case 'role.state': {
            // a session reads the state of the role it holds: what it continues from
            const role = frame.role ?? connection?.role ?? null;
            if (role === null || role !== connection?.role) {
              const reason = role === null ? 'a session with no role has no role state' : 'a session reads only the state of the role it holds';
              peer.send({ type: 'result', id: frame.id, ok: false, error: `forbidden: role.state (${reason})`, code: 'forbidden', permission: 'role.state', role: connection?.role ?? null, reason });
              break;
            }
            peer.send({ type: 'result', id: frame.id, ok: true, value: roleState(this.#handover(), role, me) });
            break;
          }
          case 'status':
            core.setStatus(me, frame.text);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { status: connection?.status ?? null } });
            break;
          case 'rename': {
            // names never change (spec 4.4): only the Coordinator renames, whatever a roles.toml grants
            if (core.roles && connection?.role !== COORDINATOR) {
              const reason = 'names never change: only the Coordinator renames';
              peer.send({ type: 'result', id: frame.id, ok: false, error: `forbidden: rename (${reason})`, code: 'forbidden', permission: 'rename', role: connection?.role ?? null, reason });
              break;
            }
            const r = core.rename(me, frame.name);
            if (r.ok) {
              name = r.name;
              peer.send({ type: 'result', id: frame.id, ok: true, value: { name: r.name } });
            } else peer.send({ type: 'result', id: frame.id, ok: false, error: r.error });
            break;
          }
          case 'ping':
            core.ping(me);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { pong: true } });
            break;
          case 'send': {
            const { outcomes, topic } = core.sendFromSession(me, frame.to ?? [], frame.text, frame.replyTo, frame.topic, undefined, undefined, undefined, frame.kind, undefined, false, undefined, frame.request, frame.subject);
            peer.send({ type: 'result', id: frame.id, ok: true, value: { outcomes, topic } });
            break;
          }
          case 'topic.create': {
            const resumed = this.#guard.resumer(frame.type, me);
            const authorize = () => {
              const current = connection && core.isCurrent(connection) ? connection : null;
              if (!current || !this.#permitted(current, frame, peer, false)) throw new ToolForbidden(current?.role ?? null, frame.type, 'permission changed during topic binding');
            };
            later(frame.type, core.createTopic(frame.title, frame.item, me, resumed, authorize).then(
              topic => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { topic } } as HubFrame)),
              err => resumed(() => Dispatcher.#failure(frame.id, err))));
            break;
          }
          case 'resolve':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { topic: core.resolveTopic(frame.topic, me) } });
            break;
          case 'ask.forward':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.forward(me, frame.ask) });
            break;
          case 'ask.answer':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.answerFromSession(me, frame.ask, frame.text) });
            break;
          case 'ask':
            peer.send({ type: 'result', id: frame.id, ok: true, value: core.asks.ask(me, frame.topic, frame.question, frame.options, frame.free) });
            break;
        }
      } catch (err) {
        peer.send(Dispatcher.#failure(frame.id, err));
      }
    };

    const clientRequest = (frame: Record<string, unknown>, via?: RemoteVia, messageId?: string, bytes?: readonly Buffer[], answerInput?: GatewayAnswerInput) => {
      // Retired frames are outside the protocol, but old clients need a useful refusal.
      if (frame.type === 'inbox.dismiss' || frame.type === 'inbox.dismiss_all') {
        return peer.send({ type: 'result', id: typeof frame.id === 'string' ? frame.id : '?', ok: false,
          error: 'Inbox notifications retired: use the events view (events.list) to see what happened.' });
      }
      if (!isClientRequest(frame)) {
        peer.send(requestValidationFailure(frame));
        return;
      }
      const answer = (value: unknown) => {
        const publish = () => peer.send({ type: 'result', id: frame.id, ok: true, value });
        if (transport.edge === 'gateway') core.store.afterCommit(publish, () => log({ event: 'result-publication-failed' }));
        else publish();
      };
      const requireLocalHuman = () => {
        const caller = this.#asSession(frame);
        const reason = 'auth and user commands require a local human shell';
        if (caller) throw new ToolForbidden(caller.role, frame.type, reason);
        if (transport.edge !== 'socket') throw new Error(reason);
      };
      const requireUserManagement = () => {
        if (transport.edge !== 'web') return requireLocalHuman();
        if (!humanUser(frame) || core.store.users.mode() !== 'users') throw new Error('web user commands require users mode');
      };
      try {
        switch (frame.type) {
          case 'resume':
            if (!features.includes('numbered-deltas')) throw new Error('resume requires numbered-deltas');
            if (preparingSnapshot || holdingModel) throw new Error('wait for the current model transaction before resuming');
            resumeModel(frame, replayed => answer({ replayed, ...core.modelCursor() }));
            return;
          case 'visibility.set': {
            if (this.#asSession(frame)) throw new Error('visibility choices belong to the human');
            const preferences = core.visibility.preferences;
            if (!preferences) throw new Error('this hub has no UI preferences file');
            const exists = frame.surface === 'topics' ? core.store.topic(frame.target)
              : frame.surface === 'artifacts' ? core.store.artifact(frame.target)
              : core.store.knownSessions().some(s => s.name === frame.target) || core.presence().some(s => s.name === frame.target);
            if (!exists) throw new Error(`no ${frame.surface} entry ${frame.target}`);
            const resumed = this.#guard.resumer(frame.type, client);
            later(frame.type, preferences.toggle(frame.surface, frame.target, frame.mode, resumed).then(
              async visibility => {
                resumed(() => this.#guard.changed());
                await resumed(() => core.refreshVisibility({ surface: frame.surface, target: frame.target }, resumed));
                return resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { visibility } } as HubFrame));
              }).catch(err => resumed(() => Dispatcher.#failure(frame.id, err))));
            break;
          }
          case 'topic.list':
            return answer({ topics: core.topics() });
          case 'session.history':
            return answer(core.sessionHistoryPage(frame.session, frame.limit, frame.before));
          case 'topic.history':
            return answer(core.topicHistoryPage(frame.topic, frame.limit, frame));
          case 'topic.withdraw': {
            if (this.#asSession(frame)) throw new Error('only the human may withdraw a message');
            return answer(core.withdrawHumanMessage(frame.topic, frame.message, humanUser(frame)?.id));
          }
          case 'artifact.upload': {
            const pairedUser = humanUser(frame);
            const pairing = via ? pairedUser ? core.store.remotes.forMessenger(via).userPairing(pairedUser.id) : core.store.remotes.forMessenger(via).pairing() : null;
            const resumed = this.#guard.resumer(frame.type, client);
            const root = this.#options.control?.status().root;
            if (!root) throw new Error('this hub serves no project for artifacts');
            const authorize = () => {
              if (done) throw new ToolForbidden(null, frame.type, 'upload conversation closed');
              transport.authorizeUpload?.();
              if (this.#asSession(frame)) throw new ToolForbidden(null, frame.type, 'only the human may upload artifacts');
              if (transport.edge === 'gateway') {
                const refusal = gatewayAuthorityRefusal(frame, id => core.store.message(id)?.topic ?? null)
                  ?? gatewayUserRefusal(core.store.users, humanUser(frame)?.id, frame);
                if (refusal) throw new ToolForbidden('human', frame.type, refusal.reason ?? 'gateway refusal');
              }
              if (via && pairing) {
                const current = pairedUser ? core.store.remotes.forMessenger(via).userPairing(pairedUser.id) : core.store.remotes.forMessenger(via).pairing();
                if (!current || current.chatId !== pairing.chatId || current.userId !== pairing.userId || current.guildId !== pairing.guildId)
                  throw new ToolForbidden('human', frame.type, 'remote pairing changed during upload');
              }
              if (!core.store.topic(frame.topic)) throw new Error('no such topic');
            };
            const replay = (): { message: import('../protocol.ts').TopicMessage; artifacts: import('../protocol.ts').Artifact[] } | undefined => {
              const message = messageId ? core.store.message(messageId) : null;
              if (!message) return undefined;
              if (message.fromKind !== 'human' || message.via !== via) throw new Error('remote input identity conflict');
              return { message: { ...message, topic: message.topic!, seq: core.store.messageSeq(message.id), ...(core.store.stage(message.id) ? { stage: core.store.stage(message.id)! } : {}) }, artifacts: message.artifacts ?? [] };
            };
            const operation = this.#artifactQueue.then(() => uploadArtifacts(core.store, root, frame, bytes,
              this.#options.projectConfig?.().artifacts.maxUploadMb ?? 50, artifacts => {
                const { message } = core.sendFromHuman(frame.topic, frame.caption ?? '', frame.to, frame.replyTo, undefined, undefined, artifacts, messageId, undefined, frame.kind, via, true, humanUser(frame)?.id);
                return { message, artifacts };
              }, authorize, replay, resumed, () => core.clock.now(), this.#options.uploadRedactor, this.#options.uploadOpen, transport.ownsUploadBytes === true, undefined, humanUser(frame) ?? undefined));
            uploads.add(operation);
            void operation.then(() => uploads.delete(operation), () => uploads.delete(operation));
            this.#artifactQueue = operation.catch(() => {});
            later(frame.type, operation.then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            return;
          }
          case 'topic.send': {
            // The message's durable primary key closes the crash window before
            // the native adapter can store its receipt or confirm a poll offset.
            const original = messageId && core.store.message(messageId);
            if (original) {
              if (original.fromKind !== 'human' || original.via !== via) throw new Error('remote input identity conflict');
              return answer({ message: { ...original, topic: original.topic!, seq: core.store.messageSeq(original.id), stage: core.store.stage(original.id) }, outcomes: [] });
            }
            const { message, outcomes } = core.sendFromHuman(frame.topic, frame.text, frame.to, frame.replyTo, undefined, undefined, undefined, messageId, undefined, frame.kind, via, false, humanUser(frame)?.id);
            // Native crash fixture: the durable human effect exists, but the
            // adapter has not received a result or stored its feedback receipt.
            if (messageId && ((via === 'telegram' && this.#options.env?.CLAND_TEST_CRASH_AT === 'telegram-input-committed')
              || (via === 'discord' && this.#options.env?.CLAND_TEST_CRASH_AT === 'discord-input-committed'))) core.store.afterCommit(() => { process.kill(process.pid, 'SIGKILL'); }, () => {});
            if (via === 'discord' && this.#options.env?.CLAND_TEST_CRASH_AT === 'discord-page-uncommitted') process.kill(process.pid, 'SIGKILL');
            return answer({ message, outcomes });
          }
          case 'topic.rename':
            return answer({ topic: core.renameTopic(frame.topic, frame.title) });
          case 'topic.delete':
            core.deleteTopic(frame.topic);
            return answer({ deleted: frame.topic });
          case 'topic.create': {
            const resumed = this.#guard.resumer(frame.type, client);
            const original = this.#asSession(frame);
            const authorize = () => {
              if (!original) return;
              const current = this.#asSession(frame);
              if (!current || !this.#permitted(current, frame, peer, false)) throw new ToolForbidden(current?.role ?? null, frame.type, 'permission changed during topic binding');
            };
            const user = original ? null : humanUser(frame);
            later(frame.type, core.createTopic(frame.title, frame.item, user?.name ?? HUMAN_SESSION, resumed, authorize, user?.id).then(
              topic => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { topic } } as HubFrame)),
              err => resumed(() => Dispatcher.#failure(frame.id, err))));
            return;
          }
          case 'topic.close':
            return answer({ topic: core.closeTopic(frame.topic) });
          case 'topic.resolve':
            return answer({ topic: core.resolveTopic(frame.topic) });
          case 'marks.get':
            return answer({ marks: core.humanMarks() });
          case 'marks.set':
            return answer({ marks: core.setHumanMarks(frame, id => this.#options.tracker?.planHistory(id) ?? []) });
          case 'topic.read':
            return answer({ topic: core.readTopic(frame.topic, frame.upTo) });
          case 'role.set': {
            // with a note, or `move`: the role moves to the session from its holder, as a handover (#31); the note is optional
            const assign = () => {
              if (frame.item !== undefined && (frame.role !== 'lead' || (frame.note === undefined && frame.move !== true))) throw new Error('item requires a Lead move or handover note');
              if (frame.note !== undefined || frame.move === true) {
                const from = frame.role === 'lead' ? (frame.item ? this.#options.tracker?.claimOf(frame.item)?.session ?? null : null) : core.holderOf(frame.role, frame.session);
                return { session: handOver(this.#handover(), { role: frame.role, from, to: frame.session, by: 'human', note: frame.note, noteRequired: false, requireKnown: false, ...(frame.item ? { item: frame.item } : {}) }) };
              }
              return { session: core.assignRole(frame.session, frame.role) };
            };
            if (core.roles?.fresh) {
              // Reserve before the first await; the fresh snapshot and current holder are re-read in assign().
              const admission = core.admitRole(frame.session, frame.role, frame.note !== undefined || frame.move === true);
              const resumed = this.#guard.resumer(frame.type, client);
              const value = (async (): Promise<HubFrame> => {
                try {
                  await core.roles!.fresh!(resumed);
                  return resumed(() => {
                    try {
                      admission.validate();
                      return { type: 'result', id: frame.id, ok: true, value: assign() } as HubFrame;
                    } catch (err) { return Dispatcher.#failure(frame.id, err); } finally { admission.release(); }
                  });
                } catch (err) {
                  return resumed(() => { admission.release(); return Dispatcher.#failure(frame.id, err); });
                }
              })();
              return later(frame.type, value);
            }
            return answer(assign());
          }
          case 'role.state':
            return answer(roleState(this.#handover(), frame.role, frame.session));
          case 'role.clear':
            return answer({ session: core.clearRole(frame.session) });
          case 'role.list':
            return answer(core.roleList());
          case 'hygiene.unmute':
            return answer(core.unmute(frame.a, frame.b));
          case 'approval.answer': {
            const resumed = this.#guard.resumer(frame.type, client);
            return later(frame.type, core.inbox.answerApproval(frame.approval, frame.choice, frame.note, via ?? (transport.edge === 'web' ? 'web' : 'neovim'), (sessionId, requestId, value) => {
              if (!this.#sessions) throw new Error('the hub has no adapters');
              return this.#sessions.answerApproval(sessionId, requestId, value);
            }, resumed, humanUser(frame) ?? undefined).then(approval => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { approval } } as HubFrame)), err => resumed(() => Dispatcher.#failure(frame.id, err))));
          }
          case 'remote.test':
          case 'remote.unpair':
          case 'remote.status': {
            const local = transport.edge === 'socket' && (client === 'nvim' || client === 'cli')
              || transport.edge === 'stdio' && client === 'nvim';
            if (!local || Object.hasOwn(frame, 'as')) throw new Error('remote management requires the human CLI or Neovim on a local connection');
            const roleRefusal = userAuthorityRefusal(core.store.users, humanUser(frame)?.id, frame);
            if (roleRefusal) return peer.send(roleRefusal);
            if (frame.type === 'remote.test') {
              if (!this.#options.control?.remoteTest) throw new Error('messenger test is unavailable');
              const pairing = core.store.remotes.forMessenger(frame.messenger).pairing();
              const resumed = this.#guard.resumer(frame.type, client);
              return later(frame.type, this.#options.control.remoteTest(frame.messenger, pairing).then(
                () => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { messenger: frame.messenger, checked: true, sent: pairing !== null } } as HubFrame)),
                error => resumed(() => Dispatcher.#failure(frame.id, error))));
            }
            if (frame.type === 'remote.unpair') {
              const remote = core.store.remotes.forMessenger(frame.messenger);
              if (core.store.users.mode() === 'users') {
                if (!frame.user) {
                  const names = remote.userPairings().map(pair => core.store.users.get(pair.clandUserId!)?.name ?? '?');
                  throw new Error(`users mode unpair requires --user <name>; paired users: ${names.join(', ') || 'none'}`);
                }
                const user = core.store.users.byName(frame.user);
                if (!user) throw new Error('unknown pairing user');
                remote.removeUserPairing(user.id);
              } else remote.setPairing(null);
              return answer({ messenger: frame.messenger, unpaired: true });
            }
            if (!this.#options.control?.remoteStatus) throw new Error('remote status is unavailable');
            return answer(this.#options.control.remoteStatus());
          }
          case 'login.add':
          case 'login.signin':
          case 'login.signed-in':
          case 'login.remove':
          case 'login.snapshot':
          case 'login.list':
          case 'login.set':
          case 'host.providers':
          case 'host.status':
          case 'host.stop':
          case 'host.create':
          case 'host.list':
          case 'host.prepare':
          case 'host.destroy':
          case 'host.revoke': {
            const local = transport.edge === 'socket' && (client === 'nvim' || client === 'cli')
              || transport.edge === 'stdio' && client === 'nvim';
            const web = transport.edge === 'web' && !webAuthorityRefusal(frame);
            if ((!local && !web) || kind === 'spoke' || this.#asSession(frame) || hostId || Object.hasOwn(frame, 'as')) throw new ToolForbidden(null, frame.type, `${frame.type} requires the local human CLI or Neovim or an authorized authenticated web user`);
            const refusal = userAuthorityRefusal(core.store.users, humanUser(frame)?.id, frame);
            if (refusal) return peer.send(refusal);
            if(frame.type==='login.remove') {
              const root=this.#options.control?.status().root;
              if(this.#closed||!root||!this.loginSnapshots)throw Error('login removal runtime unavailable');
              const providers=new HostProviderRegistry({env:this.#options.env??process.env,now:()=>core.clock.now().getTime(),digitalocean:{root,clock:core.clock}});
              const logins=core.store.hosts.logins;
              const work=removeLogin({root,logins,provider:row=>providers.resolve(row),snapshots:this.loginSnapshots},frame.name);
              this.#poolPrepares.add(work);
              void work.finally(()=>this.#poolPrepares.delete(work)).catch(()=>{});
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),error=>Dispatcher.#failure(frame.id,error)));
            }
            if(frame.type==='login.set')return answer(core.store.hosts.logins.setExclusive(frame.name,frame.exclusive));
            if(frame.type==='login.snapshot') {
              if(!this.loginSnapshots)throw Error('login snapshots unavailable');
              const work=this.loginSnapshots.snapshot(frame.name);
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),error=>Dispatcher.#failure(frame.id,error)));
            }
            if(frame.type==='login.signed-in') {
              const pending=loginSignIns.get(frame.name);
              if(!pending) throw Error('sign-in belongs to another connection or is already complete');
              const work=pending.complete(frame.code);
              this.#poolPrepares.add(work);
              void work.finally(()=>{loginSignIns.delete(frame.name);this.#poolPrepares.delete(work);}).catch(()=>{});
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),err=>Dispatcher.#failure(frame.id,err)));
            }
            if(frame.type==='login.add'||frame.type==='login.signin') {
              if(web){
                if(!this.#cardSignIn)throw Error('card sign-in runtime unavailable');
                const row=frame.type==='login.signin'?core.store.hosts.logins.get(frame.name):null;
                if(frame.type==='login.signin'&&!row)throw Error('unknown login: '+frame.name);
                const input=frame.type==='login.signin'?{name:frame.name,harness:row!.harness,signin:true}:{harness:frame.harness,...(frame.kind!==undefined?{kind:frame.kind}:{}),...(frame.name!==undefined?{name:frame.name}:{}),...(frame.account!==undefined?{account:frame.account}:{}),...(frame.pool!==undefined?{pool:frame.pool}:{})};
                return later(frame.type,this.#cardSignIn.start(input).then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),error=>Dispatcher.#failure(frame.id,error)));
              }
              if(frame.type==='login.add'&&frame.kind==='key') {
                const root=this.#options.control?.status().root, config=this.#options.projectConfig?.();
                if(!root||!config||!this.#options.registerHostSecrets)throw Error('key login runtime unavailable');
                return answer(addKeyLogin(root,projectTag(root,config.name),core.store.hosts.logins,this.#options.registerHostSecrets,frame));
              }
              if(this.#closed||!this.hostOwner||!this.#options.control) throw Error('host runtime unavailable');
              const existing=frame.type==='login.signin'?core.store.hosts.logins.get(frame.name):null;
              if(frame.type==='login.signin'&&!existing)throw Error('unknown login: '+frame.name);
              const input=frame.type==='login.signin'?{harness:existing!.harness,name:frame.name,signin:true}:frame;
              const work=(async()=>{
                const preparing=new AbortController(),abortPreparing=()=>preparing.abort(Error('terminal disconnected during sign-in preparation'));
                onClose.push(abortPreparing);
                let prepared:Awaited<ReturnType<typeof preparePoolLogin>>;
                try{prepared=await this.#prepareLogin(input,preparing.signal);}finally{const index=onClose.indexOf(abortPreparing);if(index>=0)onClose.splice(index,1);}
                const {pending,plan}=prepared;
                const close=()=>{loginSignIns.delete(pending.name);return pending.interrupt?.()??pending.complete(null);};
                this.#loginClosers.add(close);
                const complete=pending.complete.bind(pending);
                pending.complete=code=>complete(code).finally(()=>{this.#loginClosers.delete(close);});
                if(pending.interrupt){const interrupt=pending.interrupt.bind(pending);pending.interrupt=()=>{loginSignIns.delete(pending.name);return interrupt().finally(()=>{this.#loginClosers.delete(close);});};}
                loginSignIns.set(pending.name,pending);
                if(!peer.isOpen()||this.#closed) {await close();throw Error('terminal disconnected before sign-in');}
                return plan;
              })();
              this.#poolPrepares.add(work);
              void work.finally(()=>this.#poolPrepares.delete(work)).catch(()=>{});
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),err=>Dispatcher.#failure(frame.id,err)));
            }
            if (frame.type === 'login.list') {
              if (frame.name === undefined) return answer(core.store.hosts.logins.list().map(row => ({...row,bindings:core.store.hosts.logins.bindings(row.name)})));
              const row = core.store.hosts.logins.get(frame.name);
              if (!row) return answer([]);
              const base = { name: row.name, harness: row.harness, account: row.account, state: row.state };
              const metadata: import('../protocol.ts').LoginMetadataRow = row.kind === 'disk' ? { ...base, kind: 'disk', provider: row.provider, region: row.region } : { ...base, kind: 'key' };
              return answer([metadata]);
            }
            if (frame.type === 'host.providers') return answer(providerTokens(this.#options.projectConfig!().hosts,this.#options.env??process.env,frame.provider));
            if (frame.type === 'host.status') {
              if(this.#closed)throw Error('host status stopped');
              const roles=[...(core.roles?.get().values()??[])],settings=this.#options.projectConfig!().hosts;
              const roleLogins=frame.roleLogins?roleLoginReadiness(core.store.hosts,settings,roles):undefined;
              const work=hostStatus(core.store.hosts,settings,this.#sessions?.list()??[],this.#options.env??process.env,core.clock,this.#options.control?.status().root,id=>this.#sessions?.hostUsage(id)??{usedMilli:0,promisedMilli:0},roles.map(role=>role.launch),this.hostOutageSince).then(status=>roleLogins?{...status,roleLogins}:status);
              this.#poolPrepares.add(work);
              void work.finally(()=>this.#poolPrepares.delete(work)).catch(()=>{});
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),err=>Dispatcher.#failure(frame.id,err)));
            }
            if (frame.type === 'host.stop' || frame.type === 'host.list' || frame.type === 'host.create' || frame.type === 'host.destroy') {
              if(this.#closed)throw Error('host provisioning stopped');
              const root=this.#options.control?.status().root;
              if(!root)throw Error('project root unavailable');
              const env=this.#options.env??process.env;
              if(!this.hostOwner)throw Error('host runtime unavailable');
              const work=frame.type==='host.stop'?(async()=>{await core.store.hosts.leases.stop(frame.host);return destroyHost({clock:core.clock,root,id:frame.host,env,records:core.store.hosts,owner:this.hostOwner!,settleDeleted:(id,read)=>this.#sessions?.hostDeleted(id,read),log:event=>this.#log(event)});})():frame.type==='host.destroy'?destroyHost({clock:core.clock,root,id:frame.host,env,records:core.store.hosts,owner:this.hostOwner,settleDeleted:(id,read)=>this.#sessions?.hostDeleted(id,read),log:event=>this.#log(event)}):frame.type==='host.list'?listHosts(core.store.hosts,env):this.#createPoolHost(frame.pool);
              this.#poolPrepares.add(work);
              void work.finally(()=>this.#poolPrepares.delete(work)).catch(()=>{});
              return later(frame.type,work.then(value=>({type:'result',id:frame.id,ok:true,value} as HubFrame),err=>Dispatcher.#failure(frame.id,err)));
            }
            if (frame.type === 'host.prepare') {
              if (this.#closed) throw new Error('host preparation stopped');
              const root = this.#options.control?.status().root;
              if (!root) throw new Error('project root unavailable');
              const preparation = preparePools(root, frame.pool, this.#options.env ?? process.env);
              this.#poolPrepares.add(preparation);
              void preparation.finally(() => this.#poolPrepares.delete(preparation)).catch(() => {});
              return later(frame.type, preparation.then(value => ({ type: 'result', id: frame.id, ok: true, value } as HubFrame), err => Dispatcher.#failure(frame.id, err)));
            }
            return later(frame.type, this.revokeHost(frame.host).then(cleanup => ({ type: 'result', id: frame.id, ok: true, value: { revoked: frame.host, ...(cleanup ? { cleanup } : {}) } } as HubFrame), err => Dispatcher.#failure(frame.id, err)));
          }
          case 'pairing.approve': {
            const local = transport.edge === 'socket' && (client === 'nvim' || client === 'cli')
              || transport.edge === 'stdio' && client === 'nvim';
            if (!local || Object.hasOwn(frame, 'as'))
              throw new Error('pairing approval requires the human CLI or Neovim on a local connection');
            const roleRefusal = userAuthorityRefusal(core.store.users, humanUser(frame)?.id, frame);
            if (roleRefusal) return peer.send(roleRefusal);
            const row = core.inbox.pairingCodes.get(`pairing:${frame.messenger}:${frame.code}`);
            if (!row) throw new Error('no live pairing code for this messenger');
            const pairing = { userId: row.userId, chatId: row.chatId, guildId: row.guildId, name: row.name };
            const remote = core.store.remotes.forMessenger(frame.messenger);
            const usersMode = core.store.users.mode() === 'users';
            if (usersMode && !frame.user) throw new Error('users mode pairing approval requires --user <name>');
            const pairedUser = usersMode ? core.store.users.byName(frame.user!) : null;
            if (usersMode && !pairedUser) throw new Error('unknown pairing user');
            const previous = pairedUser ? remote.userPairing(pairedUser.id) : remote.pairing();
            core.store.transaction(() => {
              if (pairedUser) remote.setUserPairing(pairedUser.id, pairing);
              else remote.setPairing(pairing);
              remote.set('mute', String(this.#options.control?.remoteMuteDefault?.() ?? false));
              remote.set('mute.missed', '0');
              if (pairedUser) remote.removeRequest(frame.code);
              else core.inbox.pairingCodes.clear(frame.messenger);
            });
            log({ event: 'pairing-approved', messenger: frame.messenger, userId: pairedUser?.id ?? null, approvingUserId: humanUser(frame)?.id ?? null });
            this.#options.control?.pairingApproved?.(frame.messenger, pairing);
            if (previous) this.#options.control?.pairingReplaced?.(frame.messenger, previous);
            return answer({ pairing });
          }
          case 'topic.answer': {
            const secret=core.cards.isSecret(frame.ask);
            if(secret&&answerInput&&(!via||!messageId||remoteInputId(via,answerInput.ingress)!==messageId))throw Error('native answer identity conflict');
            if(secret&&via&&messageId&&(frame.text!==undefined||frame.reason!==undefined)&&!answerInput)throw Error('secret native answer input unavailable');
            const apply = () => core.asks.answer(frame.ask, frame.option, secret&&answerInput ? answerInput.text : frame.text, core.store.users.mode() === 'users' || frame.as?.name === 'human' ? undefined : frame.as?.name, frame.declined, secret&&answerInput ? answerInput.reason : frame.reason, via ?? (transport.edge === 'web' ? 'web' : 'neovim'), humanUser(frame) ?? undefined);
            if (!messageId || !via) return answer(apply()); // Previous clients keep the ordinary first-answer gate.
            const state = core.store.remotes.forMessenger(via);
            const identity = core.cards.answerDigest(frame.ask, messageId);
            const replayText = identity === undefined ? { text: frame.text, reason: frame.reason } : { identity,...(answerInput?{ingress:answerInput.ingress}:{}) };
            const key = `gateway.answer:${messageId}`;
            const original = state.get(key);
            if (original) {
              const receipt = JSON.parse(original);
              if (receipt.ask !== frame.ask || receipt.option !== frame.option || (identity === undefined ? receipt.text !== frame.text : receipt.identity !== undefined && receipt.identity !== identity)
                || receipt.declined !== frame.declined || (identity === undefined && receipt.reason !== frame.reason)) throw new Error('remote answer identity conflict');
              if(identity&&receipt.ingress&&(!answerInput||!sameRemoteIngress(receipt.ingress,answerInput.ingress)))throw Error('remote answer identity conflict');
              if(identity&&answerInput)state.transaction(()=>state.admitSecretAnswerCleanup(messageId,answerInput.ingress));
              return answer(receipt.value);
            }
            // Commit the native replay receipt with the hub effect, before the adapter
            // can acknowledge a press or confirm its polling offset.
            const value = core.store.transaction(() => {
              const applied = apply();
              // Freeze the admission snapshot before post-commit delivery mutates
              // its outcomes; the first response and every replay must agree.
              const value = JSON.parse(JSON.stringify(applied));
              state.set(key, JSON.stringify({ ask: frame.ask, option: frame.option, ...replayText, declined: frame.declined, value }));
              if(identity&&answerInput)state.admitSecretAnswerCleanup(messageId,answerInput.ingress);
              return value;
            });
            return answer(value);
          }
          case 'events.list': {
            const resumed = this.#guard.resumer(frame.type);
            return later(frame.type, (this.#options.journal ? this.#options.journal.events(frame.before, frame.limit, core.eventsProject(frame.filter ?? eventsFilter)) : Promise.resolve({ rows: [], before: null, more: false })).then(value => resumed((): HubFrame => ({ type: 'result', id: frame.id, ok: true, value })), err => resumed(() => Dispatcher.#failure(frame.id, err))));
          }
          case 'inbox.list':
            return answer(transport.edge === 'gateway' ? gatewayInbox(core.inbox.list(frame.archive)) : core.inbox.list(frame.archive));
          case 'inbox.decline':
            return answer(core.declineInboxRequest(frame.request));
          case 'inbox.read':
            return answer(core.readInboxMessage(frame.message));
          case 'worktree.list':
          case 'worktree.prune': {
            // Git work, awaited; prune is the human's (a session's shell is refused before this): without items the
            // closed items' worktrees, with items those removed
            const worktrees = this.#needWorktrees();
            const id = frame.id;
            const resumed = <T,>(write: () => T): T => this.#guard.measure(frame.type, client, write, 'resumed');
            const value: Promise<unknown> =
              frame.type === 'worktree.list'
                ? worktrees.list(resumed).then((w) => ({ worktrees: w }))
                : frame.dryRun === true || !frame.items?.length
                  ? worktrees.prunable(resumed).then((candidates) => ({ candidates }))
                  : worktrees.prune(frame.items, resumed);
            return later(frame.type, value.then((v): HubFrame => ({ type: 'result', id, ok: true, value: v }), (err: unknown) => Dispatcher.#failure(id, err)));
          }
          case 'subscribe':
            eventsFilter = frame.filter;
            subscriptionRequested = true;
            if (!unsubscribe) {
              subscribeModel();
              log({ event: 'subscribed', edge: transport.edge });
            }
            if (frame.filter !== undefined) {
              const resumed = this.#guard.resumer(frame.type);
              const page = this.#options.journal?.events(undefined, undefined, core.eventsProject(eventsFilter)) ?? Promise.resolve({ rows: [], before: null, more: false });
              return later(frame.type, page.then(events => resumed((): HubFrame => ({ type: 'result', id: frame.id, ok: true, value: { subscribed: true, events } })), err => resumed(() => Dispatcher.#failure(frame.id, err))));
            }
            return answer({ subscribed: true });
        }
        const control = this.#options.control;
        if (!control) {
          peer.send({ type: 'result', id: frame.id, ok: false, error: 'this hub is not serving a project: no status or stop here' });
          return;
        }
        switch (frame.type) {
          case 'models.list':
            later('models.list', this.#models!.list(frame.harness, frame.account, frame.refresh).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'account.poll':
            later('account.poll', (this.#accountPoller?.refresh() ?? readAccounts(this.#options.env).then(registry => core.accountLimits.list(registry))).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'account.list':
            later('account.list', readAccounts(this.#options.env).then(registry => ({ type: 'result', id: frame.id, ok: true, value: core.accountLimits.list(registry) }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'suite.queue':
            if (!this.#suites) return peer.send(Dispatcher.#failure(frame.id, new Error('no verification scheduler')));
            later('suite.queue', this.#suites.queue().then(value => ({ type: 'result', id: frame.id, ok: true, value: { ...value, batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } } }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'hub.subscriptions':
            peer.send({ type: 'result', id: frame.id, ok: true, value: { subscriptions: core.subscriptions().map(s => ({ ...s, subscriber: core.subscriptionOwner(s) })) } });
            break;
          case 'merge.queue':
            later('merge.queue', (this.#mergeQueue?.refresh() ?? Promise.resolve([])).then(entries => ({ type: 'result', id: frame.id, ok: true, value: { entries, batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } } })));
            break;
          case 'artifact.url':
            if (transport.edge !== 'web' || !transport.artifactUrl) throw new Error('artifact.url requires the authenticated web edge');
            peer.send({ type: 'result', id: frame.id, ok: true, value: transport.artifactUrl(frame.artifact) });
            break;
          case 'web.session':
            if (transport.edge !== 'web' || !transport.webSession) throw new Error('web.session requires the authenticated web edge');
            return answer(transport.webSession());
          case 'web.sessions':
            if (transport.edge !== 'socket') throw new Error('web.sessions requires the local Unix socket');
            if (!control.webSessions) throw new Error('the web edge is unavailable');
            peer.send({ type: 'result', id: frame.id, ok: true, value: control.webSessions() });
            break;
          case 'web.revoke':
            if (transport.edge !== 'socket') throw new Error('web.revoke requires the local Unix socket');
            if (!control.webRevoke) throw new Error('the web edge is unavailable');
            later('web.revoke', control.webRevoke(frame.session).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'auth.mode':
          case 'auth.reset':
            requireLocalHuman();
            if (transport.edge !== 'socket') throw new Error('cland auth requires the local Unix socket');
            if (!control.authMode) throw new Error('auth is unavailable');
            later(frame.type, control.authMode(frame.type === 'auth.reset' ? 'single' : frame.mode, this.#guard.resumer(frame.type, client)).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'user.add':
            requireUserManagement();
            if (!control.userAdd) throw new Error('cland user requires the local Unix socket');
            return answer(control.userAdd(frame.name, frame.displayName));
          case 'user.invite':
            requireLocalHuman();
            if (transport.edge !== 'socket' || !control.userInvite) throw new Error('cland user requires the local Unix socket');
            return answer(control.userInvite(frame.name));
          case 'user.list':
            requireUserManagement();
            if (!control.userList) throw new Error('cland user requires the local Unix socket');
            return answer(control.userList(frame.setup));
          case 'web.link':
            if (transport.edge !== 'socket') throw new Error('web.link requires the local Unix socket');
            if (!control.webLink) throw new Error('the web edge is unavailable');
            peer.send({ type: 'result', id: frame.id, ok: true, value: control.webLink(frame.qr, humanUser(frame)?.id) });
            break;
          case 'hub.status': {
            const status = (): HubFrame => {
              const verification = this.#suites ? { ...this.#suites.snapshot(), batch: this.#batches?.snapshot() ?? null, cleanups: this.#batches?.cleanupStatus() ?? [], cleanupOverflow: this.#batches?.cleanupOverflow() ?? { count: 0 } } : undefined;
              const full = control.status();
              const { harnesses: _harnesses, ...compact } = full;
              const base = { ...(frame.history === true ? full : compact), ...(frame.releaseTools === true ? { releaseTools: { gh: which('gh', this.#options.env ?? process.env, full.root) !== null } } : {}) };
              const tracker = this.#options.tracker;
              return { type: 'result', id: frame.id, ok: true, value: { ...base, hostSnapshotLeftovers:this.#suites?this.#suites.hostSnapshotLeftovers():[], hosts: tunnelStatuses(full.root, core.store.hosts.list()), mergeQueue: this.#mergeQueue?.entries() ?? [], ...(tracker ? { tracker: { ...base.tracker, levels: tracker.ladder.flat, ladder: tracker.ladder.levels.map(level => [...level]), prefixes: Object.fromEntries([...tracker.kinds, 'category'].map(kind => [kind, prefixOf(kind)])), storage: tracker.storageStatus() } } : {}), sessions: core.presence(), suites: this.#suites?.status(frame.history === true) ?? [], recentSuites: this.#suites?.recentStatus() ?? [], ...(frame.history === true ? { covers: this.#suites?.covers() ?? [] } : {}), ...(verification ? { verification } : {}), coordinator: core.coordinator(), needsYou: core.inbox.needsYou(transport.edge !== 'gateway'), requests: { ...this.#guard.counters } } satisfies HubStatus };
            };
            if (frame.flushLogs === true && control.flushLogs) {
              const resumed = this.#guard.resumer(frame.type, client);
              const flushing = control.flushLogs();
              let timer: NodeJS.Timeout;
              const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('log drain exceeded 5000 ms')), 5000); timer.unref(); });
              const draining = Promise.race([flushing, deadline]);
              return later(frame.type, draining.then(() => resumed(() => { clearTimeout(timer); return status(); })).catch(err => resumed(() => { clearTimeout(timer); return Dispatcher.#failure(frame.id, err); })));
            }
            peer.send(status());
            break;
          }
          case 'hub.reload':
            later('hub.reload', (control.reload ? control.reload(this.#guard.resumer(frame.type, client)) : Promise.reject(new Error('reload is unavailable'))).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
            break;
          case 'hub.stop':
            log({ event: 'stop-requested', edge: transport.edge });
            control.stop();
            peer.send({ type: 'result', id: frame.id, ok: true, value: { stopping: true } });
            break;
        }
      } catch (err) {
        peer.send(Dispatcher.#failure(frame.id, err));
        return;
      }
    };

    // CLI and MCP verification share identity, occasion and reporting admission.
    const startSuite = (frame: Record<string, unknown>, callerNow: () => Caller | null): void => {
      if (!this.#suites) return peer.send(Dispatcher.#failure(String(frame.id), new Error('this hub serves no project for suites')));
      const caller = callerNow();
      const claimed = caller ? this.#options.tracker?.list().find(item => item.kind === 'task' && item.state === 'open' && item.claim?.sessionId === caller.sessionId) : undefined;
      const input = { ...frame, ...(frame.cwd === undefined && claimed ? { cwd: taskWorktreePath(this.#options.tracker!.root, claimed.id) } : {}) };
      if (!isClientRequest(input) || input.type !== 'suite.start') return peer.send(Dispatcher.#failure(String(frame.id), new Error(`invalid verify request: ${suiteStartIssues(input).join('; ')}`)));
      const remote=!!caller&&(!!hostId||(this.#sessions?.hostForSession(caller.sessionId).name??'local')!=='local'||!!claimed&&core.store.hostWorktrees().some(row=>row.item===claimed.id));
      const request = remote ? {...input,cwd:this.#options.tracker!.root} : input;
      if (!isAbsolute(request.cwd)) return peer.send(Dispatcher.#failure(request.id, new Error('suite cwd must be absolute')));
      const topic = request.report === undefined ? AGENTS.id : core.store.topic(request.report)?.id
        ?? (caller ? this.#options.tracker?.list().find(i => i.claim?.sessionId === caller.sessionId)?.topic ?? (request.dryRun ? AGENTS.id : undefined) : AGENTS.id);
      if (!topic) return peer.send(Dispatcher.#failure(request.id, new Error('a session report needs your claimed item topic; use --report <topic>')));
      const to = core.store.topic(request.report ?? '') ? request.to ?? [] : request.to ?? (request.report ? [request.report] : ['coordinator']);
      const actor = caller ? { name: caller.name, sessionId: caller.sessionId, shell: true as const } : null;
      let reportAuthorized = false;
      const authorize = () => {
        // The submission survives its transport. Resolve the captured identity against current
        // roles and claims, rather than requiring its original spoke to remain connected.
        const current = actor ? this.#asSession({ as: actor }) : null;
        if (actor && current?.sessionId !== actor.sessionId) throw new Error('suite caller identity is unavailable');
        if (current && isCustomRole(current.role)) {
          const tracker = this.#options.tracker;
          const own = tracker?.list().find(item => item.kind === 'task' && item.state === 'open'
            && item.claim && tracker.sameSession(item.claim.sessionId, current.sessionId)
            && item.id === core.store.topic(topic)?.item
            && (remote ? claimed?.id===item.id : resolve(request.cwd) === taskWorktreePath(tracker.root, item.id)));
          const decision = decide(current.role, core.roles?.get().get(current.role!)?.permissions.tools,
            { tool: 'verify', claimed: () => !!own, verifyMode: request.mode, ...(request.occasion ? { verifyOccasion: request.occasion } : {}) });
          if (!decision.ok) throw new ToolForbidden(current.role, decision.permission, decision.reason);
        }
        // A report-free preview has no artifact or send side effects to authorize.
        if (!request.dryRun || request.report) {
          this.#suitePermissions(actor, topic, to);
          reportAuthorized = true;
        }
        authorizeVerifyMode(actor ? current?.role ?? null : undefined, request.mode, request.occasion);
      };
      const failure = async (error: unknown): Promise<HubFrame> => {
        if (!(error instanceof VerifyAllReserved)) return Dispatcher.#failure(request.id, error);
        const selection = await (this.#options.selectSuite ?? selectPackageSuite)(request.cwd, 'auto', this.#options.env);
        return { type: 'result', id: request.id, ok: false, code: 'verify-all-reserved', error: `verify-all-reserved: all is reserved to the Coordinator, the human shell and authorized occasions; omit the mode for ${describeSelection(selection, 2048)}` };
      };
      const submission = randomUUID();
      const record = (frame: HubFrame): HubFrame => {
        if (frame.type !== 'result') return frame;
        const value = frame.ok ? frame.value as { id?: string; dryRun?: boolean; reused?: boolean } : undefined;
        if (frame.ok && value?.dryRun) {
          const preview = frame.value as SuiteDryRun;
          const deferred = taskTierEvidence(preview.selection, { enabled: this.#options.projectConfig?.().merge.queue ?? false, batchTiers: this.#options.projectConfig?.().merge.batchTiers, entries: this.#mergeQueue?.entries() ?? [], batch: this.#batches?.snapshot() ?? null }, core.store.topic(topic)?.item ?? null);
          if (deferred) preview.lines.push(deferred);
        }
        const outcome = frame.ok ? value?.dryRun ? 'preview' : 'admitted' : 'refused';
        const detail = { event: 'verification-submission', submission, request: request.id, session: actor?.name ?? 'human', sessionId: actor?.sessionId ?? null, topic, cwd: request.cwd, outcome,
          ...(value?.id ? { run: value.id, reused: value.reused ?? false } : {}), ...(!frame.ok ? { code: frame.code, error: frame.error } : {}) };
        // This hub-owned receipt remains publishable even if admission revoked the caller's authority.
        if (reportAuthorized) core.noticeTo(topic, { kind: 'report', to,
          text: core.boundedText(`verify submission ${outcome}${value?.id ? ` · run ${value.id}${value.reused ? ' (reused)' : ''}` : ''}${!frame.ok ? `: ${frame.error}` : ''}`), detail });
        log(detail);
        return frame;
      };
      try { authorize(); } catch (error) { return later('suite.start', failure(error).then(record)); }
      const submit=async()=>{
        const source=remote&&caller&&claimed?await this.#flushHostItem(claimed.id,caller.sessionId,request.worktreeHead):undefined;
        if(remote&&!source)throw new Error('host-flush-refused: claimed host task unavailable; worktree HEAD unknown; territory HEAD unknown');
        authorize();
        const reply = Promise.withResolvers<Awaited<ReturnType<Suites['start']>>>();
        let admitted: string | undefined;
        const work = this.#suites!.start({ ...(source?{source}:{}), mode: request.mode, dryRun: request.dryRun ?? false, diagnostics: request.diagnostics ?? false, ...(request.workers !== undefined ? { workers: request.workers } : {}), ...(request.size ? { size: request.size } : {}), ...(request.occasion ? { occasion: request.occasion } : {}), ...(request.executor ? { executor: request.executor } : {}), fresh: request.fresh ?? false, cwd: request.cwd, topic, to, actor, item: core.store.topic(topic)?.item ?? null, integrated: !source && (caller?.role === 'coordinator' || caller?.role === 'qa' && request.occasion === VERIFY_OCCASIONS.epic) && request.cwd === this.#options.control?.status().root, priority: this.#suiteRank(core.store.topic(topic)?.item ?? null) }, authorize, admission => { admitted = admission.id; reply.resolve(admission); });
        // start() retains its in-process scheduler join. Its durable callback
        // releases only this wire reply; Suites still owns/drains the work.
        void work.then(value => reply.resolve(value), error => {
          if (admitted) log({ event: 'verification-followup-failed', run: admitted, error: String(error) });
          else reply.reject(error);
        });
        return reply.promise;
      };
      later('suite.start', submit().then(value => ({ type: 'result' as const, id: request.id, ok: true as const, value }), failure).then(record));
    };

    /** A read repeated too fast reuses its last answer without another audit. */
    const replayed = (frame: Record<string, unknown>): boolean => {
      // A refresh can revoke a read grant without a core event. Never replay an answer from older roles.
      const snapshot = core.roles?.get();
      if (snapshot !== this.#rolesSnapshot) {
        this.#rolesSnapshot = snapshot;
        this.#guard.changed();
      }
      const again = guard.replay(frame, kind === 'spoke' ? (name ?? '?') : client);
      if (again && again !== 'pending') wire.send(core.visibility.frame(again));
      return again !== null;
    };

    const handle = (frame: Record<string, unknown>, via?: RemoteVia, messageId?: string, bytes?: readonly Buffer[], userId?: string, answerInput?: GatewayAnswerInput): void => {
        if (hostId) {
          if (core.store.hosts.get(hostId)?.state !== 'registered') return closeHost();
          if (kind !== 'spoke') {
            const as = frame.as as { sessionId?: unknown; credential?: unknown } | undefined;
            const id = typeof as?.sessionId === 'string' ? as.sessionId : '';
            const row = this.#sessions?.hostSession(id);
            const expected = core.store.sessionCredential(id);
            const reason = !row || row.host !== hostId || row.role === null || !expected || typeof as?.credential !== 'string' || !secretMatches(as.credential, expected)
              ? 'host frame requires its own role-holding session credential' : hostAuthorityRefusal(frame);
            if (reason) return peer.send(Dispatcher.#failure(String(frame.id), new ToolForbidden(null, String(frame.type), reason)));
            // Resolve all subsequent CLI handlers from the proved durable identity.
            frame.as = { name: row!.name, sessionId: id, shell: true, credential: as!.credential };
            const nativeId=frame.type==='session.signal'?(frame.payload as {session_id?:unknown}|undefined)?.session_id:undefined;
            if ((frame.type === 'session.signal' || frame.type === 'session.bridge') &&
              (frame.sessionId !== undefined && frame.sessionId !== (frame.type === 'session.signal' ? row!.nativeSessionId ?? id : id) || typeof nativeId==='string' && nativeId!==(row!.nativeSessionId ?? id) || frame.session !== undefined && frame.session !== row!.name || frame.launch !== undefined && frame.launch !== row!.launch))
              return peer.send(Dispatcher.#failure(String(frame.id), new ToolForbidden(row!.role, String(frame.type), 'host plumbing must target its own session')));
            if (frame.type === 'session.signal' || frame.type === 'session.bridge') frame.session = row!.name;
          }
        }
        if (userId) admittedUsers.set(frame, userId);
        if (kind === 'spoke') {
          // A replaced or closing socket's buffered frames would act under a name it no longer holds.
          if (!peer.isOpen() || connection === null || !core.isCurrent(connection)) {
            log({ event: 'stale-frame', edge: transport.edge, name, type: frame.type });
            return;
          }
          if (isAck(frame)) return core.ack(connection, frame.id);
          // the keepalive is not a tool call
          if (frame.type !== 'ping') {
            if (replayed(frame)) return;
            audit(frame.id, { session: connection.name, sessionId: connection.sessionId, role: connection.role, tool: String(frame.type), args: summarize(frame) });
            if (frame.type === 'artifact.upload') return peer.send(Dispatcher.#failure(String(frame.id), new ToolForbidden(connection.role, 'artifact.upload', 'only the human may upload artifacts')));
            const bad = Dispatcher.#verdictFromText(frame);
            if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
            if (!this.#permitted(connection, frame, peer)) return;
          }
          if (frame.type === 'suite.start') return startSuite(frame, () => connection && core.isCurrent(connection) ? connection : null);
          // a spoke always acts as its own session
          if (isTaskRequest(frame)) {
            return task(frame, sessionActor(connection, UNKNOWN_SESSION), () => connection && core.isCurrent(connection) ? connection : null);
          }
          if (isSubscriptionRequest(frame)) return subscriptionRequest(frame, connection);
          if (isSessionRequest(frame) && SPOKE_SESSION_REQUESTS.has(frame.type)) return session(frame);
          // the session's name as it is now: another of its spokes may have renamed it
          if (frame.type === 'send' && frame.artifacts !== undefined) return attachedSend(frame, () => connection && core.isCurrent(connection) ? connection : null);
          return spokeRequest(frame, connection.name);
        }
        if (transport.edge === 'gateway') {
          const refusal = gatewayAuthorityRefusal(frame, id => core.store.message(id)?.topic ?? null)
            ?? gatewayUserRefusal(core.store.users, userId, frame);
          if (refusal) {
            audit(frame.id, { ...humanAudit(frame), tool: String(frame.type), args: summarize(frame), client });
            return peer.send(refusal);
          }
        }
        if (transport.edge === 'web') {
          const refusal = userAuthorityRefusal(core.store.users, transport.user?.()?.id, frame) ?? webAuthorityRefusal(frame);
          if (refusal) {
            audit(frame.id, { ...humanAudit(frame), tool: String(frame.type), args: summarize(frame), client });
            return peer.send(refusal);
          }
        }
        const credentialRefusal = this.#sessionCredentialRefusal(frame);
        if (credentialRefusal) return peer.send(Dispatcher.#failure(String(frame.id), new Error(credentialRefusal)));
        if (core.store.users.mode() === 'users' && (transport.edge === 'socket' || transport.edge === 'stdio')
          && (HUMAN_USER_WRITES.has(String(frame.type)) || frame.type === 'topic.withdraw') && !this.#asSession(frame)) {
          try {
            const first = core.store.users.first();
            const user = humanUser(frame);
            const refusal = userAuthorityRefusal(core.store.users, first?.id, frame)
              ?? userAuthorityRefusal(core.store.users, user?.id, frame);
            if (refusal) {
              audit(frame.id, { ...humanAudit(frame), tool: String(frame.type), args: summarize(frame), client });
              return peer.send(refusal);
            }
          } catch (error) {
            audit(frame.id, { ...humanAudit(), tool: String(frame.type), args: summarize(frame), client });
            return peer.send(Dispatcher.#failure(String(frame.id), error));
          }
        }
        if (replayed(frame)) return;
        // a CLI call acting as a session the hub knows (`as`): checked against that session's role and audited as it,
        // exactly as the session's own tool call would be
        const as = isTaskRequest(frame) ? this.#asSession(frame) : null;
        if (as !== null && isTaskRequest(frame)) {
          audit(frame.id, { session: as.name, sessionId: as.sessionId, role: as.role, tool: String(frame.type), args: summarize(frame), client });
          const bad = Dispatcher.#verdictFromText(frame);
          if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
          if (!this.#permitted(as, frame, peer)) return;
          return task(frame, sessionActor(as, UNKNOWN_SESSION), () => this.#asSession(frame));
        }
        const plumbing = frame.type === 'session.signal' || frame.type === 'session.bridge';
        // any other CLI call from a session's shell (`as` with the session's id, or a name the hub knows): the session's,
        // audited as it. What the permission table knows is decided by the table, as for the session's own tool call
        // (session.list is a separate read; session lifecycle mutations and hub.stop keep their own grants);
        // other hub-state reads are anyone's; everything else is the human's alone.
        const caller = plumbing && !hostId ? null : this.#asSession(frame);
        if (caller !== null) {
          audit(frame.id, { session: caller.name, sessionId: caller.sessionId, role: caller.role, tool: String(frame.type), args: summarize(frame), client });
          if (this.#toolCall(caller, frame) !== null && frame.type !== 'rule.list') {
            if (!this.#permitted(caller, frame, peer)) return;
          } else if (!(hostId && plumbing) && !SESSION_CLI_FRAMES.has(String(frame.type))) {
            return this.#refuse(caller, frame, peer, String(frame.type), `only the human may do this; this call is ${withRole(caller.name, caller.role)}'s, by $CLAND_SESSION_ID`);
          }
        } else if (!plumbing) {
          // the human, through the UI or the CLI: not restricted by the table, audited all the same (hook plumbing aside)
          audit(frame.id, { ...humanAudit(frame), tool: String(frame.type), args: summarize(frame), client });
        }
        // a client's frame may name who it acts as (a name no session holds: written as it, unrestricted)
        if (isTaskRequest(frame)) {
          const bad = Dispatcher.#verdictFromText(frame);
          if (bad !== null) return peer.send({ type: 'result', id: String(frame.id), ok: false, error: bad });
          return task(frame, 'client');
        }
        if (isClientRequest(frame) && frame.type === 'task.migrate') {
          const reason = 'item migration belongs to the Coordinator or the human';
          if (caller && caller.role !== 'coordinator') return this.#refuse(caller, frame, peer, frame.type, reason);
          return peer.send(Dispatcher.#failure(frame.id, new Error('the hub is running; stop the hub and run cland task migrate from the project root shell')));
        }
        if (isClientRequest(frame) && ['demo.start', 'demo.exec', 'demo.stop', 'demo.status'].includes(frame.type)) {
          const request = frame as import('../protocol.ts').DemoRequest;
          if (!this.#demos) return peer.send(Dispatcher.#failure(request.id, new Error('this hub has no demo executor')));
          const authorize = () => {
            const now = this.#asSession(frame);
            if (!caller) return;
            const epic = this.#options.tracker!.view(request.epic);
            const allowed = now?.sessionId === caller.sessionId && (now.role === 'coordinator' || now.role === 'qa' && epic.holds.some(h => h.role === 'qa' && h.sessionId === now.sessionId));
            if (!allowed) throw new ToolForbidden(now?.role ?? null, request.type, 'demo controls belong to QA holding the epic, the Coordinator or the human');
          };
          try { authorize(); } catch (error) { return peer.send(Dispatcher.#failure(request.id, error)); }
          return later(request.type, this.#dropletReady.then(async (): Promise<unknown> => {
            authorize();
            if (request.type === 'demo.start') return this.#demos!.start(request.epic, request.commit, authorize);
            if (request.type === 'demo.exec') return this.#demos!.exec(request.epic, request.command, authorize);
            if (request.type === 'demo.stop') return this.#demos!.stop(request.epic, authorize);
            return this.#demos!.status(request.epic, request.commit);
          }).then(value => ({ type: 'result' as const, id: request.id, ok: true, value }), error => Dispatcher.#failure(request.id, error)));
        }
        if (isClientRequest(frame) && (frame.type === 'executor.switch' || frame.type === 'executor.status' || frame.type === 'executor.reap' || frame.type === 'executor.prepare' || frame.type === 'executor.retire-legacy')) {
          if (caller && caller.role !== 'coordinator') return this.#refuse(caller, frame, peer, frame.type, 'executor controls belong to the Coordinator or the human');
          if (!this.#droplets) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub serves no project for executors')));
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || now.role !== 'coordinator')) throw new ToolForbidden(now?.role ?? null, frame.type, 'executor controls belong to the Coordinator or the human');
          };
          if (frame.type === 'executor.switch') {
            const change = this.#options.control?.switchExecutor;
            if (!change) return peer.send(Dispatcher.#failure(frame.id, new Error('executor switching is unavailable; upgrade the hub')));
            const resumed = this.#guard.resumer(frame.type, client);
            return later(frame.type, change(frame.executor, frame.workers, resumed, authorize).then(
              value => ({ type: 'result' as const, id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
          }
          if (frame.type === 'executor.retire-legacy') {
            return later(frame.type, this.#dropletReady.then(() => {
              authorize();
              return this.#droplets!.retireLegacy(frame.confirmRegisteredHubs, authorize);
            }).then(value => ({ type: 'result' as const, id: frame.id, ok: true as const, value }), error => Dispatcher.#failure(frame.id, error)));
          }
          if (frame.type === 'executor.prepare') {
            const topic = frame.report === undefined ? core.store.topic(AGENTS.id) : core.topics().find(topic => topic.id === frame.report || topic.title === frame.report);
            if (!topic) return peer.send(Dispatcher.#failure(frame.id, new Error('unknown prepare report topic')));
            return later(frame.type, this.#dropletReady.then(() => {
              const value = this.#droplets!.submitPrepare(text => core.noticeTo(topic.id, { kind: 'report', to: ['coordinator'], text }), authorize);
              return { type: 'result' as const, id: frame.id, ok: true as const, value };
            }).catch(error => Dispatcher.#failure(frame.id, error)));
          }
          return later(frame.type, (frame.type === 'executor.status' ? Promise.resolve().then(() => { authorize(); return this.#droplets!.inspect(); }) : this.#dropletReady.then(() => { authorize(); return this.#droplets!.reap(authorize); })).then(
            value => ({ type: 'result' as const, id: frame.id, ok: true, value }), err => Dispatcher.#failure(frame.id, err),
          ));
        }
        if (isClientRequest(frame) && frame.type === 'account.clear') {
          const resumed = this.#guard.resumer(frame.type, client);
          if (caller) {
            const decision = decide(caller.role, undefined, { tool: 'account.clear' });
            if (!decision.ok) return this.#refuse(caller, frame, peer, decision.permission, decision.reason);
          }
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || now.role !== 'coordinator')) throw new ToolForbidden(now?.role ?? null, 'account.clear', 'account clearing belongs to the Coordinator or the human');
          };
          return later(frame.type, readAccounts(this.#options.env).then(registry => resumed(() => {
            authorize();
            if (!core.accountLimits.list(registry).accounts.some(a => a.name === frame.account)) throw new Error(`unknown account "${frame.account}"`);
            return { type: 'result', id: frame.id, ok: true, value: { account: frame.account, cleared: core.clearAccountLimit(frame.account, 'hand') } } as HubFrame;
          }), error => resumed(() => Dispatcher.#failure(frame.id, error))));
        }
        if (isClientRequest(frame) && ['rule.add', 'rule.edit', 'rule.retire', 'rule.list', 'rule.show'].includes(frame.type)) {
          const request = frame as import('../protocol.ts').RuleRequest;
          const rules = core.rules;
          if (!rules) return peer.send(Dispatcher.#failure(request.id, new Error('this hub has no rulebook')));
          try {
            if (request.type === 'rule.list') {
              if (request.role !== undefined && !core.roles?.get().has(request.role)) throw new Error(`unknown role ${request.role}`);
              return peer.send({ type: 'result', id: request.id, ok: true, value: { rules: rules.get().filter(rule => (request.all || rule.status === 'active') && (request.role === undefined || rule.scope === 'all' || rule.scope.includes(request.role))) } });
            }
            if (request.type === 'rule.show') {
              const rule = rules.get().find(rule => rule.number === request.number);
              if (!rule) throw new Error(`no rule ${request.number}`);
              return peer.send({ type: 'result', id: request.id, ok: true, value: { rule } });
            }
            const reason = 'rule shell writes belong to the human or an Aide; Coordinators record through rule.add from a human message, and other roles propose a rule to the Coordinator';
            if (caller && caller.role !== 'aide') return this.#refuse(caller, frame, peer, request.type, reason);
            const authorize = () => {
              const now = this.#asSession(frame);
              if (caller && (!now || now.sessionId !== caller.sessionId || now.role !== 'aide')) throw new ToolForbidden(now?.role ?? null, request.type, reason);
            };
            const resumed = this.#guard.resumer(request.type, client);
            const workbench = !caller && (client === 'nvim' || client === 'ui');
            let writing: Promise<import('../rules/rulebook.ts').Rule>;
            if (request.type === 'rule.add') {
              if (!workbench && request.origin !== undefined && (typeof request.origin !== 'string' || !/^memory:[^\r\n]+$/.test(request.origin))) throw new Error('--origin may name only memory:<path>');
              const origin = workbench ? 'workbench' : typeof request.origin === 'string' ? request.origin : (caller ? `session:${caller.name}` : 'shell');
              writing = rules.add({ ...request, origin }, resumed, authorize);
            } else if (request.type === 'rule.edit') writing = rules.edit(request.number, { ...(request.title !== undefined ? { title: request.title } : {}), ...(request.text !== undefined ? { text: request.text } : {}), ...(request.scope !== undefined ? { scope: request.scope } : {}), ...(request.reason !== undefined ? { reason: request.reason } : {}), ...(workbench ? { origin: 'workbench' } : {}) }, resumed, authorize);
            else writing = rules.retire(request.number, request.reason, resumed, authorize, workbench ? 'workbench' : caller ? `session:${caller.name}` : 'shell');
            return later(request.type, writing.then(rule => resumed(() => {
              this.#guard.changed();
              return { type: 'result' as const, id: request.id, ok: true, value: { rule } };
            }), error => resumed(() => Dispatcher.#failure(request.id, error))));
          } catch (error) { return peer.send(Dispatcher.#failure(request.id, error)); }
        }
        if (isClientRequest(frame) && frame.type === 'role.launch') {
          const reason = 'role launch editing belongs to the Coordinator, an Aide or the human';
          if (caller && !['coordinator', 'aide'].includes(caller.role ?? '')) return this.#refuse(caller, frame, peer, frame.type, reason);
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || !['coordinator', 'aide'].includes(now.role ?? ''))) {
              this.#refuse(now ?? caller, frame, peer, frame.type, reason, '', false);
              throw new ToolForbidden(now?.role ?? null, frame.type, reason);
            }
          };
          const set = this.#options.control?.setRoleLaunch;
          if (!set) return peer.send(Dispatcher.#failure(frame.id, new Error('role launch editing is unavailable')));
          const resumed = this.#guard.resumer(frame.type, client);
          return later(frame.type, set(frame.role, frame.fields, resumed, authorize).then(
            value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: { ...value, ...(caller?.role === frame.role ? { applies: `${value.applies}; your own session keeps its settings until its next launch` } : {}) } })),
            error => resumed(() => Dispatcher.#failure(frame.id, error)),
          ));
        }
        if (isClientRequest(frame) && frame.type === 'config.set') {
          const reason = 'config editing belongs to the Coordinator, an Aide or the human';
          if (caller && !['coordinator', 'aide'].includes(caller.role ?? '')) return this.#refuse(caller, frame, peer, frame.type, reason);
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || !['coordinator', 'aide'].includes(now.role ?? ''))) throw new ToolForbidden(now?.role ?? null, frame.type, reason);
          };
          const set = this.#options.control?.setConfig;
          if (!set) return peer.send(Dispatcher.#failure(frame.id, new Error('config editing is unavailable')));
          const resumed = this.#guard.resumer(frame.type, client);
          return later(frame.type, set(frame.key, frame.value, resumed, authorize).then(
            value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value })),
            error => resumed(() => Dispatcher.#failure(frame.id, error)),
          ));
        }
        if (isClientRequest(frame) && (frame.type === 'crew.show' || frame.type === 'crew.set')) {
          const crew = core.crew;
          if (!crew) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub has no crew configuration')));
          const value = () => ({ config: crew.get(), summary: crewSummary(crew.get()) });
          if (frame.type === 'crew.show') return peer.send({ type: 'result', id: frame.id, ok: true, value: value() });
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || !['coordinator', 'lead', 'aide'].includes(now.role ?? ''))) throw new ToolForbidden(now?.role ?? null, 'crew.set', 'crew editing belongs to the Coordinator, a Lead, an Aide or the human');
          };
          if (caller && !['coordinator', 'lead', 'aide'].includes(caller.role ?? '')) return this.#refuse(caller, frame, peer, 'crew.set', 'crew editing belongs to the Coordinator, a Lead, an Aide or the human');
          const resumed = this.#guard.resumer(frame.type, client);
          let input = frame.value;
          if (frame.key === 'idle_from') {
            try {
              const tracker = this.#options.tracker;
              if (!tracker) throw new Error('this hub has no tracker');
              const ids = parseIdleFrom(input, tracker.ladder);
              const resolved = resolveCrewIdle({ ...crew.get(), idle_from: ids }, tracker);
              if (resolved.idle_ignored.length) throw new Error(resolved.idle_ignored.map(item => `idle_from ${item.id}: ${item.reason}`).join('; '));
              input = ids;
            } catch (err) { return peer.send(Dispatcher.#failure(frame.id, err)); }
          }
          return later(frame.type, crew.set(frame.key, input, resumed, authorize).then(
            () => resumed(() => ({ type: 'result', id: frame.id, ok: true, value: value() })),
            err => resumed(() => Dispatcher.#failure(frame.id, err)),
          ));
        }
        if (isClientRequest(frame) && (frame.type === 'suite.slot' || frame.type === 'suite.forced')) {
          if (!this.#suites) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub serves no project for suites')));
          if ('check' in frame) {
            return later(frame.type, this.#suites.checkSlot(frame.lease, caller?.sessionId === UNKNOWN_SESSION ? undefined : caller?.sessionId).then(value => ({ type: 'result', id: frame.id, ok: true, value }), error => Dispatcher.#failure(frame.id, error)));
          }
          if (caller) return this.#refuse(caller, frame, peer, frame.type, 'human suite slots belong to runners outside a cland session');
          if (!isAbsolute(frame.cwd)) return peer.send(Dispatcher.#failure(frame.id, new Error('suite cwd must be absolute')));
          if (frame.type === 'suite.forced') {
            return later(frame.type, this.#suites.forced(frame).then(() => ({ type: 'result', id: frame.id, ok: true, value: {} }), error => Dispatcher.#failure(frame.id, error)));
          }
          try {
            const owner = peer;
            if (!humanSlot) { humanSlot = true; onClose.push(() => this.#suites?.leave(owner)); }
            return peer.send({ type: 'result', id: frame.id, ok: true, value: this.#suites.slot(frame, owner) });
          } catch (error) { return peer.send(Dispatcher.#failure(frame.id, error)); }
        }
        if (isClientRequest(frame) && frame.type === 'suite.classify') {
          if (!this.#suites) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub serves no project for suites')));
          if (caller && caller.role !== 'coordinator') return this.#refuse(caller, frame, peer, frame.type, 'cover classification belongs to the Coordinator or the human');
          const authorize = () => {
            const now = this.#asSession(frame);
            if (caller && (!now || now.sessionId !== caller.sessionId || now.role !== 'coordinator')) throw new ToolForbidden(now?.role ?? null, frame.type, 'cover classification belongs to the Coordinator or the human');
          };
          try {
            const value = this.#suites.classify(frame.suite, frame.cause, frame.note, caller?.name ?? HUMAN_SESSION, authorize);
            return peer.send({ type: 'result', id: frame.id, ok: true, value });
          } catch (error) { return peer.send(Dispatcher.#failure(frame.id, error)); }
        }
        if (frame.type === 'suite.cancel' && isClientRequest(frame)) {
          if (!this.#suites) return peer.send(Dispatcher.#failure(frame.id, new Error('this hub serves no project for suites')));
          const request = frame as import('../protocol.ts').SuiteCancel;
          const actor = caller ? { name: caller.name, sessionId: caller.sessionId, shell: true as const } : null;
          const authorize = () => {
            const now = this.#asSession(frame);
            if (actor && now?.sessionId !== actor.sessionId) throw new Error('suite caller identity is unavailable');
          };
          later('suite.cancel', this.#suites.cancel(request.suite, actor, authorize).then(value => ({ type: 'result', id: request.id, ok: true, value }), error => Dispatcher.#failure(request.id, error)));
          return;
        }
        if (frame.type === 'suite.start') return startSuite(frame, () => this.#asSession(frame));
        if (isSubscriptionRequest(frame)) return subscriptionRequest(frame, caller);
        if (isSessionRequest(frame)) return session(frame);
        if (frame.type === 'artifact.keep' || frame.type === 'artifact.archive' || frame.type === 'artifact.move') return artifactChange(frame as ArtifactKeep | ArtifactArchive | ArtifactMove, () => this.#asSession(frame));
        if (isClientRequest(frame) && frame.type === 'artifact.delete') {
          const resumed = this.#guard.resumer(frame.type, client);
          const authorize = () => {
            const current = this.#asSession(frame);
            if (current) throw new ToolForbidden(current.role, frame.type, 'only the human may delete artifacts');
          };
          later(frame.type, this.artifacts.delete(frame.artifact, authorize, resumed).then(
            value => resumed(() => ({ type: 'result', id: frame.id, ok: true, value }) as HubFrame),
            err => resumed(() => Dispatcher.#failure(frame.id, err)),
          )); return;
        }
        if (frame.type === 'artifact.promote') return promote(frame as ArtifactPromote, caller);
        if (frame.type === 'artifact.create' || frame.type === 'artifact.list') {
          return artifact(frame as ArtifactCreate | ArtifactList, () => this.#asSession(frame));
        }
        if (frame.type === 'prompt.send' || (frame.type === 'topic.send' && frame.artifacts !== undefined)) return attachedSend(frame, () => this.#asSession(frame));
        if (isClientRequest(frame) && (frame.type === 'release' || frame.type === 'release.preflight' || frame.type === 'sync' || frame.type === 'push' || frame.type === 'publish')) {
          const tool = releasePermissionTool(frame.type);
          const allowedRole = (role: string | null | undefined) => role === 'coordinator' || (tool === 'push' && role === 'aide');
          const roles = tool === 'push' ? 'Coordinator or an Aide' : 'Coordinator';
          if (caller && (client !== 'cli' || !allowedRole(caller.role))) return this.#refuse(caller, frame, peer, tool, `${tool} belongs to the human or the ${roles} from its own shell`);
          if (!this.#releases) return peer.send(Dispatcher.#failure(frame.id, new ReleaseError('release-state', 'this hub has no tracker')));
          const resumed = <T,>(write: () => T): T => this.#guard.measure(tool, client, write, 'resumed');
          const authorize = () => {
            if (!caller) return;
            const now = this.#asSession(frame);
            const grants = core.roles?.get().get(now?.role ?? '')?.permissions.tools;
            const decision = decide(now?.role ?? null, grants, { tool });
            if (!now || !allowedRole(now.role) || !decision.ok) {
              const reason = decision.ok ? `the calling session no longer holds ${roles}` : decision.reason;
              if (now) this.#refuse(now, frame, peer, tool, reason, '', false);
              throw new ToolForbidden(now?.role ?? null, tool, reason);
            }
          };
          const actor = caller ? sessionActor(caller, UNKNOWN_SESSION) : { id: 'human', name: 'human', role: null, human: true };
          const operation = frame.type === 'publish' ? this.#releases.publish(frame.branch, frame.item, frame.dryRun === true, this.#options.projectConfig?.().publish.allowPaths ?? defaultConfig('').publish.allowPaths, resumed, authorize, actor) : frame.type === 'release.preflight' ? this.#releases.preflight(frame.version, frame.item, resumed, authorize) : frame.type === 'release' ? this.#releases.release(frame.version, frame.dryRun === true, resumed, authorize, actor, frame.item) : frame.type === 'push' ? this.#releases.push(resumed, authorize) : this.#releases.sync(resumed, authorize);
          later(tool, operation.then(
            (value): HubFrame => resumed(() => ({ type: 'result', id: frame.id, ok: true, value })),
            (err: unknown) => resumed(() => Dispatcher.#failure(frame.id, err)),
          ));
          return;
        }
        if (frame.type === 'merge' && isClientRequest(frame)) return merge(frame as import('../protocol.ts').MergeRequest, caller);
        if (frame.type === 'artifact.upload' && caller) return peer.send(Dispatcher.#failure(String(frame.id), new ToolForbidden(caller.role, 'artifact.upload', 'only the human may upload artifacts')));
        clientRequest(frame, via, messageId, bytes, answerInput);
    };

    return {
      ...(transport.edge === 'gateway' ? { commitBatch: (write: () => void) => core.store.transaction(write), messageReceipt: (messageId: string, via?: import('../protocol.ts').RemoteVia) => {
        if (done || !peer.isOpen()) return null;
        let message = core.store.message(messageId);
        if (!message && via) {
          // Native answers have their own message id. Resolve only the receipt
          // committed with this messenger's exact ingress, then read current stage.
          const raw = core.store.remotes.forMessenger(via).get(`gateway.answer:${messageId}`);
          if (raw) {
            try {
              const receipt = JSON.parse(raw) as { value?: { message?: { id?: unknown } } };
              const id = receipt.value?.message?.id;
              if (typeof id === 'string') { messageId = id; message = core.store.message(id); }
            } catch { return null; } // Unreadable receipts supply no recovery authority.
          }
        }
        const stage = core.store.stage(messageId);
        return message?.topic ? { ...message, topic: message.topic, seq: core.store.messageSeq(messageId), ...(stage ? { stage } : {}) } : null;
      } } : {}),
      receive: (raw, via, messageId, bytes, userId, answerInput) => {
        if (done) return;
        const frame = parseFrame(raw);
        if (!frame) return refuse('bad-hello', 'not a frame');
        if (credentialPending) return refuse('bad-hello', 'session credentials are still being prepared');
        if (kind === null) {
          // A browser cannot carry an actor even on its initial hello. Keep the
          // hello deadline armed until a valid, actor-free hello is received.
          const refusal = transport.edge === 'web' && Object.hasOwn(frame, 'as') ? webAuthorityRefusal(frame) : null;
          if (refusal) return peer.send(refusal);
          return hello(frame);
        }
        // the handler's time on the event loop, against the budget: over it is a `slow-request` in the log
        this.#guard.measure(String(frame.type), kind === 'spoke' ? (name ?? '?') : client, () => handle(frame,
          transport.edge === 'gateway' ? via : undefined, transport.edge === 'gateway' && via ? messageId : undefined, bytes, transport.edge === 'gateway' ? userId : undefined, transport.edge === 'gateway' ? answerInput : undefined));
      },
      drainUploads: async () => { await Promise.allSettled([...uploads]); },
      closed: () => {
        done = true;
        if (hostId) { const peers = this.#hostPeers.get(hostId); peers?.delete(closeHost); if (!peers?.size) this.#hostPeers.delete(hostId); }
        if (kind === 'spoke') this.#guard.changed();
        for (const queue of audits.values()) for (const base of queue) log({ event: 'audit', ...base, outcome: 'error', error: 'the connection closed before the answer' });
        audits.clear();
        clearTimeout(helloTimer);
        unsubscribe?.();
        unsubscribe = null;
        for (const fn of onClose.splice(0)) fn();
        if (connection !== null) core.disconnect(connection, spoke ?? undefined);
      },
    };
  }
}
