# T-1599 implementation checkpoint

Checkpoint before first source review; worktree base: 28e2b2261. No queued verify yet.
Claim: impl-1599; item topic: topic-1366. No sub-agent delegation.

Coordinator cover-quiet5b52d41a (2026-11-03 10:13Z) forbids new local tests,
typecheck and suites until its release. All runs below predate that notice;
source changes since the notice have NOT been executed or typechecked.

Local macOS arm64, Node24.21.0, no browser or real SSH/provider/account:
- host-agent-files.test.ts unchanged:6 pass.
- host-agent.test.ts unchanged:18 pass.
- host-local-contract.test.ts unchanged wrapper:14 pass, local row defaults kept.
- host-launch-layout.test.ts:16 pass, local baselines unchanged; mapped remote
  env expectations explicitly migrated to additions only.
- host-ssh-contract.test.ts earlier complete run:17 pass before adapter/C3 rows.
- adapter/refusal subset:3 pass (older execute helper used run-host; current
  helper now uses native Host.spawn and is unexecuted).
- C3 registry subset:1 pass.
- host-prepared.test.ts earlier2 pass; native restart/deadline Git/connection
  ownership additions unexecuted.
- command environment original2 pass; added OpenCode/capability rows unexecuted.
- hub typecheck passed before late source changes; current typecheck pending.
- test:tiers passed with all3 new files registered (184free/508machine then).
- test:lint started before quiet, completed exit0 during quiet:122 report-only
  findings in59files,zero refusals. It has not checked the latest source changes.

Next after quiet release:
1. Run full workspace typecheck, test:lint, test:tiers and generate test docs index.
   Check Node/load/disk before heavy work; no local full suite.
2. Run touched new files one at a time, then modified host-launch-layout and
   host-records T2 fixture; inspect native cleanup and socket fallback removal.
3. Run named preservation consumers unedited: host-boundary, host-agent-boundary,
   local Host contract, agent files/process tests, host-registry,
   session-host-routing/placement; Codex/OpenCode local adapter launch tests.
   Also previous-hello-shape transport-ssh-contract stub plus transport-forwards.
4. Record exact required case names and actual outcomes in an artifact; no
   drafting-time counts or prior-tree runs counted as current validation.
5. Fetch/merge origin/dev once before FIRST review (rule11 thereafter), resolve
   conflicts without changing reviewed unrelated sources. Commit/push local origin.
6. Mark C1-C5 done; request reviewer in topic1366 with role-based routing, exact
   head/scope/criteria. QA affected/after-stage, no per-item brief supplied.
7. On source clear submit mode-free cland verify --report topic-1366 --to reviewer
   --to impl-1599, exact head, then idle for result. No verify before source clear.
   Landing held by Coordinator for integrated epic demos/cover freeze.

Decisions:04ee649d additive prepared ops;12a3c390 adapter explicit environments;
87a51dc5 single local-specific Host contract expectation row parameterization;
11a86342 OpenCode builder/refusal now, full remote spawn T1644;6e7c91b2 shared
socket aliases/fallback layout accepted with actual byte bounds and owned cleanup.
The refused T1593 comment was escalated to Coordinator rather than retried.

Read current source before continuing: prepared.ts and ssh-host.ts have late
ownership/cancellation changes. New native restart test uses observed direct CLI
agent launches with ownProcess cleanup; it is intentionally unexecuted so far.

Coordinator b3065283 (10:24Z) directs committing/pushing the current tree and
requesting source-only review during quiet, explicitly disclosing the unrun
current-tree checks. Run those checks after release; any resulting head change
requires delta review before verification. The pre-review fetch/merge precedes
this first review; do not merge dev again without Coordinator direction.

## Source-review repair checkpoint

First review rev-35-1599-source-1 at f0b6dbc2a was not clear (A-16248).
All nine findings have corresponding source repairs and targeted regressions.
Coordinator a5d3ae17 approved the exact Node-only credential-leaf boundary;
baaf0066 included the pre-existing ps/birth stop race in this item. Its
pre-fix native receipt returned false for a positively ended captured member;
the new shared predicate keeps missing/unknown observations refused. One
post-fix invocation had teardown ENOENT and is explicitly not counted passing;
beforeDirectories ordering plus independent native ownership repaired teardown.

Ten serial macOS host-agent.test.ts invocations after the predicate fix each
passed all18 cases, including the original line67; the file is unedited. Raw
outputs are retained by the session for artifact publication. These are repeated
executions, not180 distinct tests. Other targeted working-tree receipts include
SSH28, prepared7 before the race case, registry2, agent boundary2, env4, routing16,
local Host14, agent files6, Host boundary12, host records10 and layout16. The new
race case and T1 negative controls passed separately. Source-equivalent/current
commit provenance is stated in the review artifact rather than inferred here.

Current checks: workspace typecheck passed before final fixture/predicate edits;
hub typecheck/current targeted files and tier/index/lint refresh follow before
review2. No queued verification, Linux/Web/browser execution or complete tier
coverage has run. Keep all prior failures as prior failures. No dev merge after
first review; the original step5 above is historical and already completed.
After correction commit/push, request fresh source review; on clear, mode-free
cland verify at that exact head, then idle for its result and evidence review.

## A-16262 source review corrections

Every prepared Git inspection/mutation now runs behind a pre-effect durable
`git-running` checkpoint, including reserve, commit validation and abort/recovery
cleanup. A joined result restores its prior phase; incomplete native work stays
fenced through retries and restart. Commit refuses to overwrite that fence.
Recovery registers its owner before cleanup so a failed restart retains the
obligation. Three real-writer regressions cover commit inspection, abort removal
and restart removal, including no retry, mutation refusal and incomplete close.
The commit red receipt was `2 !== 1` (cleanup launched another writer after the
first incomplete inspection). A setup ENOENT in the restart regression was
corrected before its green run; it is not preservation evidence.

Durable command settlement bounds oversized serialized results before saving:
code is preserved, stdout/stderr retain 4096-character tails, and error identifies
the cap and original byte counts. The original monolithic command path is
unchanged. The dropped-reply regression first failed with `bounded command
terminal result from the agent: not within 5000 ms`; direct and lost-reply cases
then passed with exit code 17, diagnostic tails and a successful next command.
All runs use sealed disposable fixtures and independent native drainage.

## Verification 523013bf fixture correction

At reviewed head 83428a67a the configured Linux droplet run completed T0/T1 and
failed T2 on transport-status C6: `Error: host transport already owned`, from
claimTransport at fixture line 19. The unchanged file reproduced 0/1 locally on
macOS. Its status-only fake carrier conflicted with daemon startup's new
registered-host owner. Supplying the fixture's inert Host through the existing
projectHub hosts option prevents native SSH acquisition and preserves every
status and previous-reply assertion. This is a T-1599 consumer migration, not a
shared-defect classification or a production ownership bypass. A fresh source
review is required before another mode-free verification submission.

## Verification 4fd7d495 diagnostic compatibility

At 0b693d330, configured Linux T0–T2 passed and changed T3 failed before the
replacement assertion: Git returned `fatal: 'used' is already used by worktree`
while the failed-add test matched only `already checked out`. The test now accepts
both native branch-in-use phrasings. Its rejection requirement and all reserved
path removal, replacement protection, incomplete-close and restart assertions
remain unchanged; production is unchanged. A-16269 remains a failed receipt and
Web did not run. Fresh source review precedes another verification attempt.

## A-16270 / A-16272 aggregate contract budget

The Linux receipt also had an enforcing legacy identity rejection for the shared
contract wrapper: 7.33375717 seconds exceeded 5 seconds, although all 14 nested
rows passed. This was distinct from report-only T3/lint/ratchet diagnostics and
was missed in the initial diagnostic-only correction. The documented dated
allowance procedure keeps every native row and its shared fixture unchanged.
An exact-key 11.001-second allowance (1.5x the worst of two recorded passing
samples, rounded upward to milliseconds) names standing owner E-880 and dates
2026-11-03 to 2026-11-10. Passing samples are A-16263's qualified precommit macOS
wrapper 7.099404042 seconds and A-16269's Linux wrapper 7.33375717 seconds at
0b693d330. Both replayed through production checkDurations: each rejects against
the prior manifest, each passes the candidate allowance. Production manifest lint
confirmed owner and dates. No gate mode, baseline, row assertion or timeout changed.
The failed queued receipt remains failed; this replay is allowance evidence only.
