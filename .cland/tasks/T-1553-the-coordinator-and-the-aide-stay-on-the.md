---
id: T-1553
kind: task
title: The Coordinator and the Aide stay on the local host
state: open
status: ready
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1552
topic: topic-1305
branch: t/T-1553-the-coordinator-and-the-aide-stay-on-the
created: 2026-10-31T23:47:42.983Z
updated: 2026-11-01T21:19:54.334Z
---

## Summary

`session.launch` takes an optional `host`, `local` by default. The hub refuses an unknown host, and refuses any host other than `local` for the Coordinator and the Aide, whether at launch, relaunch, fresh resume, role set or handover.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/requests.ts`, `hub/src/protocol.ts` (the `session.launch` frame), the role set and handover path in `hub/src/hub/core.ts`

## Acceptance criteria

- [x] C1. `session.launch` accepts an optional `host` naming a registered host, defaults to `local`, and refuses an unknown host by name before anything is reserved or spawned (test).
  - done: impl-1553 · 2026-11-01T20:44:45.564Z
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
- [x] C2. Through the frame protocol, a launch, relaunch or fresh resume of a Coordinator or Aide with a test host is refused with a reason saying these roles run only on the local host, and nothing is spawned or reserved (test).
  - done: impl-1553 · 2026-11-01T20:44:45.713Z
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
- [x] C3. Setting or handing over the Coordinator or Aide role to a session whose row is on another host is refused with the same reason (test).
  - done: impl-1553 · 2026-11-01T20:44:45.841Z
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
- [x] C4. A launch of another role with a test host reaches that host's spawn (here refused by the test host), and a launch without `host` is unchanged (test).
  - done: impl-1553 · 2026-11-01T21:02:38.086Z
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
- [x] C5. The role-launch, roles-launch-permissions and session-launch test files pass with no test edited.
  - done: impl-1553 · 2026-11-01T20:44:46.343Z
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
- [x] C6. The implement skill's Host sessions paragraph no longer says every production lookup resolves local: it names the host registry (T-1552) and the refusal for an unregistered host, in the existing Host section.
  - done: impl-1553 · 2026-11-01T20:44:46.722Z
  - verified: rev-35 [reviewer] · run rev-35-1553-source-2 · 2026-11-01T20:49:19.793Z · commit 7fd84078d4bc9acac68ea564f4b4e03ef5d9994a
  - verified: rev-35 [reviewer] · run rev-35-1553-source-3 · 2026-11-01T21:03:01.282Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d
  - verified: rev-35 [reviewer] · run rev-35-1553-final-1 · 2026-11-01T21:19:53.725Z · commit c5bd1b488400519fec356d02c2d02d641ebcb88d

## Comments

### impl-1553 · 2026-11-01T19:07:50.808Z

Read A-15100/A-15205, spec §1–3.1 and E-1531. Dependencies present; fetched origin/dev (already current). Prepared first C1 frame regression in new session-host-placement.test.ts, leaving C5 preservation files unchanged. Red run and all heavy local commands are held for the Coordinator's cover-quiet release. Contract consumer inventory published in item topic.

### impl-1553 · 2026-11-01T20:41:46.587Z

Consumer inventory A-15359 includes all search hits. Migrated SessionRequest validation/pass-through plus shared/wire, LaunchRequest/SpawnRequest, Sessions host selection/persistence/fresh resume/pool filtering, core assignRole/moveRole, explicit Claude/OpenCode launch builders and spoke launch schema. Existing CLI/web/nvim/setup callers omit host and keep local behavior; protocol dispatch delegates to the shared SessionRequest parser. Handover adapter calls core moveRole; storage schema/readers unchanged. New frame regression preserves previous no-host wire shape. C1 red: true !== false; C2 red: inaccessible cwd instead of role refusal; C3 red: assignment succeeded; C4 red: launch succeeded without reaching remote spawn. Focused regressions now green; validation in progress.

### impl-1553 · 2026-11-01T20:48:28.084Z

Rule 16 clause exception: Coordinator and Aide placement is a hub invariant the roles never act on.
Documented in session help (hub/src/cli/usage/session.ts), hub/README.md, docs/agents/session-permissions.md and the existing Host skill sentence (.agents/skills/implement/SKILL.md).
Decision: coord’s decision, 2026-11-01 20:49Z, in answer to the clause-exception question (decision message ec27f792-ee40-484d-9bc6-3e9f32298cad). Do not compact the clauses. A later item that lets a role choose or request placement adds the clause wording.
Source-review fix: independently updated fixtures/cli-usage/commands.json SESSION_USAGE expected block, retaining full assertions. Local macOS/Node v24.21.0: cli-usage-compatibility.test.ts failed before the change (complete-export deep-equality mismatch on the new sentence), then 1/1 passed; cli-help.test.ts 5/5 passed, including complete help and child session help. No queued verification run yet.

### rev-35 · 2026-11-01T20:48:52.958Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1553-source-1
commit: 8b3a482446ef6b9299eca030e9f362dfd574727c
scope: full
findings: [{"severity":"medium","text":"SESSION_USAGE expected bytes omit the new local-only sentence, so the unchanged complete-export deep comparison and frozen child-help consumer mismatch the shipped help.","file":"hub/test/fixtures/cli-usage/commands.json","line":26},{"severity":"low","text":"Coordinator and Aide clauses (Aide line290) omit the new local-only placement policy; rule16 requires matching documentation or explicit Coordinator exception.","file":"hub/src/roles/default-roles.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":1}

Historical full source pass at 8b3a4824: medium frozen SESSION_USAGE consumer mismatch at commands.json:26; low matching role-clause policy documentation at default-roles.ts:61,290. Full source evidence A-15400: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15400-t-1553-full-source-review-at-8b3a4824.md. No runtime criterion failed solely for an unexecuted suite, so failed marks omitted. Initial attempt was rejected by argument validation because failed:[] is not a nonempty marking list; this corrects that argument only. New-head request 7fd84078 is being reviewed separately; no test/browser execution by Reviewer.

### rev-35 · 2026-11-01T20:49:19.794Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1553-source-2
commit: 7fd84078d4bc9acac68ea564f4b4e03ef5d9994a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, Standards/Spec no findings. A-15400 medium fixed by independent SESSION_USAGE fixture migration with complete assertions unchanged. Clause low resolved by explicit Coordinator decision ec27f792-ee40-484d-9bc6-3e9f32298cad and the required item comment; exception confirmed in topic history. Placement implementation unchanged from reviewed 8b3a4824: shared local-role policy, early Host admission, persisted/fresh-resume Host, same-Host pool filtering, assignment/handover checks and wire/spoke/adapter propagation. C6 source verified; C1–C5 remain runtime-unverified pending exact-head mode-free verify and named placement10, unchanged C5 controls13/12/2 and help outcomes. C4 is fake-adapter selected Host spawn evidence, not native Codex migration coverage. Reviewer executed no test/browser. A-15401: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15401-t-1553-refreshed-source-clear-at-7fd84078.md.

Criteria: C6 verified.

### impl-1553 · 2026-11-01T21:02:20.957Z

Verification 74f9fa59 at 7fd84078d failed (A-15405, droplet linux x64/Node v24.21.0, lifetime 648 s, $0.0450). T0/T1 completed exit 0; all-T2 fallback exited 1 on two launch-admission measurement assertions. Web/T4 have no completed evidence; remaining T3 is deferred to merge batch. Actual assertion: two ['session.launch','resumed',300] rows vs expected one. Reproduced locally: unedited launch-admission.test.ts 14 pass/2 fail. Cause: new validateLaunchHost({...request,role}) spread eagerly evaluated cwd a second time, adding an extra measured 300 ms scope. Replaced it with checkRoleHost(role, this.#hostForLaunch(request).name), which reads only placement. Unedited launch-admission now 16/16 and placement 10/10 pass locally; typecheck exit 0. No debug instrumentation or test assertion changes; no dev merge. Fresh source review required before the next verify.

### rev-35 · 2026-11-01T21:02:28.680Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1553-evidence-1
commit: 7fd84078d4bc9acac68ea564f4b4e03ef5d9994a
scope: evidence
findings: [{"severity":"medium","text":"The added {...request,role} placement-validation spread eagerly reads cwd again, regressing both retained launch-admission resumed-scope assertions: actual two 300ms rows versus expected one on their synthetic clock.","file":"hub/src/adapters/sessions.ts","line":1069}]
finding_counts: {"high":0,"medium":1,"low":0}

A-15405 actual failure: actual [['session.launch','resumed',300],['session.launch','resumed',300]], expected [['session.launch','resumed',300]], in launch-admission.test.ts:298 and :330. Medium sessions.ts:1069: broad placement-validation spread adds eager cwd reads; narrow validation to required placement fields and retain full assertions. Exact-head run74f9fa59 exit1, T0/T1 pass, T2 failed; T3 deferred, mapped T4/Web unexecuted, browser null. Linux x64 droplet Node24.21.0/Neovim0.12.5, cached null; report-only advisories separate. C4 failed; no additional criteria verified by this failed run. A-15406 contains failure excerpts, provenance and limits: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15406-t-1553-failed-verification-evidence-at-7fd84078.md. Reviewer executed no tests/browser. Fresh fixed-head source review required before verification.

Criteria: C4 failed (Previous no-host launch behavior regresses: both retained cwd/stat admission-scope assertions fail with an extra 300ms resumed record.).

### rev-35 · 2026-11-01T21:03:01.282Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1553-source-3
commit: c5bd1b488400519fec356d02c2d02d641ebcb88d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear, no findings. Sole runtime delta uses shared checkRoleHost with resolved role and selected Host name, avoiding broad request copying/eager cwd reads at sessions.ts:1069. Registry/role checks still precede effects. A-15406 finding addressed; both launch-admission assertions and all three C5 preservation files remain unchanged. Prior source conclusions and explicit Coordinator clause exception retained. C6 source reverified at this head; C1–C5 await new exact-head mode-free verify with launch-admission16, placement10, C5 controls13/12/2 and help outcomes. Old run74f9fa59/A-15405 remains failed; local targeted16/16+10 reported by Implementer is not a new suite receipt. Reviewer ran no test/browser. A-15407: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15407-t-1553-source-clear-after-admission-fix-at-c5bd1b48.md.

Criteria: C6 verified.

### rev-35 · 2026-11-01T21:19:53.725Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1553-final-1
commit: c5bd1b488400519fec356d02c2d02d641ebcb88d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, no findings. Exact reviewed head confirmed by branch tip, hub verify and A-15416 provenance. Run de58fca1 exit0,4594 passes,zero fail/cancel/skip/todo; T0/T1/all fallback T2/one mapped T4 base/Web complete; T3 deferred, T4 repetitions skipped. Streamed ordinary named pass facts: placement10, launch-admission16 (both formerly failed scope cases now pass at12922/12930), unedited C5 role-launch13/roles-launch-permissions12/session-launch2, frozen usage1/native CLI help5. C1–C5 runtime established, C6 source retained; all C1–C6 verified. Clause exception remains authorized; A-15405 remains failed history. Droplet Linux x64 6.8.0-142-generic Node24.21.0 Neovim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4, cached null; advisories report-only. A-15417 records identities, source-test equality and provenance: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15417-t-1553-final-evidence-clear-at-c5bd1b48.md. C4 recording fake-adapter spawn is not native Codex coverage. Reviewer ran no test/browser; after-stage QA and merge batch separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.
