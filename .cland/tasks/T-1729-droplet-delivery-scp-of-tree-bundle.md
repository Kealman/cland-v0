---
id: T-1729
kind: task
title: "Droplet delivery: scp of tree.bundle fails with exit 1 and only the known-hosts warning on stderr (2 of 3 runs on snapshot cland-v0-35e1dc609f89)"
state: open
status: review
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1654
branch: t/T-1729-droplet-delivery-scp-of-tree-bundle
created: 2026-11-06T19:37:35.448Z
updated: 2026-11-19T10:44:58.282Z
---

## Summary

Since the executor snapshot cland-v0-35e1dc609f89 (image 253339653, prepared 2026-11-06 18:48Z after T-1709), two of the first three droplet deliveries failed at `delivery upload tree.bundle` with `machine copy failed or exceeded its time bound (exit 1)`. The only stderr is `Warning: Permanently added '<ip>' (ED25519) to the list of known hosts.` No test ran on those machines. Earlier copy failures in the hub log (2026-10-28, 11-02, 11-03) were ssh connection timeouts with exit 255; these are exit 1 with no scp error text.

## Occurrences

- Periodic dev T3 d22186e2 at e19c3496, droplet cland-v0-592657b4 c-8 sfo2, 19:17Z (A-17189): not run, infrastructure.
- Stage cover 255a9c8b shard-2 at e19c3496, droplet cland-v0-a5917b0e, 19:36Z (A-17192). Shard-1 on cland-v0-6fe8a260 delivered and ran 4098 tests green. The new droplets report kernel 6.8.0-147 (the old image was 6.8.0-142).

## What to build

1. Make the copy failure say what scp said. `failure('copy', …)` in `hub/src/executor/droplet/machine.ts` keeps stderr, so find why scp's own error is missing: is it the remote side, `-q`, or a killed process reported as exit 1? Report signal or timeout distinctly from a scp exit.
2. Reproduce against a droplet from the current snapshot (hub-owned; through `cland verify` runs or a test with the scripted machine) and name the cause: remote path or permissions under `/home/runner/runs/<run>`, first-boot I/O on a freshly transferred snapshot, sshd state after the hook's package installs, or the copy bound.
3. Fix the cause. A blind retry of the upload is acceptable only once the cause is shown to be transient, and it must be bounded and reported.

## Acceptance criteria

- [x] C1. A copy failure's message distinguishes a scp exit code with scp's stderr, a signal, and the time bound (test).
  - done: impl-1729 · 2026-11-19T10:40:15.179Z
- [x] C2. A failed delivery upload (Machine.put, including tree.bundle) persists every attempt's complete bounded stderr tail and exit or signal in the run's durable diagnostic, through every retry. A failed Machine.get throws a diagnostic with the same transport facts. Durable history of coverage-download attempts is out of scope (test).
  - done: impl-1729 · 2026-11-19T10:21:27.501Z
- [x] C3. The item records the receipt census: every terminal tree.bundle copy failure since 2026-11-06 with its run, date and literal cause. The last one, 830adf5b on 2026-11-14, was a network timeout ("Read from remote host … Operation timed out", "Broken pipe"), and none has recurred since (evidence).
  - done: impl-1729 · 2026-11-19T10:21:28.349Z
  - verified: rev-35 [reviewer] · run rev-35-1729-source-3 · 2026-11-19T10:44:58.282Z · commit 1ad2390ae3b69e1abab973450ec6c3b7b5d2ae3e

## Comments

### impl-1729 · 2026-11-19T09:44:38.903Z

Consumer census: Machine.put/get are used by droplet prepare/run and demo delivery via MachineTransport; MachineRequestError localClientUnavailable is read only in droplet/run status (unchanged). Tests: executor-contract (T1), executor-prepare-component and executor-droplet-component (T2), executor-prepare (T3, shellQuote only unaffected). delivery upload text also read by suite-remote-budget and remote-scripted; attempt header shape stays unchanged, extra stderr lines are additive. Searched MachineRequestError, machine copy failed, delivery upload, machine.ts imports across hub/src, hub/test, docs and nvim; no wire/schema or CLI help change. Native timeout receipt and copy stderr are additive; prior constructor and command diagnostics stay compatible.

### impl-1729 · 2026-11-19T09:50:30.237Z

C3 evidence A-21696: retained logs show four failed tree.bundle deliveries in three parent runs: 255a9c8b Nov 6 (one exit-1 shard), e58f3080 Nov 14 00:06Z (one exit-255 shard), 830adf5b Nov 14 08:49Z (two exit-1 shards). Literal causes are preserved in the artifact, including Operation timed out/Broken pipe/lost connection and the known-hosts-only case with unknown cause. No later retained failure. Nov 19 mtime-selected 49 success lines include two duplicate shard receipts; no new reproduction or provider calls.

### impl-1729 · 2026-11-19T09:51:15.607Z

Additional consumer search across hub, nvim, web, docs, .agents and qa found docs/executor-argv-audit.md, qa/briefs/E-1537-stage-2.md, hub/src/hub/{demos,suites}.ts, host/provision-host.ts and fake-machine.ts. These import or describe machineEnv/shellQuote or their own independent transport; no copy diagnostic parser or exact stderr snapshot. They are unaffected. suite-remote-budget, remote-scripted and executor component consumers retain existing attempt headers. Per Coordinator guard, stderr retention is complete below 64 KiB, otherwise a streaming tail with bytes seen/dropped.

### rev-36 · 2026-11-19T10:06:30.557Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1729-source-1
commit: 5c9ab57f906e9b4c397574c135fa162e15d55180
scope: full
findings: [{"severity":"medium","text":"Raw tail clipping occurs before full-token replacement at55. A known DIGITALOCEAN_TOKEN spanning the cut leaves an unredacted suffix in the returned/durable diagnostic. No earlier redactor/disposition exists (833e9923). Apply Coordinator5ef62166's safe stream-redaction or marked partial-line-drop boundary and retain a token-straddling regression with accurate byte bounds.","file":"hub/src/executor/droplet/machine.ts","line":20},{"severity":"medium","text":"After put selects its copy error, diagnostic appendFile rejection prevents aggregate construction and #step reports only the append error, losing original exit/signal/stderr (e73830ef). Preserve producing copy receipt as primary with bounded secondary persistence failure; add failure-path proof without claiming successful publication or changing retry policy (rule39).","file":"hub/src/executor/droplet/run.ts","line":92},{"severity":"medium","text":"The three new fake-only callbacks here and executor-contract.test.ts:9/:25 use raw TestContext/default direct FixtureStep. fakeOnlyFixture joins its body/guard cleanup but lacks a pre-acquisition normal/signal admission fence, root adoption and separately named setup bound; 8bed630c confirms no omitted owner. Own/fence just these new callbacks and thread the admitted step through setup/body/cleanup, retaining all guard and final assertions.","file":"hub/test/executor-prepare-component.test.ts","line":32},{"severity":"medium","text":"The three-parent/four-delivery census skips available terminal d22186e2 because its log has no matching delivery line. Independent result.json and833e9923 show Nov6 19:17:33.392Z/code1/infrastructure/tree.bundle known-hosts-only failure. Correct known total is four parent runs/five failed deliveries. Publish additive terminal-receipt census/count/dispositions, preserve original artifact and unknown causes (C3/rules17/39/40).","file":".cland/artifacts/A-21696-t-1729-delivery-census-and-diagnostic-evidence.md","line":9}]
finding_counts: {"high":0,"medium":4,"low":0}

Full Standards/Spec source NOT CLEAR at clean pushed5c9ab57f906e9b4c397574c135fa162e15d55180/tree2be9c8b7b11cf5c5d39cf894b2098fcc644b03c1, base8431152db. A-21702 consolidates4medium findings; no high/low. Implementer833e9923/8bed630c/e73830ef confirms no omitted redactor, lifetime owner or outcome-preservation boundary. Coordinator5ef62166 directs safe tail redaction/cut regression and corrected census. d22186e2 independently read terminal result:finished2026-11-06T19:17:33.392Z,code1,notRuninfrastructure,cause delivery upload tree.bundle: machine copy failed or exceeded its time bound (exit 1): Warning: Permanently added '138.68.252.68' (ED25519) to the list of known hosts. A-21702 abbreviates the address in that quoted excerpt; full value is here and retained833e9923. C2 revised byCoordinatorb956bd42/currenttask readback: durable every delivery-put attempt; get thrown diagnostic only; coverage-download history excluded, no finding for that disposition. Raw buffer bound/close/owned-timeout and normal upload persistence paths otherwise reviewed, SSH/retry policy unchanged. A-21696/21698 local narrative receipts retain735selectedT1/56files, fulltypecheck/lint0 and T2batch61/62red; exact remote-scripted no frame matched within15000ms/launching failure staysred. Base5/5+candidate5/5 attribution andCoordinator7c340d78/T-2001 remain separate, no superseding redbatch or broad/native/browser/configured proof. Missing detailed raw/command/file-list/tree/native provenance remains unknown, not inferred. C1/C2/C3 failed, nothingverified. Hold released for consolidated bounded corrections/evidence supplement; no blanket helper migration/provider run/blind retry. Fresh immutable-head source review before configured verification. No Reviewer runtime, scanner, generator or source edits.

Criteria: C1 failed (Three new transport proof callbacks lack the admitted lifetime/signal fence and separate setup bound needed to support their assertions.), C2 failed (A cut-crossing secret can leak from copy diagnostics, and ancillary diagnostic-write rejection replaces the selected native copy error.), C3 failed (Census omits available terminal d22186e2; known four-parent/five-delivery receipt set is not recorded correctly in A-21696.).

### impl-1729 · 2026-11-19T10:13:19.201Z

Consolidated source-1 corrections: M1 safe line-aligned bounded stderr tail, with red then green synthetic token crossing chunk and cut boundaries; M2 primary copy error retained as Error.cause when diagnostic append fails, with <=1024-character secondary failure, no false durable claim/retry; M3 narrow copyFixtureCase normal/signal admission and guard/root/import setup bounds for three new callers; M4 additive A-21703 replaces incomplete count with 15 known parent runs/16 failed deliveries, including 11 Coordinator-classified Nov12/13 outage casualties. Examined 309 complete results; 615 oversized results explicitly UNEXAMINED. No examined failure later than 2026-11-14T08:49:54.029Z. A-21696/A-21698 and original 61/62 red batch remain retained; T-2001 base/candidate5+5 disposition is separate. No provider run and no merge from dev after first source review.

### rev-36 · 2026-11-19T10:28:38.655Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1729-source-2
commit: d5e7d5151d07e08027eee1dfe5f710af03d8d5e7
scope: full
findings: [{"severity":"medium","text":"If the 5s root setup observer rejects before mkdtemp completes, catch joins but discards its successful value at22 and throws at23. fakeOnlyFixture.ts:59 never assigns root, so close skips removal; outer fixtureWork has no root adoption. Implementer196c837c confirms no omitted owner. Capture/adopt the late acquisition before bounded observation can discard it, retain whole-caller/signal fences, original-work join and final guard/assertions (rules9/12).","file":"hub/test/executor-copy-fixture.ts","line":19}]
finding_counts: {"high":0,"medium":1,"low":0}

Full Standards/Spec source NOT CLEAR at d5e7d5151d07e08027eee1dfe5f710af03d8d5e7/tree cdeed9ec5895e3a12d63c22069e88b0dd3f0fba1, branch tip verified. A-21712 consolidates one medium residual late-root ownership finding; no high/low. Source-1 cut-crossing redaction and copy-primary/secondary-append preservation are corrected; normal/signal fixture fences, named setup bounds and fake-child finally join were reviewed, with this acquisition-capture exception. A-21703 corrects terminal census to15known parents/16copy failures,309examined/615oversizedUNEXAMINED; Coordinator46a3c9b3 explicitly accepts the bounded scope/no parse-all requirement. No examined failure after Nov14 08:49:54.029Z, unknown receipts remain unknown. RevisedC2 excludes durablegethistory. A-21710 local macOSNode24.21 precommit735selectedT1/56files and67focused outcomes precede final fake-child cleanup adjustment; later30prepare cases plus fulltypecheck/lint0 retain distinct scope,129lint notices report-only. No exact-head configured/T3/T4/Web proof claimed, missing provenance stays unknown, original61/62red retained separately from T-2001 base/candidate attribution. C1 failed; C2/C3 done but unverified, nothing verified. Hold released for bounded ownership correction; fresh immutable-head source review required before configured verification. No Reviewer edits, tests, scanners, generators, probes or provider calls.

Criteria: C1 failed (The new transport proof fixture can leak a successfully acquired scratch directory when its separate setup observer times out before mkdtemp resolves.).

### impl-1729 · 2026-11-19T10:31:13.275Z

Source2 residual correction is a producer-side root capture in fake-only-fixture.ts, with unchanged public arguments/return and no caller migration. copyFixtureCase optional clock enables deterministic setup-timeout proof. Consumer search/graph includes fakeOnlyFixture, copyFixtureCase, old and new callers across tiers; recomputed reachable T1 set remains 53 selected + 3 unknown graphs, all 56 scheduled. New lease-index regression observes created directory after expiry then requires cleanup ENOENT before test fallback cleanup; red then green. Normal root ownership and every caller continue through existing helper close/positive guard.

### impl-1729 · 2026-11-19T10:31:37.122Z

Direct helper consumers enumerated: host-create-admission.test.ts, recording-host.test.ts, executor-launch-boundary.test.ts, executor-contract.test.ts, executor-lease-index.test.ts, executor-copy-fixture.ts, executor-prepare-component.test.ts; suite-t3-interactions.test.ts references the helper as graph source. No production/wire/CLI consumers. Existing callers retain signature and normal success/error semantics; only late root cleanup ownership moves inside producer. All T1 direct/indirect consumers are in recalculated selected56; recording-host remains T2 and will run targeted. No T3/T4 test changed.

### rev-35 · 2026-11-19T10:44:58.282Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1729-source-3
commit: 1ad2390ae3b69e1abab973450ec6c3b7b5d2ae3e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 CLEAR at clean1ad2390ae3b69e1abab973450ec6c3b7b5d2ae3e/treebe05f826, parent reviewed d5e7d5151/base8431152d, no dev merge. A-21723 closes A-21712's sole residual: fakeOnlyFixture captures root in original mkdtemp producer before bounded observer can discard late success; acquiredRoot preserves normal typed path checks. Existing whole-caller normal/signal fence, named setup bounds, original join and positive guard retained. Exact late-root control observes created directory, deadline/no-body, then final ENOENT after original cleanup, before fallback. Shared signature/callers unchanged; directT2 callers covered in selected83batch. Production transport byte-identical to source2; prior redaction/primary-copy-secondary-append corrections and Coordinatorb956bd42 put-only durable-history/get-thrown-facts scope retained. C3verified from A21703 accepted bounded309examined/615oversizedUNEXAMINED census:15known parents16failures, no examined post-Nov14 08:49:54.029Z; Coordinator46a3c9b3 accepts scope/no parse-all. No global absence claim. A21717 local precommit same-source736T1/56files+83T2/6files/fullcompiler+lint0 remain selected,129advisoriesreport-only; root/TS2345red and original61/62red/T2001 narrower attribution retained. No configured/T3/T4/Web/provider proof; missing native/raw/invocation facts unknown. Standards/Spec source clear,findings[]. C1/C2doneunverified pending exact same-head configured facts; C3current verified within accepted scope. Hold released for Coordinator verification window; no extra standalone/native/provenance run requested. Reviewer static inspection only.

Criteria: C3 verified.
