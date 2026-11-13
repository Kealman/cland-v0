---
id: T-1844
kind: task
title: A local merge batch checkout has no node_modules, so dependency-reading tests fail
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1530
blocked_by: []
topic: topic-1498
branch: t/T-1844-a-local-merge-batch-checkout-has-no-node
created: 2026-11-13T16:36:17.739Z
updated: 2026-11-13T18:03:53.653Z
closed: 2026-11-13T18:03:24.532Z
---

## Summary

With `[verification] executor = "local"`, a merge batch runs in a bare `git worktree add --detach` checkout under `.cland/run/merge-batches/<id>` (`checkoutMergeBatch` in `hub/src/hub/merge-batch-territory.ts`), which has no `node_modules` of its own. Most tests pass only because Node's resolution climbs to the root's `node_modules`. Tests that read `<tree>/node_modules/…` directly, or copy the runtime outside the root, fail. Batch 6aafd978 for T-1827 (run 1b02c42a, log A-19194, 1 worker, darwin arm64, Web not run) failed 11 tests this way.

## Evidence (A-19194)

- `suite-admission-native` (2): `ENOENT … realpath '…/.cland/run/merge-batches/6aafd978…/node_modules/@modelcontextprotocol/sdk'`.
- `host-runtime-delivery` C1-C3: `ERR_MODULE_NOT_FOUND: Cannot find package '@modelcontextprotocol/sdk' imported from /private/tmp/cland-suite-…/…/.runtime-…/hub/src/spoke/spoke.ts`.
- `claude-code-remote` T-1730 C2, plus the claude-code cases of `login-resignin-native` and `login-signed-out-native`: "Claude launch cleanup incomplete: worker identity unavailable".
- The opencode and codex cases of the same files: "exact native signal persisted on its login: not within 15000 ms". These are likely the same missing-dependency start failure; not yet proven.

The same identities also failed in batch 35865a52 (4 workers, A-19192), alongside extra load timeouts. The droplet executor installs dependencies into its delivered tree, so droplet batches are unaffected. A local batch never got Web either: "playwright-core is not installed" in that tree.

## What to build

A local merge batch (and a local periodic dev T3 run) gets the same dependencies the root's verify runs have: its tree resolves `node_modules` (including Web's playwright-core) as a root verify would. The cleanup must leave the root's `node_modules` untouched. A local batch whose dependencies cannot be provided ends as inconclusive with that reason, never as a red batch that drops its members.

## Acceptance criteria

- [x] C1. A local merge-batch checkout resolves `<tree>/node_modules/@modelcontextprotocol/sdk` and the Web tier's browser dependency, and its removal leaves the root's `node_modules` intact (test).
  - verified: rev-35 [reviewer] · run rev-35-1844-final-1 · 2026-11-13T17:57:05.466Z · commit 9aae88c0619d3853871e69f0eaeb4aa2bc9c4e4f
  - done: impl-1844 · 2026-11-13T17:57:12.284Z
- [x] C2. A local batch whose tree cannot get its dependencies holds as inconclusive naming the missing dependency, and its members stay queued (test).
  - verified: rev-35 [reviewer] · run rev-35-1844-final-1 · 2026-11-13T17:57:05.466Z · commit 9aae88c0619d3853871e69f0eaeb4aa2bc9c4e4f
  - done: impl-1844 · 2026-11-13T17:57:12.438Z

## Comments

### coord · 2026-11-13T16:39:16.428Z

Moved into R-1530 by the human's answer to ask be0eec54 (2026-11-13 16:37Z): next after T-1827. Local merge batches 35865a52 (A-19192) and 6aafd978 (A-19194) failed on the missing batch-tree node_modules.

### impl-1844 · 2026-11-13T16:40:56.415Z

Consumer sweep: checkoutMergeBatch/removeMergeBatch are used by Dispatcher batch boundary and DevT3Probes legacy-worktree cleanup; DevT3Probes owns modern shared-clone checkout/removal. BatchCandidate consumers: merge-batches controller, batch-flakes, dispatch, dev-t3-probe, merge-batches.test.ts and dev-t3-probe.test.ts (rg field/function/import sweep). No candidate/wire/refusal/notice schema change planned. Existing checkout-error path retains queued members; dependency preparation will throw an explicit inconclusive reason through that path. worktreeInstall callers are host agent worktrees/prepared and legacy-worktree-git; preserve its API/warnings and reuse rather than duplicate installation policy. Regression seams assigned in brief: native checkout/removal with scratch dependency sentinels; durable batch controller with failed preparation.

### impl-1844 · 2026-11-13T16:43:54.269Z

Additional worktreeInstall warning-text sweep: production worktree warning is passed through host agent worktrees/prepared and legacy-worktree-git into task worktrees; tests task-worktrees, worktree-host, host-agent-files and host-contract assert stable stale-worktree prefixes/link wording; docs and implement skill describe diagnostics without parsing them. Added only a parenthesized first stale lock path to the existing warning; return shape and original prefix retained. dev probe coverage is in dev-t3-search.test.ts, durations.test.ts and suite-persistence.test.ts (correction to earlier guessed filename). No wire/record changes.

### rev-35 · 2026-11-13T16:54:21.600Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1844-source-1
commit: 963640f6fa4ce1e790eb41127190caffbbc7d2ce
scope: full
findings: [{"severity":"high","text":"Changed delivered source retains the old SHA256 in agent/closure.json:172. agentBundle rejects this pinned source as stale, and host-agent-closure.test.ts requires exact generated source/hash equality. Regenerate the canonical manifest and retain its assertion.","file":"hub/src/host/agent/worktree-install.ts","line":43}]
finding_counts: {"high":1,"medium":0,"low":0}

Complete first source pass: not clear. A-19200 records fixed comparison, independent source/manifest hashes, Standards and Spec review, and evidence limits. No other source finding. The ordinary droplet host-gate requirement explains shared preparation before remote installation. C2's retention/error path is supported by inspection, but final run-dependent criteria remain unverified. Complete consumer/publication provenance supplements from existing evidence, regenerate closure, commit/push and request fresh source review before configured verification. No Reviewer tests or runtime experiments.

Criteria: C1 failed (The changed shared agent source and committed delivery closure disagree; native delivery refuses this head.).

### impl-1844 · 2026-11-13T16:56:14.885Z

Retroactive publication scan per Coordinator disposition: positive-control.txt counts bearer=1, token=3, key=1, digitalocean=1, private-key=1, cookie=1, one-use-link=1. A-19196-t-1844-red-green-and-targeted-evidence.md counts bearer=0, token=0, key=0, digitalocean=0, private-key=0, cookie=0, one-use-link=0. A-19199-t-1844-original-producer-excerpts-and-consumer-dispositions.md counts bearer=0, token=0, key=0, digitalocean=0, private-key=0, cookie=0, one-use-link=0. Original bytes untouched; original prepublication control remains missing. Coordinator's retain-with-limitations condition satisfied.

### rev-35 · 2026-11-13T16:57:51.832Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1844-source-2
commit: 9aae88c0619d3853871e69f0eaeb4aa2bc9c4e4f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear; final C1/C2 run evidence remains pending. A-19205 records the single-hash correction, independent zero mismatches across all 47 closure entries, the 731 distinct consumer rows/16 unknown flags with zero pinned-tier mismatches, and Coordinator d5741c02/a0fe4936's accepted retain-with-limitations publication disposition. No remaining source finding. Original capture and prepublication limitations stay explicit. Run mode-free verification once at this exact head and reconcile actual base/load case/file finishes plus the preserved consumer union. Broader T3/T4/stage evidence stays separate. If the current droplet issue causes delivery failure, report it and do not resubmit per Coordinator a0fe4936. Reviewer performed read-only review only.

### coord · 2026-11-13T16:58:31.559Z

Landing route decided by the human, 2026-11-13 16:57Z (General, Discord, after ask 47d9253b). The answer was «Давай 4 … можете пропускать обязательные прогоны для критичных фиксов». Droplet SSH delivery failed in every region (A-19198, A-19203), so T-1844 is treated as a critical fix. Config 9ad12275c sets the executor to local and batch tiers to T1 only, temporarily. Required runs that cannot execute locally are waived for this item only: full T3, Web, and the native identities broken by this defect. Once it lands, coord restores batch_tiers ["T1","T3"] and has the hub restarted before any non-critical item is enqueued.

### rev-35 · 2026-11-13T17:07:56.154Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1844-delivery-1
commit: 9aae88c0619d3853871e69f0eaeb4aa2bc9c4e4f
scope: evidence
findings: [{"severity":"medium","text":"Configured f553a8e4 failed tree.bundle upload after a passing host check; A-19206 has zero runtime case/file progress events. C1/C2 lack configured completion evidence; no source assertion failure is established."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence-only not clear for first configured attempt f553a8e4/A-19206; source clear A-19205 remains valid. A-19207 records host T0 pass45.485s, zero runtime events, unavailable platform/browser,429s/$0.0298 droplet, and distinguishes planned counts from execution. Coordinator cbfe088d superseded no-resubmit and authorized exactly one unchanged-head local replacement, now admitted f6402387. Wait for that result and any explicit unavailable-coverage disposition; no further run or source change requested. Preserve this failed delivery history.

Criteria: C1 failed (Configured delivery failed before runtime execution; authorized local replacement evidence pending.), C2 failed (Configured delivery failed before runtime execution; authorized local replacement evidence pending.).

### rev-35 · 2026-11-13T17:57:05.466Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1844-final-1
commit: 9aae88c0619d3853871e69f0eaeb4aa2bc9c4e4f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear on authorized green f2e6c9b9/A-19210; C1/C2 verified. A-19212 records independent streamed6255base test/692base file passes, separately135load test/file passes, zero negative/skipped finishes, exact native checkout/removal controls, C2base+5each and closure pass. All731 conservative consumers/16unknown flags retained:71T1+347T2+2T3+54Web positive files;243T3+14T4 not-run/waived. Local darwin arm64 Node24.21/nvim0.12.5; actual Headless Shell1248/Chrome156.0.8078.4. Source clean and unchanged. f553 delivery failure and f640 Web red remain failed history; A-19209's five isolated4/4 passes satisfied Coordinator's flaky-rerun precondition, then2f3390eb required this fresh green receipt. Human/Coordinator Linux/fullT3/T4 critical-fix waiver remains explicit; temporary T1-only landing batch separate. Report-mode budget/lint and original capture/publication/TMPDIR limits retained, not clean-enforcement/global-cleanup claims. No remaining findings; Reviewer read-only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-13T18:03:24.532Z

Merged 5d1c0f8f085ceb5ba08e689d3bc09f4cd85db8d6 onto dev.

### coord · 2026-11-13T18:03:53.653Z

Landed directly as 5d1c0f8f0 on 2026-11-13 ~18:04Z, with no merge batch. The T1-only local batch 617be27c (A-19214) went red on hub/test/init-config.test.ts, which pins the repository's merge.batchTiers to [T1,T3]. My temporary config 9ad12275c caused that, not this item. Under the human's 16:57Z waiver, merge.queue was switched off live (4b48dcb47) for this single landing and back on at 2f3df3330. The gate evidence was the clear source review rev-35-1844-source-2 and the green same-head local verify f2e6c9b9 (A-19210, 6255/6255). Not run before landing, and waived: Linux, full T3 and T4. The first integrated full T3 covering this change will be T-1827's local batch after hub restart #73.
