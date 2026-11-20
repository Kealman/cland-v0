# T-1858 contract consumers

Second full-run repair: isExpectedPaidTerms and ExpectedPaidTerms now live in
dependency-free host/paid-terms-input.ts. protocol.ts imports that input module;
paid-terms.ts re-exports the same guard/type for existing consumers while keeping
config projection/comparison behind the effect owner. Search by guard, type and
module name found hub/src/protocol.ts, host/login-add.ts, host/login-signin.ts,
host/provider/pool-image.ts, setup/hub.ts, host/paid-terms.ts and
hub/test/host-pools-config.test.ts. Existing type-only paths remain compatible;
wire fields and validation grammar are unchanged. cli-imports is T3/native,
not T1, and its budget remains unchanged.

Failed full-run repair (b0630ca1): site/test readers were missing from the first
usage inventory. site/test/remote-docs.test.ts, users-docs.test.ts and
hosts-docs.test.ts import SETUP_USAGE through the facade. The remote vocabulary
assertion is included by hub/test/remote-docs.test.ts. shared/hub-reference.ts
expands every hub index pointer without deduplication; a second cland-setup
pointer appended that whole guide again, widening a heading-delimited remote
section. Removing only the redundant pointer makes the unchanged 18-error
assertion green while leaving all help and guide bytes unchanged.

Other direct hubReference consumers searched: hub/test/session-usage.test.ts,
roles-clauses.test.ts, web-readme.test.ts and site/test/remote-docs.test.ts.
The reader's grammar, expansion behavior and all tests remain unchanged. The
existing primary setup pointer stays in hub/README.md.

Other site/test/docs usage-export readers searched: docs/hub/suite-run-references.md,
operator-retry-of-queued-input-t-1473.md, the-cland-cli.md, running.md (all under
docs/hub); docs/brand/launch-claims-audit-T-783.md; docs/evidence/T-957-brief-lint.md;
docs/agents/tests/hub-test-web-readme.test.ts.md and
hub-test-cli-usage-merge.test.ts.md. They are references/history rather than a
changed runtime parser. No usage export or frozen help bytes change in this
repair. Earlier consumer dispositions and failed epochs remain separate.

Source3 residual ownership repair: stageCase synchronously closes admission on
TestContext.signal abort, and removes that listener only after successful
cleanup/restoration. Already-aborted contexts are fenced before run. Synthetic
contexts without a signal retain their prior normal/OS-signal cleanup. The
pool fixture's exact setup writes have their own named observation bound.

stageCase/function/importer search (including indirect shared fixture readers):
hub/test/tracker-summary.test.ts, stage-closure-component.test.ts,
host-prepare.test.ts, dev-t3-coverage-component.test.ts, item-summary-scale.test.ts,
host-provider-digitalocean-prepare.test.ts, startup-ready-component.test.ts,
startup-listener-scale.test.ts, case-deadlines.test.ts, login-host-pin.test.ts,
suite-persistence.test.ts, fixture-orphans.test.ts, tip-churn-file-fixture.ts,
fixture-receipt-case.ts and stage-case-fixture.ts (all under hub/test).
Matching per-file notes under docs/agents/tests were read as ownership guidance;
they have no runtime admission. This change adds no wire/frame/frozen-help field.
case-deadlines supplies the actual held-work abort/rejected-close controls;
stage-closure-component's passes are stage-cover evidence only.

Source review repair: the four new async cases use stageCase before acquisition,
with positive native guards through required resource close and root disposal.
The scripted DigitalOcean fixture accepts an optional already-owned stateRoot;
other callers omit it and retain their previous allocation/transport. The
admission fixture registers its DB/lease cleanup before lease-schema construction.
All consumers of these shared fixture seams were searched (no wire or reply
change):

- `qa/briefs/E-1537-stage-3.md`
- `qa/briefs/E-1538-stage-1.md`
- `hub/test/host-provider-tokens.test.ts`
- `hub/test/executor-admission.test.ts`
- `hub/test/setup-hosts.test.ts`
- `hub/test/hosts-state.test.ts`
- `hub/test/suite-dry-run.test.ts`
- `hub/test/executor-safety.test.ts`
- `hub/test/executor-deletion-confirmation.test.ts`
- `hub/test/host-admission-fixture.ts`
- `hub/test/host-provider-digitalocean-prepare.test.ts`
- `hub/test/host-lease.test.ts`
- `hub/test/host-provider-digitalocean.test.ts`
- `hub/test/executor-contract.test.ts`
- `hub/test/executor-droplet.test.ts`
- `hub/test/fakes/digitalocean/fake-api.ts`
- `hub/test/suite-unit-fixture.ts`
- `hub/test/startup-ready-component.test.ts`
- `hub/test/remote-fixture.ts`
- `hub/test/executor-snapshot-confirmation.test.ts`
- `hub/test/daemon.test.ts`
- `hub/test/scenarios/integrated-v04.test.ts`
- `hub/test/executor-prepare.test.ts`
- `hub/test/host-provider-digitalocean-volumes.test.ts`
- `hub/test/doctor-hosts.test.ts`
- `hub/test/digitalocean-pacing.test.ts`
- `hub/test/executor-prepare-component.test.ts`

Setup help changed to name the restarted-hub boundary, older-peer race and
restart mitigation. The frozen SETUP_USAGE block is migrated to exact new bytes;
all other help blocks stay unchanged.

Internal optional capture propagation also searched `preparePool`,
`provider.prepare` and `HostProvider.*prepare`. Direct executor consumer:
DigitalOceanHostProvider. Existing provider contract and DigitalOcean provider
tests omit captured config and retain the legacy path; the new prepare fixture
exercises the captured path. Additional matches: hub/test/host-provider-contract.ts,
hub/test/host-provider-digitalocean.test.ts,
hub/test/host-provider-digitalocean-prepare.test.ts,
qa/briefs/E-1533.md and qa/briefs/E-1533-stage-1.md. Other matches appear below.

Search: frame names host.prepare/login.add/config.set; functions preparePools,
preparePoolLogin, setConfigValue/setConfig; pool keys hosts.agents; all hub,
Neovim, web, shared, shipped skills, QA and docs (all test tiers included).
No Neovim production caller matched these frame/function names.

Migrated production: setup hub/hosts, protocol and browser wire declarations,
dispatch, configuration/daemon, pool image owner/provider/executor, login owner.
The pool projection is shared in pools.ts. Config expectations compare raw TOML
values; absent is null. No expectation remains supported on all three frames.

Unchanged callers: CLI host/login/login-terminal and web HostsView omit expected
terms and retain manual semantics; setup remotes/discord writer calls omit CAS.
Injected preparation and create seams accept optional fields. Auth preparation
uses the existing writer without CAS. Permission tables, API refusal shape,
metadata readers and durable image/login record shapes are unchanged. Existing
CLI preparation and login tests are previous-wire regressions. QA/skill prose
that demonstrates manual commands requires no request change; historical
briefs preserve their original run instructions. Setup usage and its frozen
help fixture are updated together for the supported-peer limitation.

Matched files (each migrated above or unaffected by additive optional inputs,
unchanged results, historical evidence or manual-command prose):

- `docs/hub/logins.md`
- `shared/wire/index.ts`
- `hub/src/hub/configuration.ts`
- `hub/src/hub/dispatch.ts`
- `hub/src/hub/web-authority.ts`
- `hub/src/hub/daemon.ts`
- `docs/agents/session-permissions.md`
- `docs/hub/implementation/logins.md`
- `docs/hub/implementation/hosts.md`
- `hub/src/protocol.ts`
- `docs/hub/host-providers.md`
- `docs/hub/pool-scaling.md`
- `docs/hub/cland-setup.md`
- `docs/hub/web-workspace.md`
- `qa/briefs/E-1534-stage-2.md`
- `qa/briefs/E-1537-stage-3.md`
- `qa/briefs/E-1534.md`
- `hub/src/cli/host.ts`
- `qa/briefs/E-1537-stage-1.md`
- `web/src/sessions/signin-cards.ts`
- `web/src/sessions/HostsView.tsx`
- `qa/briefs/E-1534-stage-1.md`
- `hub/src/cli/login-terminal.ts`
- `qa/briefs/E-1533-stage-2.md`
- `hub/src/cli/login.ts`
- `qa/briefs/E-1537.md`
- `web/src/connection.ts`
- `qa/briefs/E-1537-stage-2.md`
- `hub/src/setup/steps/remotes.ts`
- `hub/src/setup/steps/discord.ts`
- `hub/src/setup/steps/hosts.ts`
- `hub/src/setup/hub.ts`
- `qa/briefs/E-1537-stage-4.md`
- `hub/src/host/login-add.ts`
- `web/test/hosts-view.test.ts`
- `web/test/hosts.test.ts`
- `qa/briefs/E-1534-stage-3.md`
- `hub/src/host/provider/pool-image.ts`
- `hub/src/init/config-set.ts`
- `docs/agents/host-agent.md`
- `qa/briefs/E-1535-stage-2.md`
- `docs/spec/v0.4.md`
- `qa/briefs/E-1533-stage-3.md`
- `docs/agents/tests/hub-test-setup-hosts.test.ts.md`
- `hub/test/durations.json`
- `hub/test/hosts-state.test.ts`
- `hub/test/pool-scale.test.ts`
- `hub/test/login-list.test.ts`
- `hub/test/login-wait.test.ts`
- `hub/test/fixtures/implement-skill-before.md`
- `hub/test/web-authority-unit.test.ts`
- `.agents/skills/implement/CHANGES/T-1777-login-add.md`
- `hub/test/config-reload-component.test.ts`
- `hub/test/session-pool-placement.test.ts`
- `docs/agents/tests/hub-test-login-card-signin.test.ts.md`
- `hub/test/login-host-pin.test.ts`
- `docs/agents/tests/hub-test-login-host-pin.test.ts.md`
- `hub/test/login-add-component.test.ts`
- `hub/test/login-add.test.ts`
- `hub/test/login-card-signin-trace.ts`
- `hub/test/host-pools-config.test.ts`
- `hub/test/login-terminal.test.ts`
- `hub/test/web-authority.test.ts`
- `hub/test/setup-hosts.test.ts`
- `hub/test/waiting-launch-restart.test.ts`
- `hub/test/host-prepare.test.ts`
- `hub/test/host-secret-admission.test.ts`
- `hub/test/waiting-launch.test.ts`
- `hub/test/login-keys.test.ts`
- `hub/test/config-set.test.ts`
- `hub/test/pool-idle-stop.test.ts`
- `hub/test/web-hosts-authority.test.ts`
- `hub/test/init-config.test.ts`
- `docs/agents/tests/hub-test-host-prepare.test.ts.md`
