---
id: T-1716
kind: task
title: Pool images and `cland host prepare` on the fake provider
state: closed
status: done
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1711
  - T-1709
topic: topic-1411
branch: t/T-1716-pool-images-and-cland-host-prepare-on
created: 2026-11-06T10:48:40.049Z
updated: 2026-11-06T21:54:45.673Z
closed: 2026-11-06T21:54:45.673Z
---

## Summary

A pool image is keyed from the Node version, the lockfile digest, the pool's harness versions and the provisioning hook's content. `cland host prepare [<pool>]` asks the pool's provider to build it when the key changed, and answers `current` or `prepared` with the parts that changed. On the fake provider the image is a record with its key and a configurable build time. The pool's provider, size, region and transport are read from `[hosts.<pool>]`, and the harness pins from `[hosts]`.

Hot files: `hub/src/host/provider/pool-image.ts` (new), `hub/src/host/provider/fake.ts`, `hub/src/host/transport-config.ts` (minimal pool reading), `hub/src/cli/host.ts`, `hub/src/cli/help.ts` (`HOST_USAGE`), `hub/src/hub/dispatch.ts` (`host.prepare`), `hub/src/hub/web-authority.ts`, `hub/test/host-prepare.test.ts` (new)

## What to build

- the pool image key and its per-pool record under `.cland/run/hosts/`;
- a `host.prepare` frame, refused off the local human CLI or Neovim as `host.revoke` is, and the CLI over it;
- prepare on the fake provider;
- the minimal pool reading. E-1534 owns the rest of the hosts table: slots, `min_hosts`, `max_hosts`, `idle_stop`, `spread`, hot reload and `cland config set`.

Decisions (coord, open questions 1, 7 and 9): E-1533 reads only `[hosts.<pool>]` provider, size, region and transport plus the `[hosts] harnesses` pins, validated and read per command. The key hashes the hook's content, which embeds the Neovim tag and digest. cland's own code is delivered at ready through the version handoff, not baked into the pool image; the boot-time target is measured in E-1539.

## Acceptance criteria

- [x] C1. In a scratch project with a fake pool, `cland host prepare` prints `prepared` and then `current` (test).
  - done: impl-1716 · 2026-11-06T20:44:19.896Z
  - verified: rev-37 [reviewer] · run rev-37-1716-evidence-1 · 2026-11-06T21:16:40.594Z · commit 6c0e467d3a742afcaffd5e55705bab675a1a8c39
- [x] C2. Changing one harness pin, the lockfile or the provisioning hook makes the next `cland host prepare` print `prepared` and name that key part (test).
  - done: impl-1716 · 2026-11-06T20:44:27.775Z
  - verified: rev-37 [reviewer] · run rev-37-1716-evidence-1 · 2026-11-06T21:16:40.594Z · commit 6c0e467d3a742afcaffd5e55705bab675a1a8c39
- [x] C3. `cland host prepare` with no pool prepares every configured pool, and an unknown pool is refused naming the configured ones (test).
  - done: impl-1716 · 2026-11-06T20:44:34.233Z
  - verified: rev-37 [reviewer] · run rev-37-1716-evidence-1 · 2026-11-06T21:16:40.594Z · commit 6c0e467d3a742afcaffd5e55705bab675a1a8c39
- [x] C4. `host.prepare` from a session or a remote is refused as `host.revoke` is, and `cland host --help` lists `prepare` (test).
  - done: impl-1716 · 2026-11-06T20:44:49.241Z
  - verified: rev-37 [reviewer] · run rev-37-1716-evidence-1 · 2026-11-06T21:16:40.594Z · commit 6c0e467d3a742afcaffd5e55705bab675a1a8c39

## Comments

### impl-1716 · 2026-11-06T20:36:55.277Z

Rule 20 pre-change sweep: searched host.revoke, HOST_USAGE, provider-image, validateHostTransports, HostProvider/PrepareResult and prepare callers across hub/shared/web/nvim/docs/qa/.agents. Consumers: protocol.ts and shared/wire/index.ts frame unions; dispatch and web-authority tables; cli/host, help, usage; init/config transport validation; FakeHostProvider and provider contract suite (retain no-argument prepare); registry provider interface. Tests: host-provider-fake/host-provider-contract, host-secret-admission, remote-discovery-host, host-revoke/native, web-authority, cli-identity, cli-help and frozen CLI usage fixtures. Docs: hub README, adapters-and-sessions, host-agent, SSH/provider docs and E-1532/E-1533 QA briefs. New additive frame only; existing revoke and reply shapes unchanged, existing provider no-arg prepare retained. No prior pool record reader exists. Existing executor prepare-key legacy-shape regression retained. New CLI on an old hub must propagate its unknown-frame refusal.

### impl-1716 · 2026-11-06T20:43:48.701Z

Coordinator pin clarification applied: hosts.harnesses is a Partial<Record<'claude-code'|'codex'|'opencode', string>>, validated to exact x.y.z, ready for renderer input. New validation regression first failed 'Missing expected exception', then all 7 host-prepare cases passed (macOS, local Node v24.21.0; no browser/provider network). Initial CLI red was 'usage: cland host <serve | attach session | revoke id | git-proxy socket>'. Legacy executor prepare-key hash tests remain green. Heavy cli-identity queued under preservation policy; full verify not yet requested pending source review.

### rev-37 · 2026-11-06T20:50:16.015Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1716-source-1
commit: 6c0e467d3a742afcaffd5e55705bab675a1a8c39
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1716 full source review

Head6c0e467d3a742afcaffd5e55705bab675a1a8c39; branch t/T-1716-pool-images-and-cland-host-prepare-on.
Run rev-37-1716-source-1; scope full; result clear; findings[].
Reviewed task body/C1-C4/consumer inventory, exact commit against its origin/dev merge-base, production call paths, tests, help and docs/skill guidance. Standards and Spec reviewed in-session; role prohibits delegation. Reviewer read only, no tests/typecheck/browser, edits or merge.

## Spec

No findings.
- New host.prepare request and CLI support one named pool or sorted all-pool enumeration. Unknown pool refusal lists configured choices. Replies distinguish prepared/current and stale parts.
- Minimal config reads provider/size/region/ssh transport per command. Harness pins are sorted Partial<Record<claude-code|codex|opencode,string>>, validated exact x.y.z as Coordinator5ef39214 directed for T-1714/T-1719 renderer ownership. Scheduling settings and config-set remain outside this scope.
- Pool key captures running Node, optional lock byte hash, executor recipe hash, configured provision path/content hash and harness pins. base remains deliberately constant because project code is delivered at ready. Executor hash/recipe/stale-name logic is reused; recipeDigest extraction preserves executor prepareKey bytes/fields.
- Fake provider keyed prepare accepts pool/key, stores durable image key/digest/build receipt before returning and reports current only for the matching record. Optional configurable build delay can use an injected wait; default remains zero. Existing no-argument prepare path remains intact for all legacy consumers.
- Project per-pool receipt is persisted only after positive provider completion. Same-project overlapping all/single requests serialize; errors release the queue for later requests. Dispatcher tracks admitted preparation promises and close fences new admissions before joining the captured work, prior to storage close.
- Dispatcher shares host.revoke's local human CLI/Neovim admission: host-secret/as/session claims and wrong edges refuse; user authority is checked. Web refusal is explicit. Existing revoke response/logic is retained; additive frame validation and shared wire union align.
- CLI help/usage include prepare; unknown-frame failures from older hubs continue through the existing askHubFrame error path rather than silent fallback.

Tests inspected:
C1 real CLI over projectHub prepares then current; C2 separate harness/lock/hook-byte mutations retain exact changed-part output assertions; C3 all configured pools and unknown choice list; C4 host help, authenticated session/host-secret denial and signed-in web refusal. Additional held fake-build control waits for build entry, proves record absent while held, releases/joins producer and then checks persisted key/buildTime/built receipt. Exact pin validation includes malformed/unknown controls.
CLI subprocesses are the actual CLI subject and use the documented cland helper, allowed in T2. No new native host/provider/cloud lifecycle or GUI test introduced.

## Standards

No findings.
New consumer inventory covers protocol/shared-wire, dispatch/web authority, CLI/help/frozen usage, config transport, provider signature/contracts, legacy keys, light/heavy consumers, docs/QA/skills. Provider argument is optional so existing no-argument implementations/callers remain compatible. No new external dependency.
New pool reads are bounded named files; no retained-history traversal/startup scan. Effect writes use shared durableJson, and fake delay/write completion precedes success. Tests use disposable project/account environment builders and registered root/producer cleanup.
Per-file T2 guide, manifest/index, hub README, provider/agent docs and implement skill+CHANGES are updated. Docs explicitly state fake-only registration, disposable CLAND_FAKE_HOST_ROOT fence, optional pins/default-renderer ownership and after-stage QA scope. Existing role grants do not change; prepare remains human-local.

Evidence limits:
A-17208 is working-tree development evidence, not exact-head configured proof: local macOS arm64 Node24.21.0, seven new cases plus listed light/authority regressions; some companions predate final pin/doc changes. Lead reports final current-head typecheck and test:lint exit0, zero refusals with baseline report-only diagnostics, tiers finishing. Heavy cli-identity remains pending its Coordinator preservation slot. No Linux/Docker/full configured/browser/provider API receipt yet. No new-case sample>=3s reported; targeted runs are not duration-gate passes.

All C1-C4 are test criteria and remain unverified by this source-only pass. Finish required preservation/T0 checks, then configured mode-free verification must pin6c0e467d3a742afcaffd5e55705bab675a1a8c39. Any source/head change requires fresh review. Affected after-stage QA remains separate.
Standards0 findings; Spec0 findings.

A-17215: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17215-t-1716-source-review-at-6c0e467d.md

### rev-37 · 2026-11-06T21:16:40.594Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1716-evidence-1
commit: 6c0e467d3a742afcaffd5e55705bab675a1a8c39
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-1716 final evidence review

Head6c0e467d3a742afcaffd5e55705bab675a1a8c39.
Run rev-37-1716-evidence-1; scope evidence; clear; findings[]; verifiedC1-C4.
Source clear rev-37-1716-source-1/A-17215 remains current. Branch ref unchanged; read-only canonical-tree reconstruction8b137aae29248fcfcbc405069111a0f72454bacc matches provenance.

Configured run58fdee71-9090-435c-a91f-53f746decf8f / A-17233 exited0: aggregate5275pass, zero fail/cancel/skip/todo. Linuxx64 6.8.0-147-generic, droplet c-8lon1, Node24.21.0, Neovim0.12.5, workers2, uncached. Isolated Chrome Headless Shell1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; reported Google Chrome for Testing156.0.8078.4.
T0/T1/fallback-allT2/Web completed. T3 deferred to merge batch, T4 unexecuted. Budget/lint/ratchet notices remain report-only; observed/projected tier timings are not whole-run wall time. Provenance skips[] and skipReasonCheck report/missing0 checked separately.

Independent streaming completion scan retained all outcomes before unique-name counting:
host-prepare7unique/42passrecords (7base+35load); host-secret-admission17/17base; web-authority47unique/52passrecords (47base+5load); host-provider-fake34/34base; prepare-key10/10base; CLI help7, command-help18, usage1 and usage-compatibility1 all pass. No nonpass outcomes in those files.

C1 verified: 'pool prepare CLI publishes an image and then reports current' passes base plus five load repetitions, retaining exited CLI code/stdout/hub reply and final prepared→current assertions.
C2 verified: separate generated 'pool prepare invalidates harnesses|lock|provision and names the changed part' each pass base+five. These mutate actual configured pin/lock/hook bytes between completed commands and retain exact stale-part output checks.
C3 verified: 'pool prepare selects all configured pools and unknown pool names the choices' passes base+five, checking both configured pools and the named configured-choice refusal.
C4 verified: that same CLI case checks host --help; CLI help/frozen usage controls pass. Existing host-secret-admission 'C5 human revoke closes host peers and refuses subsequent hellos' passes with added session/host-secret prepare refusals; 'signed-in web refuses pool preparation' passes base+five and preserves cli-neovim-only refusal. Source-reviewed dispatcher shares the existing human-local revoke admission checks; no agent grant added.

Additional current-head controls pass: held fake build receipt persists only after completion; exact renderer-id/x.y.z pin validation; legacy no-argument provider prepare contract and executor prepare-key regressions.

Directed native preservation:
A-17223 summary and A-17235 explicitly labelled original-tool transcription retain cli-identity6/6, native exit0/tool exit_code0, zero fail/cancel/skip/todo. Printed exact head and Node24.21.0 precede launch. Local macOS, no browser; signal not separately recorded. Original tool session41211/chunks named in the artifact; no provenance-only rerun.
All six generated names and native terminal summaries inspected, including 'human-only shell commands enforce the held role while reads remain allowed', shell identity/ownership, Coordinator/session mutation boundaries, no unauthenticated hub-stop signalling and no borrowed --as identity.
Reported duration_ms19426.810167 is the targeted file's own native summary, not configured-suite wall time. This supplement is not added to5275 and not claimed as Linux/fullT3 execution. No source change across it.
A-17208 earlier working-tree evidence remains qualified, not relabelled committed-head execution; A-17212 T0 is supplementary to configured T0.

All C1-C4 verified at the exact current head; no findings. Affected after-stage QA remains separate. Reviewer performed source/log reads only; no tests/typecheck/browser, edits, merge or provider operation.

A-17238: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-17238-t-1716-final-exact-head-evidence-at-6c0e467d.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-06T21:54:45.673Z

Merged 4cb561cb72645aa5028cd2d54173c4efcc2c3dee onto dev.
