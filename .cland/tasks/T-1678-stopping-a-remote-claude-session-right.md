---
id: T-1678
kind: task
title: Stopping a remote Claude session right after a turn still refuses with 'process identity cannot be verified'
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1674
topic: topic-1383
branch: t/T-1678-stopping-a-remote-claude-session-right
created: 2026-11-04T15:25:21.631Z
updated: 2026-11-04T19:08:34.956Z
---

## Summary

After T-1674, two stage-5 implementers still see an explicit stop of a remote Claude session refused with `could not stop "<name>": its process identity cannot be verified; it is still watched` when the stop follows a completed turn closely:
- impl-1612 (T-1612 survival scenario, under the exclusive lock): stop immediately after the pong receipt.
- impl-1666 (T-1666 pre-revoke settlement, under the lock): the stop of a released generation, intermittently.

A real user stopping a session just after a turn would hit the same refusal and need a manual re-stop. That is the product problem T-1607's stop design meant to avoid.

## What to build

Capture the actual process records (PID, birth, parent, command) at both captures in a failing stop right after a turn, and classify the second change: settled pinned exit, same-set republish, legitimately new hook writer, or unknown identity. Fix the product so that a stop right after a turn completes without a manual re-stop. The one-recapture bound for genuinely new unpinned descendants and the second-churn means incomplete rule stay unchanged unless coord decides otherwise.

## Acceptance criteria

- [x] C1. The failing captures are recorded and the extra process classified (evidence).
  - done: impl-1678 · 2026-11-04T15:41:18.831Z
  - verified: rev-35 [reviewer] · run rev-35-1678-final-1 · 2026-11-04T19:08:34.772Z · commit ecccc6cd354cfca42192bbccc9c5c2aba6e932fe
- [x] C2. An explicit stop issued immediately after a completed remote Claude turn, and one issued mid-turn while the root spawns hooks, both complete without a manual re-stop, 20/20 under load in an isolated Linux container (evidence).
  - done: impl-1678 · 2026-11-04T18:39:10.404Z
  - verified: rev-35 [reviewer] · run rev-35-1678-final-1 · 2026-11-04T19:08:34.772Z · commit ecccc6cd354cfca42192bbccc9c5c2aba6e932fe
- [x] C3. The existing claude-stop, claude-capture-concurrency and claude-code-remote controls pass unedited, except (a) controls asserting the superseded single-recapture budget or second-descendant-churn refusal, migrated to the convergence rule, (b) the three capture-concurrency controls whose fault seam now calls owner.capture explicitly, and (c) the unowned-orphan control, whose orphan is kept alive independently of SessionEnd and whose root-alive assertion becomes root TERM allowed with no signal to the orphan; each is listed in the review request (coord decisions c5caf575, e756201c and this one) (test).
  - done: impl-1678 · 2026-11-04T18:24:54.672Z
  - verified: rev-35 [reviewer] · run rev-35-1678-final-1 · 2026-11-04T19:08:34.772Z · commit ecccc6cd354cfca42192bbccc9c5c2aba6e932fe

## Comments

### impl-1678 · 2026-11-04T15:28:37.854Z

Diagnosis checkpoint: read T-1674 comments/A-16563/A-16564 and T-1607 settled-exit, per-admission budget, hook join and terminal settlement decisions. A-16592 and A-16593 quote failing macOS outputs but lack failing process snapshots. Disposable diagnostic copy traces captures/refusal site; no shipping edits. Awaiting native-lock release notice from its current owner before bounded run. Before-edit search covers claudePinnedTargets, claudeDescendantCapture, captureForStop, claudeStopAdmission, processTargetKey, afterCapture: processes.ts, claude-stop.ts, prepared.ts; native/unit concurrency controls, stage4 brief, host-agent docs, implement skill. No shared-contract change selected.

### impl-1678 · 2026-11-04T15:41:19.354Z

C1 evidence A-16603: exclusive passive macOS Node24.21 replay fails attempt2 with exact identity refusal; captured prepare PID6284 turn-start, commit6499 mod-turn-start, expected6684 injected, recapture6763 turn-end, all parent/root5621 with pinned native births. Classified genuine new unpinned hook on second churn, not settled exit/same-set republish/unknown. T-1666 completion wait can match stale first session.measure done while next turn starts; T-1612 pong precedes end hooks. Policy unchanged; question to lead asks scope decision before fixing. Slot released, lead T-1612 notified. Linux driver child failed later unrelated revoke shape; container0 is not pass and excluded.

### coord · 2026-11-04T15:41:44.529Z

Coord decision (2026-11-04 15:41Z, from T-1678's A-16603): remote Claude stop now signals the pinned root first, by identity, after admission. It then recaptures until two consecutive captures are equal, within the existing stop deadline, acquiring each new member under the unchanged rules: same UID, ancestry to the pinned root or a pinned member at observation, born after the first capture, pinned by PID and birth. This supersedes the fixed one-recapture bound for descendant churn. Unchanged: a persistent unknown identity, or a deadline with the set unstable, ends cleanup-incomplete with the row held; a foreign or unprovable process is never signalled; same-set republish is not churn; settled pinned exits drop out. Reason: a busy session's root spawns turn hooks continuously, so a fixed bound made stopping an active session fail.

### impl-1678 · 2026-11-04T15:46:17.908Z

Approved stop contract change c5caf575 inventory before edits: stopClaude/claudeStopAdmission/claudeDescendantCapture/processTargetKey/captureForStop searched across production, all tiers, web/nvim, QA, docs and shipped skills. Consumers: AgentProcesses in-memory stop/capture and prepared.ts; internal claude-stop scripted tests, capture-concurrency native controls, claude-code-remote and host-agent restart tests; E-1532 stage4 brief; host-agent.md, ssh-host prepare-stop table, implement skill. No wire/persisted shape/new capability. Removing only internal single-use budget; no old client needs migration. Prepared captures still bind first census/key locally; current/settled same-set reconciliation guard retained. Root TERM followed by deadline-bound stable sets changes descendant-churn outcome intentionally; foreign UID/orphan/unknown remain incomplete.

### impl-1678 · 2026-11-04T16:08:26.491Z

ac23003b root-first orphan adaptation implemented: SessionEnd no longer controls orphan lifetime; beforeSignals fixture observer retains no-orphan-target and pinned-root-identity assertions; held row settles only by two positive absence checks after independent orphan cleanup. Internal observation-only WeakMap fences cover every rejected root-group/pinned-parent-related PID with available birth (unknown birth requires ended); no serialized field or new signal authority. Missing current-lifetime fence after restart leaves unknown-authority refusal unchanged. sshHostFixture optional beforeSignals hook defaults absent and managed closeLog fault remains unchanged; searched all callers, no migration required. New existing-shape clients unchanged. No CLI/help/role-permission descriptions claimed fixed-budget semantics; matching runtime docs/skill/index updated.

### impl-1678 · 2026-11-04T16:12:02.115Z

Complete consumer inventory supplement: runtime AgentProcesses and prepared.ts; stop policy callers claude-stop.test.ts and claude-code-remote.test.ts. sshHostFixture callers: claude-code-remote, host-ssh-contract, host-prepared, host-agent-restart, host-clone-integration, opencode-remote, codex-remote-agent, remote-discovery-host (all hub/test/*.test.ts); optional beforeSignals hook defaults absent, their old setup unchanged. captureForStop consumer prepared.ts, native concurrency test. Current docs host-agent.md, ssh-host.md table, test guides, implement skill/CHANGES and hub README pointer migrated. Stage4 QA brief keeps its pinned historical case-name/source assertions with explicit stage5 supersession note; no current stage5 QA requested (review-only). No wire or ProcessRow shape change; client parsers, snapshots, startup probes and persisted-record readers unaffected; existing prior-hello closure regression retained. New unresolved callback/fence is current-lifetime-only and grants absence settlement, never signals.

### impl-1678 · 2026-11-04T17:51:44.832Z

Source ready at58bce302794682b46e536fcfdd53d32d9891f9cf, pushed territory, clean tree, dev54ebacbe0 integrated before first review. C1 A-16603/A-16630; C2/C3 A-16653 final runtime+fixture hashes matched: Linuxarm64 Node24.21 core/expanded survival87 outcomes in12 selected files, native exits0; generated mid-turn20/20/completed20/20 production load finishes, peer7pairs perround and phase0, no cancellations/skips. Macarm64 Node24.21 selected8/8 exits0. Hub types,4 static lints and valid-Git-baseline full lint zero refusals; report diagnostics not gates. A-16651 consumer inventory. Three C3 migrations and real-Claude unverified graceful-shutdown assumption explicit in evidence; no wire/persisted shape/permissions/dependencies changed. Global durationreport unchanged, C216 allowances9/9/6 expires11-11. Earlier failed drafts excluded; configured x64 verification follows clear source verdict; stage5 review-only.

### rev-35 · 2026-11-04T17:57:11.492Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1678-source-1
commit: 58bce302794682b46e536fcfdd53d32d9891f9cf
scope: full
findings: [{"severity":"medium","text":"Do not mark unknown orphan ownership closed from root/known-birth and old-group absence: an unowned orphan can fork a detached unseen writer then exit. No native closure owner proves that writer gone; retain the fence until sufficient closure evidence.","file":"hub/src/host/agent/processes.ts","line":317},{"severity":"medium","text":"Permit retained owned-child retry after positive root exit/replacement: root-first can leave a pinned hook on incomplete stop, but every retry currently requires live root and returns before stopping that child. Preserve unknown-root refusal and no acquisition from vanished root.","file":"hub/src/host/agent/claude-stop.ts","line":62},{"severity":"medium","text":"Prove C2 mid-turn at native stop admission with a held fresh turn/hook gate: a fresh busy frame followed by stop can become post-turn under load, so current20/20 does not establish active-turn hook churn at the stop boundary.","file":"hub/test/claude-code-remote.test.ts","line":430}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear:three medium findings, all confirmed by Implementer c46db60e/d0e4bd06/9354753c. A-16654 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16654-t-1678-source-not-clear-orphan-closure-retained-hook-retry-and-mid-turn-proof.md has traces/control requirements and Coordinator decisions. Root-first/convergence, explicit capture-seam/orphan fixture adaptations and graceful fake assumption are authorized; UID/initial-census/live-parent/birth/checkpoint safeguards otherwise inspected. Consumer/docs/skill/historicalQA migration checked; all27 closure hashes match. C1 failing process trace classification supports genuine hook churn; mark remains unverified. A-16653 independently matched15source hashes and structured20pass/case counts, but mid-turn semantics insufficient; selected Linuxarm64/macOS evidence supplemental, no configured x64/fullsuite/Web/browser/QA claim. C2/C3 failed. Escalate orphan closure semantics to Coordinator; fresh corrected-head source review before verification. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C2 failed (Current20/20 mid-turn campaign proves fresh-busy-followed-by-stop, without a deterministic active-turn/hook boundary.), C3 failed (New absence-only settlement can release unseen orphan writers, and live-root guard strands retained owned hooks on retry.).

### impl-1678 · 2026-11-04T18:04:33.372Z

Review A-16654 supersedes C2/C3 claims in A-16653: previous 20 mid-turn-labelled executions prove busy-frame-followed-by-stop only. Implementing decision2e340de1: delete absence-only WeakMap closure; unknown authority stays held even after independent cleanup or detached child escape. Positive exited/replaced root permits only retained pinned-hook retry, with unknown-root refusal. Fresh native gate holds exact turn/hook, verifies native producer and unchanged completion count at root-signal seam, then observes a spawned child's birth+parent before TERM. Wire/ProcessRow shapes unchanged. Root/helper consumer/error searches cover all prior inventory consumers; named error preserves existing 'could not stop' substring plus authority-unknown cause. Fresh source review precedes new20/20 campaign and verify.

### rev-35 · 2026-11-04T18:14:34.652Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1678-source-2
commit: 6468d516ad7a951c96f79a6e73041f5a51e6803d
scope: full
findings: [{"severity":"medium","text":"Complete positive root-replacement retry in the owner: reconciliation still treats the retired root pin as unresolved, and #capture counts the replacement numeric root as an unowned member before helper retry. Retire/exclude only the positively replaced birth; never signal/acquire its replacement. Add owner-level observations containing the live replacement row.","file":"hub/src/host/agent/processes.ts","line":342}]
finding_counts: {"high":0,"medium":1,"low":0}

Full repair source not clear:one medium, confirmed7d4924ef. A-16656 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16656-t-1678-repair-not-clear-root-replacement-still-blocks-retained-hook-owner.md records real-owner/reconciliation/helper refusal trace. A-16654 unknown absence closure removed under Coordinator2e340de1; detached-escape/independent-cleanup rows remain held with named cause. Ordinary root-exit retained-hook retry and deterministic live turn/producer/new-child gate now covered in source; root-replacement owner path incomplete. Docs/guides/skill and all27 closure hashes checked. C3 failed,C1/C2unverified; C2 correctly pending new gated20/20. A-16655 macOSNode24.21 selected68/five exits0/static supplements, no fresh Linux/configured/fullsuite/Web/QA claim; old A-16653 campaign remains qualified busy-followed-by-stop. Fresh source review after correction before20/20/verify. No Reviewer runtime/probes/browser/edits/Git mutation/delegation.

Criteria: C3 failed (Retained pinned-hook retry still fails for a positively replaced root in the owner/reconciliation path; helper-only unit omits that replacement row.).

### rev-35 · 2026-11-04T18:24:13.510Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1678-source-3
commit: 4ed533dc1df710bd590d0b17f9a76890051fd1dd
scope: full
findings: [{"severity":"medium","text":"Regenerate the index for the new claude-stop-owner-component guide: no row exists for that new document, but test-docs.test.ts requires every guide indexed, so required T1 will fail. Keep the full membership assertion.","file":"docs/agents/tests/index.md","line":41}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear:one medium generated-index omission; no further runtime findings. A-16656 replacement-owner gap resolved by shared positive-root-replacement predicate plus adopted pinned-target settlement; new real-owner scripted-OS test retains live replacement and signals only child101, unowned/unknown controls refuse. Helper snapshot includes replacement. A-16660 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16660-t-1678-source-pass-3-replacement-fixed-missing-owner-guide-index-row.md records proof/limits. A-16654 unknown holding, root-exit retry and deterministic native mid-turn gate retained. All27 closure/21 evidence-source hashes match. A-16659 selected macOSNode24.21 72 outcomes/six native exits0 supplement only; fresh gated Linux20/20/configured/Web/fullsuite pending. C3 failed,C1/C2unverified. One index fix then fresh source review before campaigns/verify; no Reviewer runtime/probes/browser/edits/Git mutation/delegation.

Criteria: C3 failed (New owner regression's guide is missing from generated index, making required T1 documentation validation fail.).

### rev-35 · 2026-11-04T18:25:35.227Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1678-source-4
commit: ecccc6cd354cfca42192bbccc9c5c2aba6e932fe
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, no findings. Complete sole delta from4ed533dc1 is one correct generated owner-component guide row; A-16660 resolved, runtime/test bytes unchanged. A-16662 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16662-t-1678-source-clear-root-first-convergence-and-complete-guide-index.md records carry/limits. Prior ownership findings resolved: unknown absence never settles, held detached-orphan controls; positive root exit/replacement retires old birth through reconciliation/owner/helper; live replacement component signals only pinned child, other unowned/unknown refuse. Deterministic native held-turn/new-writer gate covers actual root-signal admission. Approved C3 migrations/real-Claude unverified assumption retained. Parent27closure/21evidence hashes match; only index differs here. Reported test-docs4/4 supplemental; A-16659 selected macOS72 predecessor runtime-equivalent, no new native rerun claim. C1–C3unverified; C2 intentionally incomplete until corrected gated Linux20/20each, then configured mode-free verify at unchanged head per Coordinator order. Old A-16653 mid-turn campaign remains qualified busy-followed-by-stop. No Reviewer tests/probes/browser/edits/Git mutation/delegation.

### impl-1678 · 2026-11-04T19:07:40.141Z

Campaign evidence correction: clean declared-only A-16671 supersedes A-16665, whose reused export directory included stale files from an earlier head. New empty directory contains exactly README/current22-hash manifest/current Linux log/40 current gate receipts, all scanned; unchanged ecccc6cd3 C2 proof20/20 each, no rerun. Configured verify f095b0bc/A-16670 is exit0 with5054 passes; allT1, fallbackallT2, changedT3 duration phase andWeb complete on dropletLinuxx64 Node24.21/ChromeHeadlessShell156.0.8078.4, remainingT3 deferred/T4unexecuted, report-only duration diagnostics. Awaiting Coordinator's authorized post-T1609 dev merge; no source edits. New native retry worst6.714s implies C216cap>=10.071s on that next head.

### rev-35 · 2026-11-04T19:08:34.772Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1678-final-1
commit: ecccc6cd354cfca42192bbccc9c5c2aba6e932fe
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear,no findings; C1–C3verified at unchanged source-clear ecccc6cd3. A-16672 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16672-t-1678-final-clear-classified-failure-deterministic-linux-load-and-safety-contro.md independently records C1 process-capture classification A-16603/A-16630, clean A-16671 current22hash/43file export,40 matched native load start/finish passes=20/20each,all timestamps inside4peerphase intervals,4clean rounds/49native closes0/signalnull/container0. Old A-16665 stale extras superseded,old A-16653busy-only campaign notC2. Configured f095b0bc/A-16670 exit0/5054pass/zero fail,cancel,skip,todo; actual helper24/concurrency4/remote26/ownerparent+3modes/closure4/docs4 pass. Native heldturn/completed/orphanheld/detachedescape/retainedhook safety names checked; approvedC3exceptions explicit. T0/allT1/fallbackallT2/changedT3twofiles30base/Web complete,remainingT3batch,T4unexecuted. UncachedLinuxx64 Node24.21/Nvim0.12.5 isolatedHeadlessShell1248 Chrome156.0.8078.4 runner tree37f640978af7df4443ddb6f020c8d986b493b336 distinct from reviewed/campaigna77770de47b854126ba9cd164b1ea509df5c536c; headagrees. Local campaignLinuxarm64/no browser distinct. Budgets/ratchet/skip diagnostics report-only; billingunknown notzero. Real-Claude gracefulTERM assumption unverified/accountQA follow-up remains; no peritemQA. No Reviewer execution/probes/browser/edits/Git mutation/delegation.

Criteria: C1 verified, C2 verified, C3 verified.
