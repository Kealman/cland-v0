---
id: T-1844
kind: task
title: A local merge batch checkout has no node_modules, so dependency-reading tests fail
state: open
status: review
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
updated: 2026-11-13T16:57:51.832Z
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
  - done: impl-1844 · 2026-11-13T16:56:31.856Z
- [x] C2. A local batch whose tree cannot get its dependencies holds as inconclusive naming the missing dependency, and its members stay queued (test).
  - done: impl-1844 · 2026-11-13T16:45:30.681Z

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
