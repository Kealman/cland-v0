---
id: T-1826
kind: task
title: Removing and snapshotting a login from the hosts view
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1825
topic: topic-1496
branch: t/T-1826-removing-and-snapshotting-a-login-from
created: 2026-11-12T10:07:20.735Z
updated: 2026-11-12T21:37:02.659Z
closed: 2026-11-12T21:37:02.659Z
---

## Summary

The hosts view removes and snapshots logins through the hub. Removal sits behind a confirmation that says the volume and its snapshots are deleted, and is not offered for a login in use.

## What to build

Two actions on each disk login's line:
- **Remove.** Offered for a login that is not in use, through `login.remove`. A confirmation names the login and says that its volume and snapshots are deleted.
- **Snapshot.** Through `login.snapshot`; the line shows the hub's result, or its refusal, such as a snapshot inside the provider's window.

A key login offers Remove only; its key file is deleted as `cland login remove` deletes it. Confirm and Cancel follow the session actions' pattern, and the hub's refusals show on the login's line.

## Acceptance criteria

- [x] C1. `Remove` on a ready login asks for confirmation naming the login and the deletion of its volume and snapshots, and Confirm removes it, so that `cland login list` no longer shows it (test).
  - done: impl-1826 · 2026-11-12T20:16:55.766Z
  - verified: rev-35 [reviewer] · run rev-35-1826-final-1 · 2026-11-12T20:51:56.009Z · commit 87d49e1cd8d3c636bc31edaacb390ce98959bda5
- [x] C2. A login in use offers no `Remove`, and a removal the hub refuses leaves the login listed with the hub's reason on its line (test).
  - verified: rev-35 [reviewer] · run rev-35-1826-source-2 · 2026-11-12T20:26:21.661Z · commit 87d49e1cd8d3c636bc31edaacb390ce98959bda5
  - verified: rev-35 [reviewer] · run rev-35-1826-final-1 · 2026-11-12T20:51:56.009Z · commit 87d49e1cd8d3c636bc31edaacb390ce98959bda5
  - done: impl-1826 · 2026-11-12T20:52:04.787Z
- [x] C3. `Snapshot` on a disk login takes a snapshot through the hub, and the login's snapshots in `cland login list` include the new one (test).
  - done: impl-1826 · 2026-11-12T20:16:56.332Z
  - verified: rev-35 [reviewer] · run rev-35-1826-final-1 · 2026-11-12T20:51:56.009Z · commit 87d49e1cd8d3c636bc31edaacb390ce98959bda5
- [x] C4. A snapshot the hub refuses shows the hub's text on the login's line and changes nothing (test).
  - done: impl-1826 · 2026-11-12T20:16:56.561Z
  - verified: rev-35 [reviewer] · run rev-35-1826-final-1 · 2026-11-12T20:51:56.009Z · commit 87d49e1cd8d3c636bc31edaacb390ce98959bda5

## Blocked by

- T-1825

## Notes

- Hot files: `web/src/sessions/HostsView.tsx`, `HostsView.module.css`.
- Tests: `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider and the fake harness binaries, isolated Headless Shell).
- Serves epic C2.

## Comments

### impl-1826 · 2026-11-12T20:15:15.660Z

Consumer scope: existing login.list/remove/snapshot shapes and authority are unchanged. New consumers are HostsView LoginRow and Web hosts-view tests. Existing producer/consumer references inspected: hub/src/hub/dispatch.ts, web/src/connection.ts, hub/test/login-list.test.ts, login-remove.test.ts, login-snapshot-cli.test.ts, login-snapshots.test.ts and docs/hub/logins.md. No connect frame, hub producer, native owner or keyboard contract change; host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back and nvim hosts-native remain unaffected. Item-prescribed Web seam uses projectHub, fake providers, isolated Headless Shell and local-human login.list readback. Stage QA after-stage on dev; no per-item brief required.

### rev-35 · 2026-11-12T20:22:32.532Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1826-source-1
commit: 4fc06fc08e8b76bf08f314fbde6d503d71a64a05
scope: full
findings: [{"severity":"medium","text":"C2 never establishes an actual in-use login at the no-Remove assertion. The pre-startup seed names only synthetic v-bound/host-sentinel without a settled fake volume/provision, and the test reads neither its post-startup state nor the rendered state. A retained binding alone independently hides Remove even on a signed-out row, so this can pass without exercising the required in-use case. Establish a stable in-use fixture at the view boundary and assert the named login's live login.list state/binding and rendered in-use state before the no-Remove check; retain the refusal/list-preservation control.","file":"web/test/hosts-view.test.ts","line":339}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete first source pass, A-19126: one medium C2 proof gap at web/test/hosts-view.test.ts:339. Stabilize the in-use fixture and assert exact current named state/binding plus rendered in-use before button absence; retain the independent refusal/list-preservation assertions. No product, observer, clock or cleanup finding in remaining scope. A-19124/A-19125 local raw/excerpt evidence, precommit linkage, negative-control distinction and known T1806 limits retained. No Reviewer runtime execution or provenance rerun. Hold released for correction; fresh source review before exact-head mode-free verification. Remaining T3/T4 release split unchanged.

Criteria: C2 failed (The no-Remove control never establishes current login.list and rendered in-use state; a retained binding can hide Remove independently.).

### impl-1826 · 2026-11-12T20:24:39.290Z

Source1 C2 corrected at 87d49e1cd8d3c636bc31edaacb390ce98959bda5: positive list/rendered in-use and binding assertions; actual red signed-out mismatch before moving real fake disk/binding admission after startup. Exact-head Web 9/9 and typecheck pass on local macOS; raw receipts A-19127. Source review requested again; Linux mode-free verification pending source clearance, full T3 merge occasion and T4/stage QA on dev. Known T-1806 +3 cland-h retained in whole-file delta, no hc/ct delta; TMPDIR 0 to 0.

### rev-35 · 2026-11-12T20:26:21.661Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1826-source-2
commit: 87d49e1cd8d3c636bc31edaacb390ce98959bda5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear, A-19128. C2 corrected and verified from genuine post-startup fake volume/admitted binding, exact live login.list in-use/host and rendered in-use/host assertions, retained actual refusal/list-preservation control, and committed-head A-19127 raw9/9 local Web receipt. Controlled red actual signed-out vs expected in-use retained. Product unchanged; two test/guide files only, no dev merge, clean pinned87d49e1cd. No Reviewer execution; original and supplemental capture/inventory/T1806 limits retained. Hold released for mode-free verify at this unchanged head. Final readiness and other criteria await configured Linux ordinary positive case/file receipts; keep base/load scopes separate. Remaining T3/T4 split unchanged.

Criteria: C2 verified.

### rev-35 · 2026-11-12T20:51:56.009Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1826-final-1
commit: 87d49e1cd8d3c636bc31edaacb390ce98959bda5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear, A-19130. Independently streamed A-19129:6228 base test/690 base file passes, separate125 load test/file passes, no negatives. Exact4 new Web cases and ordinary file pass; C2 corrected state/binding/rendered control reconfirmed on Linux; all9 file cases positive. Explicit login producer/authority/Hosts controls checked positive; unchanged native/T4 consumers deferred. Normalized tree independently matches b3ce08ccf8516ccda075783349168fce404f8a43; clean unchanged87d49e1cd. Local T0 and Linux runtime/browser provenance separated. Web0required repetitions, no isolated-repeat claim; advisory budgets/lint and local capture/T1806 limits retained. All C1–C4 verified for readiness; evidence hold released. Retain claim until normal merge handoff; no further source change or rerun requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-12T21:37:02.659Z

Merged d1f76e51776eaf483442f53918201921420975fe onto dev.
