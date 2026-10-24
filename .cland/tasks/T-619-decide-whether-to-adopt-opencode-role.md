---
id: T-619
kind: task
title: Decide whether to adopt OpenCode role instructions, after T-536's forced-compaction comparison
state: open
status: review
size: S
criterion_seq: 2
labels:
  - opencode
  - ready-for-agent
assignee: null
parent: E-1216
blocked_by: []
topic: topic-994
branch: t/T-619-decide-whether-to-adopt-opencode-role
created: 2026-10-16T15:53:55.297Z
updated: 2026-10-24T19:56:59.838Z
---

## Summary

T-536 adds the OpenCode role-instructions option, default off, and measures it in a forced-compaction comparison. Whether to turn it on for cland's roles is the human's decision once the results are in (impl-536's request, 2026-10-16).

## Acceptance criteria

- [x] C1. The human's decision on the OpenCode role-instructions option is recorded, citing T-536's comparison artifact, and the default is set to match.
  - done: coord · 2026-10-24T18:44:49.282Z
  - verified: rev-32 [reviewer] · run rev-20261024-619-source4 · 2026-10-24T19:56:59.838Z · commit c3cfec72ff2f29b3df5b8dba64f3373a2c8e3d34
- [x] C2. The OpenCode adapter sends the role clause as an instruction entry by default, CLAND_OPENCODE_ROLE_INSTRUCTIONS=0 (or roleInstructions: false) opts out, the message fallback on a failed instruction route stays, and docs, doctor text and tests say the new default (test).
  - done: impl-619b · 2026-10-24T19:55:26.547Z

## Comments

### coord · 2026-10-24T18:44:43.050Z

Human decision 2026-10-24 18:42Z (ask 5ae04189, General): 'Turn it on by default now' — OpenCode role instructions become the default for cland's roles, citing T-536's comparison A-4114 (inconclusive; one successful readiness-controlled pair on the instruction path). Coord had recommended re-measuring first; the human chose to turn it on now.

### impl-619 · 2026-10-24T18:53:52.287Z

C2 implementation at head 795c512aa431ea69869b3ad11318a112d4cc2145.

Shared-contract consumer inventory (rule 20): production is hub/src/adapters/opencode.ts (default true) and hub/src/adapters/index.ts (CLAND_OPENCODE_ROLE_INSTRUCTIONS !== '0'). Test/fixture consumers: hub/test/fakes/scripted-opencode.ts now follows the production default unless a test passes roleInstructions; hub/test/opencode-adapter.test.ts adds the default/opt-out/fallback contract and opts the message-path contracts out through messagePath(); hub/test/opencode-native.test.ts runs the default route; hub/test/scenarios/crew-launch.test.ts reads the durable cland-role entry from the fake session record instead of a clause prompt; hub/test/durations.json carries the renamed test identities. Docs updated: hub/README.md and the two docs/agents/tests/ pages. No command --help or doctor text names this option. No shipped skill or QA fixture consumes roleInstructions; qa/briefs/E-424.md records the pre-decision state of a closed epic and is historical, not a live consumer.

Evidence at 795c512aa431ea69869b3ad11318a112d4cc2145 (macOS, local, targeted single-file runs one at a time, no suite): hub typecheck exit 0; node --test hub/test/opencode-adapter.test.ts 17/17; node --test hub/test/opencode-native.test.ts 30/30; node --test hub/test/scenarios/crew-launch.test.ts 1/1; npm run test:lint exit 0 (test lint is report-only with 133 existing findings, 0 refusals). These are targeted runs, not a suite pass.

### rev-32 · 2026-10-24T18:56:54.651Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-619-source
commit: 795c512aa431ea69869b3ad11318a112d4cc2145
scope: full
findings: [{"severity":"medium","text":"M1: The OpenCode pool wait still treats first-turn usage > 0 as the startup receipt. The keep_context=false launch has no brief (line 65); default role-instruction delivery returns without a prompt/turn, so the expected startup usage is no longer guaranteed. Unrelated later usage is not proof that this clause was installed. Preserve the pool handoff assertions and observe the exact instruction/delivery readiness receipt, or explicitly opt out for an intentional legacy-path contract.","file":"hub/test/session-native-lifecycle.test.ts","line":133},{"severity":"medium","text":"M2: The rule-20 inventory names direct option references but omits native launch/reuse consumers such as session-native-lifecycle.test.ts, session-resume-lifecycle.test.ts and session-stop-races.test.ts, and gives no persisted-session/instruction or older-endpoint disposition. Expand the search across production callers, startup probes, all test tiers and QA/skills; list migrations or reasons unaffected and retain the existing failed-route compatibility proof.","file":".cland/tasks/T-619-decide-whether-to-adopt-opencode-role.md"}]
finding_counts: {"high":0,"medium":2,"low":0}

A-11336 records the full Standards/Spec source review. M1 medium: session-native-lifecycle.test.ts:133–136 still uses first-turn usage as OpenCode startup proof although keep_context=false has no brief and the default instruction route creates no role-clause turn; migrate the exact readiness receipt while retaining final pool assertions. This is source-established, not a reviewer-reproduced failure; incidental later usage cannot supply the exact clause receipt. M2 medium: the item inventory omits native lifecycle consumers and saved-session/older-endpoint dispositions required by rule 20. Constructor/env default and explicit opt-out match the recorded human decision; fallback PUT/delete-confirm code is unchanged, and docs match. C1 source-supported, C2 not clear; no configured suite receipt claimed. Preserve original local outputs/exits/native timings and the new opted-out duration sample provenance, without rerunning for transcription. Revised head requires fresh source review before verification.

Criteria: C2 failed (Default instruction delivery leaves an unmigrated T3 pool-startup receipt; rule-20 consumer inventory needs completion.).

### coord · 2026-10-24T19:04:18.268Z

Paused 2026-10-24 19:02Z: default:opencode hit provider.quota at 19:01Z; human chose to wait (ask 7b39be29) and will say when the limit has passed, then coord runs cland account clear default:opencode. Open: rev-32's not-clear source review at 795c512a (M1 pooled startup receipt in session-native-lifecycle.test.ts:133-136; M2 rule-20 consumer inventory), A-11336. E-1216 stage 1 closes after T-619 lands.

### impl-619b · 2026-10-24T19:37:51.931Z

C2 rule-20 consumer inventory at head a23a2ae4 (the default-on contract: the adapter's role-instruction route, the durable `cland-role` entry, and the message fallback).

**Production callers**
- `hub/src/adapters/opencode.ts` `inject` is the only writer of the clause route; `roleInstructions` defaults true and `false` bypasses the route. Unchanged.
- `hub/src/adapters/index.ts` reads the env default `CLAND_OPENCODE_ROLE_INSTRUCTIONS !== '0'`. Unchanged.
- `hub/src/adapters/opencode/client.ts` `roleInstruction`/`clearRoleInstruction`: **migrated** — a 404 from the cleanup DELETE confirms no entry remains and permits the message fallback; any other deletion failure still leaves delivery unconfirmed for retry.
- `hub/src/adapters/sessions.ts` consumes injection errors through the existing unconfirmed-retry path; clause assembly in `hub/src/hub/core.ts` is unchanged. No envelope, field or persisted-record shape moved.

**Startup and release probes**
- `hub/bin/check-opencode.ts` and `hub/src/doctor/opencode-contract.ts` compare only the non-experimental operations in `OPERATIONS`; the experimental instructions route is not in that document, so it stays out of the probe. A server without the route is covered by the adapter test's `old endpoint` mode instead.
- `hub/test/startup-smoke.test.ts`, `startup-budget.test.ts`, `startup-diagnostic.test.ts`, `project-probes.test.ts`, `doctor-harness-probe.test.ts`: no OpenCode role launch and no clause-delivery assertion; unaffected.

**Tests by tier**
- T1 `opencode-check.test.ts`: no clause assertion; unaffected.
- T2 `opencode-native.test.ts`: the scripted fixture follows the production default (cf942a64); its installed/replace/revoke, failed-PUT and unconfirmed-cleanup contracts remain, and tests that need the prompt path opt out explicitly. No test relies on a clause turn.
- T2 `opencode-launch-policy.test.ts`: its in-process HTTP server answers the experimental route with an empty 200 and the test asserts native policy only; unaffected.
- T3 `opencode-adapter.test.ts`: migrated in cf942a64 (default/opt-out/fallback), extended at a23a2ae4 with `old endpoint` (PUT and DELETE 404 → prompt fallback plus `opencode-instructions-fallback`).
- T3 `scenarios/crew-launch.test.ts`: migrated in cf942a64 to read the durable `cland-role` entry instead of the first prompt.
- T3 `session-native-lifecycle.test.ts`: M1 migrated in 020efecd — the pool wait observes the durable `cland-role` entry and keeps the idle, released-claim and every pool hand-off assertion.
- T3 `session-resume-lifecycle.test.ts`: launches OpenCode for recovered PID/spoke/reap assertions with idle waits; asserts no OpenCode clause or prompt; unaffected.
- T3 `session-stop-races.test.ts`: OpenCode launch, idle and post-merge stop assertions; the role-revoke check reads the hub message, not native delivery; unaffected.
- T3 `approval-restart.test.ts`, `launch-recovery.test.ts`, `pid-identity.test.ts`, `termination-ownership.test.ts`, `orphan-servers.test.ts`, T4 `orphan-servers-perf.test.ts`, T2 `models.test.ts`: launch the fake OpenCode binary for process lifecycle; the fake supports the route and none assert clause or prompt content; unaffected.

**QA briefs and skills**
- `qa/briefs/E-424.md` R3 records the pre-decision state of a closed epic and says QA does not rerun those experiments; historical, not a live consumer.
- No shipped skill or QA fixture references the option (`skills/` holds templates only); no CLI `--help` or doctor text names it.

**Saved sessions with an installed instruction**
- Default on: the next clause delivery (launch or resumed hello) PUTs `cland-role`, replacing assignment or revocation, so a saved session cannot keep a stale role.
- Opted out: the adapter does not touch the route, so an entry a previous default-on run installed stays. The prompt clause still arrives and the next default-on launch replaces the entry; `hub/README.md` now states this.

**Older hub or endpoint without the instruction route**
- No new wire field or message shape: the role clause is the existing role message, so an older hub/spoke still exchanges it.
- An older OpenCode server without the experimental route: PUT 404 → DELETE 404 now confirms absence → prompt fallback; the `old endpoint` mode is the client regression at the previous wire shape. A non-404 deletion failure still blocks fallback.

Local evidence for the new code (targeted single-file runs, no suite) is added when the local test slot frees.

### rev-32 · 2026-10-24T19:46:33.948Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-619-source2
commit: a23a2ae43dcd5e014b5b0e18212e523847666d80
scope: full
findings: [{"severity":"medium","text":"M3: DELETE 404 is accepted as confirmed removal even when it means the experimental route is unavailable, which does not establish that a previously installed cland-role entry is absent. With the changed fake, install a role first and then enable absent-instructions: PUT/DELETE return 404 while the saved JSON retains the old role, but inject now acknowledges the replacement/revocation prompt. Add the retained-entry 404 control and keep delivery unconfirmed until actual absence is established; the empty old-endpoint case alone does not prove that invariant.","file":"hub/src/adapters/opencode/client.ts","line":96}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11367 carries the original full source review and audits both correction commits. M1 exact saved instruction receipt and unchanged pool assertions are addressed; M2 expanded inventory/dispositions are addressed. New M3 medium at opencode/client.ts:96: blanket DELETE-404 success is not confirmed absence when the experimental route is unavailable. The changed fake returns that 404 before deleting existing session.instructions; installing a role before enabling absent-instructions leaves the old entry while replacement/revocation prompt fallback is acknowledged. New old-endpoint row starts empty and misses this control. Preserve the original no-stale-role fallback invariant; add the retained-entry failure control and require actual absence before confirmation. C1 source-supported; C2 failed. Static-only review per Coordinator 7d251897: revised-head targeted adapter/lifecycle runs pending local stage slot, typecheck/lint claims not runtime coverage. No tests/probes run by reviewer. Fresh source review required after correction.

Criteria: C2 failed (DELETE route-level 404 does not prove a prior saved role instruction is absent; fallback can acknowledge with stale role retained.).

### impl-619b · 2026-10-24T19:51:19.829Z

M3 resolution at 82ad0c3d (fixes A-11367's retained-entry finding).

The older-endpoint compatibility path is now narrow: `clearRoleInstruction` is strict again, and the adapter permits the prompt fallback on a cleanup 404 only when this adapter created the native session and never wrote an entry to it — no saved entry can exist there. A resumed session, or one that ever accepted a successful PUT, keeps delivery unconfirmed when the route cannot be cleared; the no-stale-role invariant is unchanged.

New control in `hub/test/opencode-adapter.test.ts`: "a saved cland-role entry is not treated as removed when the instruction route disappears" installs an entry, removes the route (PUT and DELETE 404, the fake keeps the session JSON entry), and asserts `inject-unconfirmed`, the retained Implementer entry, no Reviewer prompt fallback and no `opencode-instructions-fallback`; after the route returns, a turn's retry replaces the entry with Reviewer. The fresh-session `old endpoint` mode stays as the separately justified compatibility case. `hub/README.md` and the adapter test doc page state both cases.

Evidence at 82ad0c3d: hub typecheck exit 0; npm run test:lint exit 0 (report-only, 133 findings, 0 refusals). Targeted local runs still pending the Coordinator's stage slot; source review is requested at this head first.

### rev-32 · 2026-10-24T19:52:41.699Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261024-619-source3
commit: 82ad0c3d1e7479389487df8da9947e3b18e3b7ac
scope: full
findings: [{"severity":"medium","text":"M3 remains for an unacknowledged first PUT: #roleEntries is marked only after roleInstruction resolves. A fresh session can persist its first entry then lose/time out the PUT reply; cleanup returning route-level 404 leaves freshSessions=true and roleEntries=false, so fallback is falsely acknowledged while an entry may remain. Track possible writes before awaiting them, distinguish proven no-write refusal from ambiguous completion, and add a write-then-lost-response/DELETE-404 control while retaining fresh never-written old-endpoint compatibility.","file":"hub/src/adapters/opencode.ts","line":316}]
finding_counts: {"high":0,"medium":1,"low":0}

A-11373 carries the full corrected-design audit. M1/M2 remain resolved; strict DELETE and the successful-PUT/retained-entry regression address that M3 form. M3 remains at opencode.ts:316: possible writes are tracked only after PUT acknowledgement. A fresh first PUT may save its entry then lose/time out the response; cleanup DELETE404 sees freshSessions=true/roleEntries=false and acknowledges fallback while the entry may remain. The PUT failure outcome is discarded. Add write-then-lost-response followed by unavailable DELETE control; distinguish proven no-write refusal from ambiguous completed I/O and retain uncertainty until confirmed removal. Keep genuine fresh old-endpoint compatibility. C2 failed; C1 source-supported. Revised-head local targeted runs remain pending Coordinator stage slot, so no configured runtime clearance or reviewer-run tests claimed. Prior a23a2ae4 review was not clear, though M1/M2 were resolved. Corrected head requires fresh source review before verification.

Criteria: C2 failed (A first PUT can persist its entry but lose the reply before roleEntries is marked; DELETE 404 then falsely confirms safe fallback.).

### impl-619b · 2026-10-24T19:55:21.028Z

M3 variant resolution at c3cfec72 (pushes 82ad0c3d + c3cfec72).

The adapter no longer infers "no write" from a failed PUT except where the server proves it: a PUT failure other than an HTTP 404 marks the session as possibly carrying an entry, so a write saved before a lost reply stays unconfirmed when cleanup hits a route-level 404. A PUT the server refused with 404 proves no write, so the fresh-never-written old-endpoint fallback is unchanged.

New control in `hub/test/opencode-adapter.test.ts`: "a lost instruction write is not treated as absent when cleanup sees no route". The fake saves the entry and never answers the PUT (`lose-instructions-response`), while GET/DELETE 404; the test asserts `inject-unconfirmed`, the saved Implementer entry, no prompt fallback and no fallback log, then restores the route and asserts an `injected` receipt for the same message id and the confirmed entry. The retained-entry and fresh-endpoint controls from 82ad0c3d stay.

Evidence at c3cfec72: hub typecheck exit 0; npm run test:lint exit 0 (report-only, 133 findings, 0 refusals). Targeted local runs still pending the Coordinator's stage slot; fresh source review requested at this head first.

### rev-32 · 2026-10-24T19:56:59.838Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261024-619-source4
commit: c3cfec72ff2f29b3df5b8dba64f3373a2c8e3d34
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-11375 carries the full Standards/Spec review and prior M1/M2/M3 resolutions. No remaining source findings. Non-404 failed PUT now marks possible entry state before cleanup, so persisted/lost-response writes cannot take the known-fresh/never-written cleanup404 exception. Existing uncertainty survives subsequent PUT404; strict DELETE remains; fresh old-endpoint fallback is preserved. Added native control persists before withholding reply and requires exact same-id injected receipt after recovery, alongside no fallback/retained-entry assertions. Default/env0/explicitfalse, pool durable instruction receipt, inventory and docs remain correct. C1 verified from recorded human decision/A4114 and matching defaults; C2 runtime-dependent unverified. Static-only pass per Coordinator during stage slot: changed adapter/lifecycle targeted tests not yet run, typecheck/lint reported separately; no runtime/full-T3/T4/QA claim. After local capacity release run targeted files sequentially, preserve original raw evidence, then one unchanged-head ordinary mode-free verify. Any changed head needs fresh source review.

Criteria: C1 verified.
