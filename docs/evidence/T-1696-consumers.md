# T-1696 consumer sweep

Search: HarnessAdapter, AdapterHost, native adapter classes, connections and forwards across hub, web, nvim, skills, QA and docs. No wire or persisted shape changes. The optional hook leaves structural fakes valid. Native classes move transient state into generation scopes; Sessions gains the explicit handoff entry point. Every other importer, recording fake, observer and preservation test retains its existing API and is unaffected.

Paths searched before implementation (all test tiers included):

- `docs/hub/declining-an-accepted-verifier-request-t-1494.md`
- `docs/hub/asks-and-the-inbox.md`
- `docs/hub/adapters-and-sessions.md`
- `docs/agents/tests/hub-test-scenarios-hook-bridge.test.ts.md`
- `docs/agents/tests/hub-test-session-host.test.ts.md`
- `qa/briefs/E-1531-stage-3.md`
- `qa/briefs/E-1532-stage-4.md`
- `qa/briefs/E-1531.md`
- `qa/briefs/E-1531-stage-2.md`
- `docs/agents/tests/hub-test-claude-code-host.test.ts.md`
- `docs/agents/tests/hub-test-secrets-environment.test.ts.md`
- `.agents/skills/implement/CHANGES/T-1607-observer-consumer-sweep.md`
- `hub/src/transport/ssh.ts`
- `hub/src/adapters/sessions.ts`
- `hub/src/adapters/opencode.test.ts`
- `hub/src/adapters/index.ts`
- `hub/src/adapters/codex.ts`
- `hub/src/adapters/opencode.ts`
- `hub/src/adapters/claude-code-local.ts`
- `hub/src/adapters/claude-code.ts`
- `hub/src/adapters/contract.ts`
- `hub/test/opencode-remote-cleanup.test.ts`
- `.agents/skills/implement/CHANGES/T-1607-merged-settlement.md`
- `hub/test/host-ssh-contract.test.ts`
- `hub/test/session-host-routing.test.ts`
- `hub/test/session-host.test.ts`
- `hub/test/harness.ts`
- `hub/test/opencode-launch-policy.test.ts`
- `hub/test/nvim-sessions-rules.test.ts`
- `hub/test/codex-host.test.ts`
- `hub/test/claude-code-remote.test.ts`
- `hub/test/claude-code-remote-files.test.ts`
- `hub/test/inject-stalled.test.ts`
- `hub/test/host-attach.test.ts`
- `hub/test/opencode-adapter.test.ts`
- `hub/test/lead-permissions-component.test.ts`
- `hub/test/opencode-host.test.ts`
- `hub/test/request-guard.test.ts`
- `hub/test/adapter-native-boundary.test.ts`
- `hub/test/subscription-hub.ts`
- `hub/test/opencode-remote.test.ts`
- `hub/test/codex-remote-agent.test.ts`
- `hub/test/codex-remote.test.ts`
- `hub/test/host-revoke.test.ts`
- `hub/test/claude-stop-owner-component.test.ts`
- `hub/test/fakes/remote-approval-harness.ts`
- `hub/test/fake-harness.test.ts`
- `hub/test/session-host-placement.test.ts`
- `hub/test/claude-code-host.test.ts`
- `hub/test/host-launch-layout.test.ts`
- `hub/test/fakes/scripted-opencode.ts`
- `hub/test/session-cwd.test.ts`
- `hub/test/human-hold.test.ts`
- `hub/test/secrets-environment.test.ts`
- `hub/test/fakes/scripted-codex.ts`
- `hub/test/fakes/harness.ts`
- `hub/test/host-revoke-native.test.ts`
- `hub/test/codex-remote-cleanup.test.ts`
- `hub/test/claude-code-environment.test.ts`
- `hub/test/claude-code-schedule.test.ts`
- `hub/test/tracker-native-boundary.test.ts`
- `hub/test/codex-sandbox-host.test.ts`
- `hub/test/host-survival-native.test.ts`
- `hub/test/mod-bridge.test.ts`
- `hub/test/claude-code-sessions.test.ts`
- `hub/test/claude-code-accounts.test.ts`

## Forward ownership extension

Search: `.forward(`, `.unforward(`, `sessionSocket(`, and transport forward records. SSH Host forwards the opaque string unchanged; SshTransport hashes it through hostPaths.sessionSocket, keeps it only in its in-memory map, and reconnect replays that map. There is no persisted forward-id record/schema in SshTransport. Stop removes every owned entry, regardless of id shape. Fake SSH sees hashed socket/spec strings, not a parsed session id. Host survival/restart and transport status consumers do not parse adapter forward ids. Legacy ids continue to work through the unchanged Host and Transport APIs; a regression exercises both legacy and scoped ids. T-1671 remains the existing post-hub-restart adapter forward settlement boundary.

- `docs/hub/ssh-transport.md` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `qa/briefs/E-1532-stage-4.md` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/src/hub/dispatch.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/claude-code-remote.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/host-ssh-contract.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/host-contract.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/transport-forwards.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/opencode-remote.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/codex-remote-agent.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/host-records.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/src/adapters/codex.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/src/adapters/opencode.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/host-survival.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/ssh-host-fixture.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/launch-files.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/test/host-revoke-native.test.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/src/host/ssh-host.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.
- `hub/src/transport/ssh.ts` — unchanged opaque forward-id consumer; no parser or persistence migration.

## Public method wrappers

Search: adapter method assignments and bind(adapter), including native fixtures and fake lifecycle delegation. Explicit writes/definitions/deletions on the facade retain their normal public behavior; captured routed methods still dispatch to their generation. The following wrappers are preserved rather than bypassed:

```text
hub/test/host-ssh-contract.test.ts:124:  const adapter=fakeHarness('codex',{host,clock});const spawn=adapter.spawn.bind(adapter);
hub/test/host-ssh-contract.test.ts:125:  adapter.spawn=async request=>{
hub/test/host-reboot.test.ts:29:    adapter.resume = async()=>{throw new Error('unavailable tunnel is not a reboot');};
hub/test/host-reboot.test.ts:30:    adapter.stop = async()=>{throw new Error('native stop forbidden');};
hub/test/host-reboot.test.ts:60:  adapter.resume=async()=>{entered.resolve();await release.promise;return {found:true,process:p,state:'idle'};};
hub/test/host-reboot-native.test.ts:54:    const adapter=fakeHarness(flavour,{host}); const spawn=adapter.spawn.bind(adapter);
hub/test/host-reboot-native.test.ts:57:    adapter.spawn=async(request,resumed,authorize)=>{
hub/test/host-reboot-native.test.ts:63:    adapter.resume=async p=>({found:false,alive:true,reason:'native fake worker remains alive'});
hub/test/host-reboot-native.test.ts:64:    adapter.stop=async()=>{operations.push('adapter:stop');throw new Error('stop forbidden');};
hub/test/opencode-launch-policy.test.ts:144:  f.adapter.spawn = async (...args) => ({ ...await spawn(...args), pid: null });
hub/test/host-registry.test.ts:102:  adapter.watch = () => { nativeCalls.push('watch'); };
hub/test/host-registry.test.ts:103:  adapter.stop = async () => { nativeCalls.push('stop'); };
hub/test/host-registry.test.ts:104:  adapter.resume = async () => { nativeCalls.push('resume'); throw new Error('must not resume unknown host'); };
hub/test/session-archive.test.ts:207:  adapter.resume = async process => { throw new LaunchRecoveryPending(process.sessionId,
hub/test/lead-permissions-component.test.ts:177:    fakes.codex!.spawn = adapter.spawn.bind(adapter);
hub/test/human-hold.test.ts:274:  Object.assign(f.fake, { bridge: adapter.bridge.bind(adapter), unwatch: adapter.unwatch.bind(adapter) });
hub/test/fakes/remote-approval-harness.ts:50:    lifecycle.watch = adapter.watch.bind(adapter);
hub/test/fakes/remote-approval-harness.ts:51:    lifecycle.unwatch = adapter.unwatch.bind(adapter);
hub/test/fakes/remote-approval-harness.ts:52:    lifecycle.answerApproval = adapter.answerApproval!.bind(adapter);
hub/test/session-host-placement.test.ts:97:    const spawn = adapter.spawn.bind(adapter);
hub/test/session-host-placement.test.ts:98:    adapter.spawn = async (request, resumed, authorize) => {
hub/test/fakes/scripted-opencode.ts:160:    lifecycle.inject = adapter.inject.bind(adapter);
hub/test/fakes/scripted-opencode.ts:161:    lifecycle.watch = adapter.watch.bind(adapter);
hub/test/fakes/scripted-opencode.ts:162:    lifecycle.unwatch = adapter.unwatch.bind(adapter);
hub/test/fakes/scripted-opencode.ts:163:    lifecycle.usage = adapter.usage.bind(adapter);
hub/test/fakes/scripted-opencode.ts:164:    lifecycle.answerApproval = adapter.answerApproval?.bind(adapter);
hub/test/fakes/scripted-codex.ts:115:    lifecycle.inject = adapter.inject.bind(adapter);
hub/test/fakes/scripted-codex.ts:116:    lifecycle.watch = adapter.watch.bind(adapter);
hub/test/fakes/scripted-codex.ts:117:    lifecycle.unwatch = adapter.unwatch.bind(adapter);
hub/test/fakes/scripted-codex.ts:118:    lifecycle.usage = adapter.usage.bind(adapter);
hub/test/fakes/scripted-codex.ts:119:    lifecycle.stateReason = adapter.stateReason.bind(adapter);
hub/test/host-revoke-native.test.ts:61:    boundary=>{const adapter=new ClaudeCodeAdapter(boundary,{clock,bin:new URL('./fakes/claude-code/claude',import.meta.url).pathname,stopGraceMs:50});const launch=adapter.spawn.bind(adapter);adapter.spawn=request=>launch({...request,accountEnv:claudeEnv});return adapter;},
hub/test/host-revoke-native.test.ts:63:    boundary=>{const adapter=new OpenCodeAdapter(boundary,{clock,bin:new URL('./fakes/opencode/opencode',import.meta.url).pathname,stopGraceMs:50,env:fixtureEnvironment(f.root,f.env)});const release=adapter.releaseHostGeneration.bind(adapter);adapter.releaseHostGeneration=async(p,authorize)=>{try{await release(p,authorize);}catch(error){retirementFailures.push({session:p.name,error:redact(String(error))});throw error;}};return adapter;},
hub/test/host-survival-native.test.ts:55:      const spawn = adapter.spawn.bind(adapter);
hub/test/host-survival-native.test.ts:56:      adapter.spawn = request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...claude.env,CLAUDE_CONFIG_DIR:claude.home})});
hub/test/host-survival-native.test.ts:61:      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,...codex.env})});return adapter;
hub/test/host-survival-native.test.ts:65:      const spawn = adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:fixtureEnvironment(f.root,process.env,{...env,FAKE_OPENCODE_HOME:join(second.home,'native'),FAKE_OPENCODE_SOCKET:join(second.home,'session.sock'),FAKE_OPENCODE_TURN_MS:'30'})});return adapter;
hub/test/host-survival.test.ts:44:    const resume = adapter.resume.bind(adapter);
hub/test/host-survival.test.ts:45:    adapter.resume = async (p, options) => {
hub/test/host-survival.test.ts:86:  const resume = adapter.resume.bind(adapter);
hub/test/host-survival.test.ts:87:  adapter.resume = async (row,options) => {
hub/test/claude-code-remote.test.ts:44:   const forget=adapter.forget.bind(adapter);adapter.forget=id=>{if(options.failPrune&&!pruneFaultInjected){pruneFaultInjected=true;throw new Error('planted post-clear prune interruption');}forget(id);};
hub/test/claude-code-remote.test.ts:45:   const spawn=adapter.spawn.bind(adapter);adapter.spawn=request=>spawn({...request,accountEnv:env});return adapter;
```

Compatibility correction after initial preservation: the first scope reserves the raw legacy session id; later scopes alone add a namespace. Existing public forward-id observations therefore remain unchanged for existing single-generation flows.

## Hub-local forward drop contract

Sessions now owns local cleanup after the native adapter receipt. Transport.dropForwardLocal is optional, retaining structural doubles; production SshTransport implements it under its existing forward/reconnect serial owner. It changes no wire or persisted schema: SshTransport forward inventory is in-memory. The session entry point refuses nonempty cleanup when no local carrier capability is registered. Existing transport, Host and recording consumers are unchanged unless listed as migrated below.

Migrated: adapters/contract.ts receipt adds opaque forwardIds; generation-adapter.ts captures actual carrier ids; sessions.ts validates the exact generation before local cleanup; transport/transport.ts owns registry dispatch; transport/ssh.ts removes local entries/socket without network commands; new real-transport regression proves inventory removal and replacement reconnect. T-1614 consumes the new Sessions method after merge.

- `hub/src/hub/dispatch.ts` — optional interface addition; existing operations unaffected.
- `docs/hub/ssh-transport.md` — optional interface addition; existing operations unaffected.
- `qa/briefs/E-1532-stage-2.md` — optional interface addition; existing operations unaffected.
- `hub/test/transport-ssh.test.ts` — optional interface addition; existing operations unaffected.
- `qa/briefs/E-1532-stage-3.md` — optional interface addition; existing operations unaffected.
- `docs/evidence/T-1696-consumers.md` — optional interface addition; existing operations unaffected.
- `qa/briefs/E-1532-stage-4.md` — optional interface addition; existing operations unaffected.
- `qa/briefs/E-1538.md` — optional interface addition; existing operations unaffected.
- `qa/briefs/E-1538-stage-1.md` — optional interface addition; existing operations unaffected.
- `hub/test/host-ssh-contract.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/claude-code-remote.test.ts` — optional interface addition; existing operations unaffected.
- `hub/src/host/code-delivery.ts` — optional interface addition; existing operations unaffected.
- `hub/src/host/registry.ts` — optional interface addition; existing operations unaffected.
- `hub/src/host/records.ts` — optional interface addition; existing operations unaffected.
- `hub/src/host/ssh-host.ts` — optional interface addition; existing operations unaffected.
- `.agents/skills/implement/CHANGES/T-1599-worklog.md` — optional interface addition; existing operations unaffected.
- `hub/src/host/transport-kind.ts` — optional interface addition; existing operations unaffected.
- `hub/src/transport/transport.ts` — optional interface addition; existing operations unaffected.
- `hub/src/transport/ssh.ts` — optional interface addition; existing operations unaffected.
- `hub/test/transport-forwards.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/host-flush.test.ts` — optional interface addition; existing operations unaffected.
- `.agents/skills/implement/CHANGES/T-1598-session-forwards.md` — optional interface addition; existing operations unaffected.
- `hub/test/transport-kind.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/host-clone-integration.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/transport-contract-fixture.ts` — optional interface addition; existing operations unaffected.
- `hub/test/opencode-remote.test.ts` — optional interface addition; existing operations unaffected.
- `docs/agents/tests/hub-test-transport-fake-contract.test.ts.md` — optional interface addition; existing operations unaffected.
- `hub/test/transport-status.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/transport-contract.ts` — optional interface addition; existing operations unaffected.
- `hub/test/host-ref-watch-recovery.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/ssh-host-fixture.ts` — optional interface addition; existing operations unaffected.
- `hub/test/host-revoke-native.test.ts` — optional interface addition; existing operations unaffected.
- `hub/test/remote-discovery-host.test.ts` — optional interface addition; existing operations unaffected.

Stopped carrier receipt correction: Sessions captures the registration owner before
its Host proxy admits forward(id). Transport registration stores that owner, and
SshTransport publishes only positively removed ids after joining shutdown. The
registry dispatch validates active or stopped captured owners before local effects.
Existing claimTransport release callbacks retain their zero-argument signature;
transport-status and all structural doubles remain compatible. New controls cover
positive stop-before-release plus absent/replaced-owner refusal.

## Bridge and identity preservation sweep (configured T2 findings)

The earlier unaffected classification was wrong for human-hold, mod-bridge and
session-host. The unchanged tests are the regression seams: 32/32 dev baseline;
the three stale-bridge cases reproduce locally in under one second; four bridge
and Host identity cases turn green after current bridge admission plus local Host
identity preservation; the full three files plus new generation cases pass41/41
after retaining each concrete inherited adapter constructor per scope.

Production consumers: adapters/requests.ts and hub/dispatch.ts admit session.bridge;
sessions.ts pins the native generation and logs captured job/PID on closure;
claude-code.ts owns bridge generation invalidation and confirm; cli/hook.ts and
hub/mod/cland/hooks/register.ts implement native mod reconnect; shared/socket-client.ts
and shared/wire/index.ts retain the previous wire shape. No bridge frame or client
wire changes. The native-only facade now promotes admitted bridge scopes for
id-only unwatch/launch invalidation, preserving captured disconnect semantics.
Concrete subclass spawn/watch overrides run on that subclass in each scope; local
Host lookup returns the original object, while remote forward admission retains
its existing owner wrapper.

The search covers fields, frame names, method names, wrappers and class inheritance
across all tiers and includes the shipped mod even where ordinary rg ignores it.
The complete name-match inventory follows; QA/skill/docs references describe the
unchanged bridge flow, so no instruction or authority migration is required.

- `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`
- `docs/agents/host-agent.md`
- `docs/agents/interaction-scanner-baseline.md`
- `docs/agents/tests/hub-test-host-secret-admission.test.ts.md`
- `docs/agents/tests/hub-test-human-hold.test.ts.md`
- `docs/agents/tests/hub-test-mod-bridge.test.ts.md`
- `docs/agents/tests/index.md`
- `docs/evidence/T-1696-consumers.md`
- `docs/hub/adapters-and-sessions.md`
- `docs/hub/roles.md`
- `docs/hub/web-edge.md`
- `hub/mod/cland/hooks/register.ts`
- `hub/src/adapters/claude-code.ts`
- `hub/src/adapters/contract.ts`
- `hub/src/adapters/generation-adapter.ts`
- `hub/src/adapters/launch-generation.ts`
- `hub/src/adapters/processes.ts`
- `hub/src/adapters/requests.ts`
- `hub/src/adapters/sessions.ts`
- `hub/src/cli/hook.ts`
- `hub/src/host/host-authority.ts`
- `hub/src/hub/core.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/web-authority.ts`
- `hub/test/claude-code-environment.test.ts`
- `hub/test/claude-code-remote-files.test.ts`
- `hub/test/claude-code-schedule.test.ts`
- `hub/test/claude-code-sessions.test.ts`
- `hub/test/fake-harness.test.ts`
- `hub/test/host-revoke-native.test.ts`
- `hub/test/host-revoke.test.ts`
- `hub/test/host-secret-admission.test.ts`
- `hub/test/human-hold.test.ts`
- `hub/test/mod-bridge.test.ts`
- `hub/test/scenarios/hook-bridge.test.ts`
- `hub/test/web-authority-unit.test.ts`
- `qa/briefs/E-1280-stage-1.md`
- `qa/briefs/E-1280.md`
- `qa/briefs/E-1532-stage-2.md`
- `shared/socket-client.ts`
- `shared/wire/index.ts`
