---
id: T-1222
kind: task
title: cland init writes a Codex sandbox for Implementer and Aide that differs from the built-in defaults
state: open
status: review
size: S
criterion_seq: 3
labels:
  - needs-info
  - site
assignee: null
parent: E-778
blocked_by: []
topic: topic-960
branch: t/T-1222-cland-init-writes-a-codex-sandbox-for
created: 2026-10-24T09:42:30.046Z
updated: 2026-10-24T11:00:27.117Z
---

## Summary

Found by impl-783 in the T-783 docs pass (2026-10-24 09:41Z, topic-953). `hub/src/roles/template.ts` (the roles.toml that `cland init` writes for a new project) gives Codex Implementer and Aide `sandbox = "workspace-write"`. The built-in defaults in `hub/src/roles/default-roles.ts`, and this project's own roles file, use `danger-full-access`, following the human's 2026-10-09 decision (T-65) that every harness gets full access to do its role's work. So a new user's crew runs sandboxed while cland's own crew doesn't, and the docs can't describe one default. Before the public launch, one default should hold for new projects and the docs should state it.

## Decision needed (the human)

- (a) New projects get `workspace-write` for Implementer and Aide (safer for strangers' machines; some role work may need `writable_roots`). Built-in fallback defaults change to match.
- (b) New projects get `danger-full-access`, as cland's own crew does. The template changes to match, and the docs warn plainly that Codex roles run unsandboxed.

## Acceptance criteria

- [x] C1. The human's choice is recorded on this item.
  - done: impl-1222 · 2026-10-24T10:46:22.221Z
  - verified: rev-23 [reviewer] · run rev-20261024-1222-source2 · 2026-10-24T11:00:27.117Z · commit 381a8799f392239cd9ad57d7806adc540f913b5d
- [x] C2. `cland init`'s generated roles.toml and the built-in fallback defaults agree for every role's Codex sandbox, shown by a test comparing the two.
  - done: impl-1222 · 2026-10-24T10:57:06.066Z
- [x] C3. site/src/content/docs/docs/ states the default and how to change it.
  - done: impl-1222 · 2026-10-24T10:46:23.987Z
  - verified: rev-23 [reviewer] · run rev-20261024-1222-source2 · 2026-10-24T11:00:27.117Z · commit 381a8799f392239cd9ad57d7806adc540f913b5d

## Comments

### coord · 2026-10-24T10:19:56.037Z

Decision (human, General 2026-10-24 10:15Z, answer to ask a133b534): (a). New projects get `sandbox = "workspace-write"` for Codex Implementer and Aide. The built-in fallback defaults change to match. This project's own .cland/roles.toml stays unchanged (danger-full-access, T-65).

### impl-1222 · 2026-10-24T10:23:53.516Z

Decision (a) implementation in progress. C2 public seam: generated Codex TOML versus fixedRoles()/omitted-role/missing-key fallback policy for all six roles. Coordinator confirmed explicit full-access fallback for Coordinator/Lead too (topic-960, 2026-10-24 10:21Z). First regression written; runtime red/green waits for cover-quiet release. Docs explain fallback changes, unchanged explicit project policy, and writable_roots needed for task-worktree commits/shared writes. No production policy changed before the red run.

### coord · 2026-10-24T10:53:39.564Z

Human decision on ask dc166c87, Aide sandbox in new projects (coord, 2026-10-24 ~10:52Z): the Aide runs workspace-write with no extra writable roots and makes no commits in the project root. That is the hub's option 3 ("workspace-write без коммитов в корне: коммитит Coordinator"). The hub's recorded answer "1" (danger-full-access) is void. The stand-in relayed the human's «1» against coord's own numbering, in which option 1 meant this choice, and then answered the hub ask by number. impl-1222's current policy already matches the decision, so its source review no longer needs a provisional note.

### rev-23 · 2026-10-24T10:54:01.605Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1222-source
commit: 45d701fc7ce0e4900ff5d34f55d702267651132f
scope: full
findings: [{"severity":"medium","text":"M1: all seven new guides wrap the test path in backticks, so existing exact-path heading/index guard rejects them. Use unquoted repository test-path headings and preserve bodies/index; reproduce red/green.","file":"docs/agents/tests/hub-test-codex-workspace-git.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1222 full source review — not clear

Head45d701fc7ce0e4900ff5d34f55d702267651132f/treeb5ed8dceff928a92eae691de0c26f8f90fdf18c1. Fixed incorporated dev44f220a559e2f027daf9ba59a9f14098efbd99f7; git diff44f220a5...45d701fc, commits6f828194/45d701fc.25files310+/37−. Role clause and project roles.toml unchanged. Run rev-20261024-1222-source, scope full; both axes in-session under crew.reviewer.subagents=false. Complete finding set M1 only.

## Standards

M1 (medium), docs/agents/tests/hub-test-codex-workspace-git.test.ts.md:1 and all six other newly indexed test guides: headings contain backticks around repository test paths. Existing test-docs.test.ts extracts /^# (.+\.test\.ts)$/m and derives the document name from that exact path; closing backticks prevent every heading from matching. All seven guides will fail the T1 index contract despite successful source/type/build lint. Use unquoted exact repository-path headings, preserve guidance/index and reproduce red/green with the existing guard. The same issue affects adapter-composition, codex-adapter, roles-component, roles-launch-permissions, roles-template-component and roles-template guides.

Other test-level/fixture review clear: T1 compares generated versus missing-file/omitted-role/missing-key Codex policy for all six roles; T2 resolves generated/fallback Implementer roots through real admission/fake adapter/threadPolicy. New T4 uses real sealed scratch Git under synthetic Seatbelt with no whole-temp grant, disables Git auto-GC, observes commit/push/fetch refs and denies hooks/config writes/protected dev push. It explicitly skips nonmacOS and does not claim Linux parity. Existing native adapter expectations/launch-relaunch controls are retained and updated to new policy. Renamed scenario's stale timing/allowance keys are removed without invented timings. No new wall waits or workload/cap relaxation. Onboarding is project-owned, so upstream CHANGES requirement does not apply there. Whitespace check passes.

## Spec

No policy finding beyond the documentation/test contract above. Human decision(a) is recorded on the item in Coordinator's2026-10-24T10:19:56 comment. Coordinator91490554 confirms Coordinator/Lead omitted sandbox keys become explicit full access; documentation names that loosening. Decisions698f37b2/2b5beb0f narrow Implementer grants to eight relative roots: root Git objects/refs/logs/worktrees, territory objects/refs/logs, artifacts. Neither whole Git/territory root nor hooks/config is granted. Sessions resolves roots relative to project root; threadPolicy receives the exact writes and full network. Written roots replace defaults, explicit sandbox including empty string is preserved, and running sessions change only at launch/relaunch. Generated and fallback Reviewer/read-only, QA/full access and Implementer/workspace-write agree. Aide remains workspace-write/no extra roots and documented root commits fail.

Coordinator6bd2d7c2 explicitly directs source review now with provisional Aide policy while human askdc166c87 is pending; any differing delta needs fresh review before ready, and Coordinator will not enqueue until answer. This review neither approves that pending choice nor blocks source solely on it. No C1 final verification before the pending disposition is settled.

C3 docs/site explain defaults, missing-key behavior changes, overrides, narrow roots and remaining user-config/npm-cache/external-Git/macOS ps/FSEvents limitations. Hub help/session-permissions/onboarding and historical sandbox measurements agree. Coordinatorc68ca68a explicitly accepts T2 resolved-policy plus macOS synthetic Seatbelt as merge evidence; native Codex committing/pushing on generated defaults belongs to E-778 after landing/before launch and Linux Landlock parity is out of scope. The synthetic test is not relabelled native enforcement.

## Evidence and disposition

Request reports local macOS targeted11/11 including synthetic T4 zero skips, fake-native adapter12/12, updated policy19/19, check exit0 with report-only lint133/60files/zero refusals and site23pages. Those summaries do not exercise the missing docs guard. Original native commands/stdout/exits/timings/source receipts requested for durable preservation without transcription reruns; no complete configured receipt exists yet. No native Codex enforcement or Linux parity/QA pass claimed.

C2 failed for M1 blocking the test-docs contract in configured verification; C1's final decision and C2 runtime evidence remain pending, C3 otherwise source-established but unmarked in this not-clear verdict. Correct M1, commit/push and request fresh source review before mode-free verification. No dev merge after first review absent Coordinator direction. Reviewer used static source/Git/artifact reads only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards one medium finding; Spec zero additional findings.
Durable review A-10776.

Criteria: C2 failed (All seven new indexed test guides have backticked headings rejected by existing test-docs T1 contract; correct headings before configured verification.).

### impl-1222 · 2026-10-24T10:57:06.927Z

M1 fixed at 381a8799: seven new guide headings now use exact plain test paths. Existing hub/test/test-docs.test.ts reproduced failure at 45d701fc (`hub-test-adapter-composition.test.ts.md: test file heading`) then passed 3/3 locally on macOS after correction. Original command/source/stdout/exit/timing receipts preserved without transcription reruns in A-10777 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10777-t-1222-original-local-command-receipts); any original output truncation remains explicit. Requested fresh source review before verify. Coordinator confirmed the final human Aide policy already matches current source: workspace-write/no roots/no project-root commits.

### rev-23 · 2026-10-24T11:00:27.117Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1222-source2
commit: 381a8799f392239cd9ad57d7806adc540f913b5d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1222 corrected full source review — clear

Head381a8799f392239cd9ad57d7806adc540f913b5d/tree53189de808ba0c164cf660888f91b2454740d527; incorporated dev44f220a559e2f027daf9ba59a9f14098efbd99f7. Origin task ref independently matches. Full source audit A-10776 carried forward; inspected full baseline plus correction45d701fc..381a8799, exactly seven heading substitutions. No dev merge. Run rev-20261024-1222-source2, full scope, both axes in-session, findings [].

Standards: M1 resolved: all seven newly indexed guides use unquoted exact repository test paths. Guide bodies/index, tests, source and policies byte-unchanged by correction. Existing T1 guard regex/name contract is satisfied statically, whitespace check clean. Prior T1/T2/fake-native/T4 ownership, sealing, exact-write-root/negative controls and timing-key retirement audit remains accepted; no further finding.

Spec: C1 verified. Coordinator0c61c0e7 and the durable item comment record final human dc166c87 decision: Aide workspace-write/no extra writable roots/no project-root commits. The ask's “option1” is expressly void due relay numbering error. Current source matches that final decision without a policy delta; no provisional condition remains. Initial choice(a), Coordinator/Lead explicit full-access fallback and eight narrow Implementer roots remain as audited. C3 verified: site/docs/help/onboarding describe defaults/changes/overrides, explicit settings preserved, running policies apply at relaunch, remaining access limits and native enforcement evidence boundary. Role clauses/project roles.toml unchanged. No additional permission/role grant expansion.

C2 source proof remains accepted: generated and missing-file/omitted-role/missing-key fallback equality for all six Codex roles; generated/fallback task-worktree policy resolves eight absolute Git/territory/artifact roots with no hooks/config/whole-repository grant. Existing written-list override and explicit-empty sandbox behavior remain. Final runtime settlement awaits configured same-head verification.

A-10777 contains48 original selected tool records/24calls, with original commands/source operations/output/native exits and explicit truncation. Audited native fake-binary adapter12/12 (18566.833833ms), updated policy19/19 (2408.16125ms), committed45d701fc regression11/11 (2070.057625ms), final check terminalaeee74 exit0/zero lint refusals, site23pages/2.24s with original truncation retained. Native/check launches before timing-cleanup commit are source-tree evidence, not claimed exact-launch-after-commit. Initial policy/stale-timing failures remain visible. Check lint report-only133/60files; no total check wall inferred.

Guard red8ebc61 retains2/3pass1fail and exact bad heading. Lead reports corrected green3/3, but the selected artifact omits that green command/result; latest436a8a is a diff/source extraction terminal. Requested preservation of its original retained record, no rerun for transcription. Therefore green3/3 is currently lead-reported, not independently raw-audited; static correction is independently clear. Fresh configured T1 will supply exact-head guard proof.

Coordinatorc68ca68a accepts T2 resolved policy plus local macOS synthetic Seatbelt proof for merge; synthetic file-write allowlist is not native Codex enforcement, and nonmacOS skip is not Linux Landlock parity. Native Codex scratch commit/push belongs to E-778 after landing/before launch, not this merge gate. QA none/after-stage; no QA pass claimed.

Source clear permits configured mode-free verification unchanged at381a8799, with actual changed T3/T4/mapped-guard selection/timing/skip records retained. C1/C3 verified, C2 runtime pending. Reviewer static source/Git/artifact reads only; no tests/probes/install/edits/Git mutation/browser/delegation. Standards zero findings; Spec zero findings.
Durable review A-10782.

Criteria: C1 verified, C3 verified.
