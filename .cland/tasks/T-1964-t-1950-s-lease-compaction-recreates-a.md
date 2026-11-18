---
id: T-1964
kind: task
title: "T-1950's lease compaction recreates a deleted project directory: its recursive mkdir under .cland/run/executor races project deletion and hub stop"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1950
topic: topic-1619
branch: t/T-1964-t-1950-s-lease-compaction-recreates-a
created: 2026-11-18T08:31:35.525Z
updated: 2026-11-18T10:44:59.444Z
closed: 2026-11-18T10:44:59.444Z
---

## Summary

T-1679's merge batch e028e266 (Linux droplet c-8 ams3, integrated head c81a13553, A-21143) failed in T3 on `hub/test/territory-lock.test.ts:396`, "a hub stops successfully twice after its project directory is deleted": `AssertionError [ERR_ASSERTION]: Missing expected rejection.` (expected `{ code: 'ENOENT' }` from `fs.stat(root)` after `daemon.stop()`). So the project directory existed again after it was deleted and the hub stopped. T-1950 (91d59bbe8) added lease-index compaction that writes under `.cland/run/executor` with `mkdir(..., { recursive: true })` (demo, report and lease roots, plus `lease-index.json`), which recreates every missing parent, including a deleted project root. It's the same race class as T-1960, where compaction raced the test's recursive removal. The case passed 5/5 alone on macOS (3 single-case runs on dev 6b8f29393 and on T-1679's head, and 2 whole-file runs of 20/20 at load 3.5–3.9), so it's intermittent. T-1679's diff (sessions.ts, host-survival.test.ts) doesn't touch it.

## What to build

Background lease work never recreates a project root that has gone: it creates only its own subdirectory under an existing `.cland/run` (no recursive creation above it), and treats a missing project as a stop condition with a structured outcome. Hub stop joins any in-flight compaction before it resolves.

## Acceptance criteria

- [x] C1. With the project root deleted while a compaction pass is held mid-write, the pass ends without recreating any directory, and `fs.stat(root)` rejects with ENOENT after stop (deterministic test with a held fake, not a timing race).
  - done: impl-1964 · 2026-11-18T09:15:26.942Z
  - verified: rev-35 [reviewer] · run rev-35-1964-evidence-1 · 2026-11-18T09:53:28.032Z · commit 7850ef911906f53d035f6f238a68556c40414b5d
- [x] C2. Hub stop resolves only after in-flight compaction has joined, and a second stop is a no-op (test).
  - done: impl-1964 · 2026-11-18T09:15:27.506Z
  - verified: rev-35 [reviewer] · run rev-35-1964-evidence-1 · 2026-11-18T09:53:28.032Z · commit 7850ef911906f53d035f6f238a68556c40414b5d
- [x] C3. Every writer under `.cland/run/executor` that T-1950 added or changed is listed with its creation mode (rule 41), and none creates directories above `.cland/run`.
  - done: impl-1964 · 2026-11-18T08:48:55.214Z
  - verified: rev-35 [reviewer] · run rev-35-1964-source-3 · 2026-11-18T09:19:43.881Z · commit 7850ef911906f53d035f6f238a68556c40414b5d
  - verified: rev-35 [reviewer] · run rev-35-1964-evidence-1 · 2026-11-18T09:53:28.032Z · commit 7850ef911906f53d035f6f238a68556c40414b5d

## Comments

### impl-1964 · 2026-11-18T08:36:06.217Z

Consumer/writer audit and deterministic red/green evidence published in the item topic artifact. New compaction directory creation is nonrecursive below existing .cland/run; existing admission writers are explicitly separated in the inventory. Persisted index version 1 and legacy fallback are unchanged.

### rev-35 · 2026-11-18T08:59:58.797Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1964-source-1
commit: 0857526159767b0c07b643cfa5414cc1c2301feb
scope: full
findings: [{"severity":"medium","text":"Three new fresh-start/actual-stop callbacks lack a pre-acquisition whole-callback owner; fixture cleanup covers selected phases only and the held-case finally starts after setup/reconcile. Enroll/adopt/join the new sequences before acquisition, including cancellation and early hold release (A-21152 M1).","file":"hub/test/executor-prepare-component.test.ts","line":71},{"severity":"medium","text":"The new scripted-provider callbacks have no positively controlled native-launch guard through setup/body/cleanup; semantic fakes/projectHub do not supply that guard. Reuse the shared guard with positive controls and final counted verification (M2).","file":"hub/test/executor-prepare-component.test.ts","line":85},{"severity":"medium","text":"New/changed filesystem fault seams (also prepare-component :97 and lease-index :27) use TestContext-managed t.mock without an independent positive original-work lifetime on cancellation. Retain fixture-owned seams until original callbacks/writers join and keep a held cancellation control (M3).","file":"hub/test/executor-droplet-component.test.ts","line":89},{"severity":"low","text":"The T1 guide omits the new structured missing-run stopped result and unrelated publication ENOENT controls; add their anchor and seam-lifetime guidance (L1).","file":"docs/agents/tests/hub-test-executor-lease-index.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":3,"low":1}

Full source pass at085752615/base6b8f29393: Standards3medium+1low, Spec0 within Coordinator-agreed scope. A-21152 consolidates M1–M3/L1, lead confirmations72c0378c/d879b24f and qualified evidence A-21146/48/49/50/51. No additional production finding: bounded child mkdir, structured missing-run receipt, locked startup anchor and reconcile/release join match the agreed scope. C3 writer classification retained; request/completion paths explicitly deferred by Coordinator toT-1965. Failed and green148-file epochs differ;57+2 overlap; T3system-processes59/59 is separate native selected evidence, no final-head configured run. No tests/probes by Reviewer. Pin released; correct only new/changed ownership/isolation plus guide, then fresh clean-head source review before verify.

Criteria: C1 failed (New deterministic writer/actual-stop proof has unresolved callback/native-guard/filesystem-seam cancellation ownership; M1–M3 in A-21152.), C2 failed (Actual hub-stop callbacks and held writer seam lifetime are not owned through setup/cancellation before cleanup; preserve and correct the stop/second-stop assertions.).

### rev-35 · 2026-11-18T09:13:00.038Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1964-source-2
commit: c8f7b8c29cff9656112e9d7e789d0a30b1189de2
scope: full
findings: [{"severity":"medium","text":"The three new synthetic-context cancellation controls (:31/:63) do not invoke captured hooks[0] from the real test's fallback when closing is undefined. Early setup/observer/assertion failure can join rejected running without disposing the synthetic fixture, leaking its root/global guard/seams. Guarantee fallback disposal independently of the happy-path assignment; A-21155 bounded bar.","file":"hub/test/executor-droplet-component.test.ts","line":31}]
finding_counts: {"high":0,"medium":1,"low":0}

Full consolidated correction pass: Standards1medium residual, Spec0. Original M1 actual hub callbacks, M2 native guard, M3 manual seam lifetime and L1 guide are corrected. Single residual concerns only3new synthetic-context controls, confirmed99c42497. A-21155 gives final bounded fallback bar; no production/wider migration/stress/provenance loop requested. Production unchanged from085; C3/T-1965 disposition retained. A-21153/54 report targeted56/full typecheck/lint0 with distinct prior failed/check epochs and no configured verify. Pin released; fix residual/restore implementation-done marks then fresh clean pushed-head review before verify.

Criteria: C1 failed (New held/late-root control fixtures can skip synthetic-owner disposal on early failure; residual M1 in A-21155.), C2 failed (The shared fixture's new cleanup controls retain an unowned early-failure path; guarantee captured cleanup before final proof.).

### rev-35 · 2026-11-18T09:19:43.881Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1964-source-3
commit: 7850ef911906f53d035f6f238a68556c40414b5d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full consolidated source clear, Standards0/Spec0; A-21162. Last residual fixed: pre-enrolled real fallback always invokes shared captured synthetic disposal, releases holds, joins producer/cleanup and propagates cleanup failures; focused early-failure control requires root ENOENT and restored fs/spawn globals. Original M1/M2/M3/L1 corrections retained; production unchanged from085. C3 static writer/consumer creation-mode audit verified within Coordinator-approved scope; deferred request/completion writers remainT-1965. C1/C2 done but runtime-unverified pending exact-head mode-free result. A-21161 current26/26/full typecheck/lint0 positives retain limits; earlier56/148/T3 epochs not relabelled, no provenance rerun. Clean pushed7850ef911 may request Coordinator verify window; post-land integrated cover remains required. Pin released.

Criteria: C3 verified.

### rev-35 · 2026-11-18T09:53:28.032Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1964-evidence-1
commit: 7850ef911906f53d035f6f238a68556c40414b5d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, C1/C2/C3 verified. A-21167 audits owner code0/empty cause for4eb4bb9b/A-21166 at unchanged source-cleared7850ef911:6775 ordinary passes,711 positive file envelopes, complete225T1/430T2/55Web plus selectedT3system-processes59/59;295 separate load passes. All17 new task identities have base+5loads, including held writers, startup/deleted-root close variants, actual hub-stop/second-stop, typed stopped/unrelatedENOENT and early-failure/seam cleanup controls. Six added tier diagnostics trace precisely to shared positive native-refusal custom controls; all14 lease-index warnings have those stacks and guard assertions pass. C3 audit/T-1965 scope retained. Snapshotec08ac00 distinct from Git tree6ece8c6f. Remaining247T3/17T4 and originalterritory-lock unexecuted here; post-land integrated cover before restart remains required. Platform/browser/report-only advisories/prior epoch limits retained. No Reviewer tests/probes or rerun; pin released.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-18T10:44:59.444Z

Merged a58fb46d5db735f54edd15fa9e3d227d2d0ec072 onto dev.
