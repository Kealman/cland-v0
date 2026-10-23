---
id: T-1175
kind: task
title: Notifications on the phone through a service worker
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1166
  - T-1128
  - T-1142
topic: topic-917
branch: t/T-1175-notifications-on-the-phone-through-a
created: 2026-10-23T07:00:04.656Z
updated: 2026-10-23T20:56:32.531Z
closed: 2026-10-23T20:56:32.531Z
---

## Summary

On a phone, notifications go through a service worker: the subscription button in More asks for the permission and registers the worker on a tap, the "needs you" and "finished" switches live in More, and T-1128's rules raise notifications through the worker, whose click focuses the app on the row.

## Parent

E-419 (§3.6 notifications on the phone; choices "The subscription button" and "The service worker"; the second part of tracer step 6). Reuses T-1128's rules and T-1142's switches.

## What to build

- **The worker** is served at the root scope and has no fetch handler, so it never serves a stale shell. It handles a notification click: it focuses an open client and sends it the row to open, or opens the app at that inbox row when none is open.
- **More** holds T-1142's two switches, per browser, and the subscription button. A tap on the button asks for the notification permission and registers the worker, as iOS requires a tap; it creates no Web Push subscription (push with the page closed is 0.2.x). A denied permission turns both switches off and the button's tooltip says why. At phone width the switches live in More, not in the profile block.
- **Delivery.** T-1128's rules decide (now layer only, never while the page is visible and focused, one per row as its tag, naming the session, the item and what waits); with an active worker registration the notification goes through `showNotification`, otherwise through the page's `Notification` as on the desktop. A waiting plan and a TUI-bound approval are inbox rows and notify like any row.
- **The harness** gains a context option that allows service workers; the default stays blocked. The suite stubs the permission and `showNotification`; a real notification is QA's demo with the full Chromium build.

## Acceptance criteria

- [x] C1. At 390x844 More holds the "needs you" and "finished" switches and the subscription button, and a tap on the button requests the permission and registers the worker without creating a push subscription (Web test).
  - done: impl-1175 · 2026-10-23T20:32:12.236Z
  - verified: rev-23 [reviewer] · run rev-20261023-1175-final · 2026-10-23T20:51:08.470Z · commit be2a3f9b337303bc55dbbd324dfa463e07d864e1
- [x] C2. With the worker registered and `showNotification` stubbed, a new ask while the page is hidden raises one notification through the worker naming the session, the item and the question (Web test).
  - done: impl-1175 · 2026-10-23T20:35:38.872Z
  - verified: rev-23 [reviewer] · run rev-20261023-1175-final · 2026-10-23T20:51:08.470Z · commit be2a3f9b337303bc55dbbd324dfa463e07d864e1
- [x] C3. A waiting plan and a fake Claude Code approval entering the inbox each raise one notification through the worker (Web test).
  - done: impl-1175 · 2026-10-23T20:32:12.687Z
  - verified: rev-23 [reviewer] · run rev-20261023-1175-final · 2026-10-23T20:51:08.470Z · commit be2a3f9b337303bc55dbbd324dfa463e07d864e1
- [x] C4. The worker has no fetch handler, and its click handler focuses an open client and sends it the row, or opens the app at the inbox row when none is open (test).
  - done: impl-1175 · 2026-10-23T20:32:12.963Z
  - verified: rev-23 [reviewer] · run rev-20261023-1175-final · 2026-10-23T20:51:08.470Z · commit be2a3f9b337303bc55dbbd324dfa463e07d864e1
- [x] C5. A denied permission turns both switches off and the subscription button's tooltip says why (Web test).
  - done: impl-1175 · 2026-10-23T20:32:13.139Z
  - verified: rev-23 [reviewer] · run rev-20261023-1175-final · 2026-10-23T20:51:08.471Z · commit be2a3f9b337303bc55dbbd324dfa463e07d864e1

## Comments

### impl-1175 · 2026-10-23T20:28:40.721Z

Implemented worker click/no-fetch contract, More subscription and shared switches, active-worker delivery with page fallback, encoded cold-entry row navigation, and edge MIME/root-scope headers. Vertical red→green receipts: missing worker script, missing More controls (0 !== 2), missing worker showNotification receipt, missing root header (undefined !== '/'). New sealed Web tests cover ask/plan/TUI approval and denial; required targeted regression set now running. Docs and implement skill updated with one-line CHANGES provenance; role clauses unchanged.

### rev-23 · 2026-10-23T20:35:09.200Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1175-source
commit: 9ab39dedceb9cbc3169174a5b39da4ca0eebcde9
scope: full
findings: [{"severity":"medium","text":"M1: getRegistration await introduces stale eligibility; recheck current preferences, permission, visibility and focus before worker/page delivery, with held-lookup regressions.","file":"web/src/browser-notifications.ts","line":16}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1175 full source review

Head 9ab39dedceb9cbc3169174a5b39da4ca0eebcde9; tree 200710c64b01d628262e0fc8f641a91c07a6672d. Fixed base/parent ea71c86ab845377e39a85df3267d585619e673a9; branch t/T-1175-notifications-on-the-phone-through-a. Run rev-20261023-1175-source. Not clear: M1 medium, C2 failed; other runtime criteria pending. Full audit complete, no other findings. Crew disables Reviewer subagents; both review axes performed in this session.

## Standards

No independent findings. Root notification-only worker has no fetch/cache/push handler. Edge serves confined built JavaScript with Service-Worker-Allowed:/ and existing no-cache/ETag/CSP; no authority or dependency changes. Registration occurs after a direct tap permission call, no asynchronous work before prompt. More reuses per-browser switches; desktop Profile remains separate by width. Denial refreshes shared preferences, persists both off and supplies blocked/settings tooltip; repeated denied tap does not prompt. Activation and redundant state are observed, no PushManager subscription.

Worker target validation restricts area to Inbox/Items and string id; notificationclick closes notification and extends lifecycle with waitUntil, focuses/messages an existing client or opens same-origin encoded query URL. Page validates message shape, cold entry waits for live Inbox, consumes once and restores root. Phone page/More cleanup and existing synchronous exact-row focus path retained; Items target uses existing item resolution/navigation serial guard.

New T1 VM contract exercises the actual worker through fake client boundaries, no-fetch, focus/message and encoded openWindow; file read/VM need no browser/process. T2 edge checks retain headers/revalidation and add worker MIME/scope/CSP/built file. New sealed Web context opts into workers; default remains blocked. Real registration/activation, stub permission/showNotification/PushManager and fake public-frame rows; no new startDaemon/spawnSpoke/cland/sleep call or wall-clock wait in new cases. Exact activation, notification and row-focus observers are bounded/armed before triggers. Existing fixture owns context/worker/browser teardown. More-list consumer migrated in same item;44px bounds retained. Docs/hub README/implement skill pointer and CHANGES provenance match; diff check clean. No local tests/probes run by Reviewer during stress window.

## Spec

M1 medium — web/src/browser-notifications.ts:16. shouldNotify is checked in receive before asynchronous getRegistration('/'); after that await only closed is rechecked. A page may become visible+focused or its relevant switch be turned off during lookup, yet either showNotification or page Notification still fires. This violates the inherited delivery suppression rules while introducing the asynchronous adapter. Re-evaluate current preferences, permission, visibility and focus immediately after lookup before either delivery path. Add public Web regression holding registration lookup, receiving eligible hidden ask, then focusing page or disabling switch before release, asserting no notification. Implementer accepted and is adding regressions; no Reviewer runtime reproduction claimed.

C1 source otherwise present:phone More shared switches, direct permission/root registration and no push subscription; profile switches absent on phone and reload persistence checked.
C2 worker title/body/tag/data for exact hidden ask and one-per-row seen identities present, but M1 blocks delivery eligibility.
C3 plan and TUI-bound Claude approval use existing pure notification rules/current layer and worker path, no answer controls exposed; exact titles/body/tags tested.
C4 notification-only actual worker VM contract covers both client branches and no fetch handler; source URL encoding and page message/cold-entry exact row routing present.
C5 denied permission clears both persisted switches and tooltip, no registration/push or repeated prompt; tested.

A-10219 summary and A-10221 original logs independently read. Required targeted run was NOT green:105 reported tests,102 pass/3 fail including parent, actual unchanged clock.pauseAt 'Cannot fast-forward to the past' at phone-disconnected:121 and stale More-list expectation. Coordinator 5e56cf46 explicitly leaves shared clock fix to T-1183 and authorizes once-alone retry; phone-disconnected is unchanged. Following consumer migration, focused28/28 and disconnected retry3/3 pass separately; final new phone file4/4 passes, no fail/cancel/skip, clean browser censuses. Full typecheck/static/tier checks reported passing. Test-lint --help selected0files and is not lint evidence. New passing locals below4s; no allowance trigger. Local Darwin arm64 Node24.21.0 isolated pinned Headless Shell/source-as-committed working tree, not configured Linux/current-head suite evidence; no artificial aggregate pass claim. Preserve original command/exit/source/timing attribution without transcription reruns.

Complete finding set M1 only. Correct, commit/push, re-mark C2 and request fresh source review before verification. No unsolicited post-review dev merge. Reviewer read-only Git/files/log/hub; no tests, probes, live browser, GUI, edits, merge or delegation. Real notification demonstration remains affected after-stage QA; no per-item brief/qaCriteria.
Standards: 0 findings. Spec: 1 medium (M1).

Criteria: C2 failed (Notification delivery uses eligibility captured before asynchronous worker lookup, allowing delivery after focus or switch changes should suppress it.).

### rev-23 · 2026-10-23T20:36:32.848Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1175-source-2
commit: be2a3f9b337303bc55dbbd324dfa463e07d864e1
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1175 corrected full source review

Head be2a3f9b337303bc55dbbd324dfa463e07d864e1; tree 9c0f19d87158ee05e520899e752107f2f7025df1. Parent/fixed point 9ab39dedceb9cbc3169174a5b39da4ca0eebcde9; branch t/T-1175-notifications-on-the-phone-through-a. Run rev-20261023-1175-source-2. Clear; findings []; all C1–C5 runtime pending. Full source A-10223 carries forward.

## Standards

No findings. Three-file focused fix, no dev merge. Shared shouldNotify is re-evaluated after getRegistration and immediately before branching to worker/page delivery, using current notificationSnapshot, permission, visibility and focus, plus lifetime closed guard. No new timer or policy duplication. Existing seen identities and snapshot suppression remain intact. Test seam documentation adds the held lookup boundary; no test bounds/assertions weakened, diff check clean.

## Spec

M1 resolved in source. Two public Web cases arm held registration lookup before an exact fake ask, wait for lookup-held receipt, then either set current visible+focused or turn Needs you off with checked-false receipt. They release the real getRegistration result (or explicitly absent registration for page fallback), then read both worker/page delivery counters and require zero. This covers both affected paths without replaying a mutation. Stub state supports current conditions; original activation/delivery/denial/click cases retained. shouldNotify now runs with current facts after the sole delivery lookup await; worker/page calls follow synchronously.

A-10224 attributes red/green to source-as-committed local Darwin arm64 Node24.21.0 isolated pinned Headless Shell: old worker-focus red {worker:1,page:0}, old switch-off fallback red {worker:0,page:1}; corrected phone6/6 and desktop/hub rules/edge/auth50/50, full typecheck reported green. A-10224 is a summary, not raw command stdout/exit metadata; no stronger evidence claim. Preserve original output/exits/head/timings as durable artifacts, without rerunning for transcription. Earlier A-10219/21 failed105 run, focused28/28 and authorized disconnected3/3 retry retain separate original provenance. New passing local identities reported below prescribed80% thresholds; no allowance yet.

Proceed with mode-free verify at exact be2a3f9b, then final C1–C5 and actual passing new-identity timing audit. Source review alone establishes no runtime criterion. No unsolicited post-review dev merge. Reviewer read-only Git/files/log/hub; no tests, probes, live browser, GUI, edits, merge or delegation. Real notifications remain affected after-stage QA; no per-item brief/qaCriteria.

Standards: 0 findings. Spec: 0 findings.

### rev-23 · 2026-10-23T20:51:08.471Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1175-final
commit: be2a3f9b337303bc55dbbd324dfa463e07d864e1
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1175 final evidence review

Head be2a3f9b337303bc55dbbd324dfa463e07d864e1; complete Git tree 9c0f19d87158ee05e520899e752107f2f7025df1. Branch t/T-1175-notifications-on-the-phone-through-a. Run rev-20261023-1175-final. Clear, findings []; C1–C5 verified. Source clearance A-10226 / rev-20261023-1175-source-2 carries forward without source changes.

Standards: no findings. Spec: no findings. M1 remains resolved by checking current eligibility after registration lookup and before either delivery path.

Configured receipt b623e369-777b-4b12-9311-98f05386a322 / A-10229 independently audited: exit 0, 2779 ordinary test finishes and 414 file finishes all pass, zero failure/skip/cancel. Actual T1 (132 files), fallback all T2 across hub and Neovim (239 files), and complete Web (43 files) ran. Separately, actual load-gate records establish five additional test/file passes for the new worker T1 identity; generic repetition headers are not used as proof.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-2ca4fcb6, Node v24.21.0, Neovim v0.12.5, workers 2 / Web runner 4; lifetime 585 s, cost $0.0406. Actual phase walls 49.11 s / 308.63 s / 136.24 s. Duration sums and projections are not phase wall time. Full host npm run check output is preserved in A-10229. Remote check reuse labels candidate tree 4690d402f3191d5a54cf669d9da4153b03181e22, independently confirmed to be a Git tree object, not a different commit; the droplet did not repeat T0. The complete task Git tree is separately recorded above.

C1: passing phone More case establishes shared per-browser switches, direct-tap permission request and root worker registration without Push subscription; desktop placement and 44px assertions retained.
C2: passing hidden-ask worker case establishes exact title/body/tag/target and once-only delivery. Both held-lookup regressions pass: focus suppresses worker delivery, and switch-off suppresses absent-registration page fallback.
C3: passing plan and fake Claude TUI approval case establishes one worker notification for each exact waiting row.
C4: actual-worker T1 contract establishes no fetch handler, focus/message of an existing client, and encoded exact-row openWindow without a client. Web case establishes app routing/focus for message and cold entry.
C5: passing denial case establishes both persisted switches off and explanatory button tooltip.

Actual new Web passing samples in A-10229, seconds: More 2.330964157; hidden ask/click 1.850722907; denied permission 1.067598134; plan/TUI approval 1.442578946; held focus 1.142314344; held switch-off fallback 1.207626689. All below the prescribed 4 s threshold. New worker T1 base 0.007110153 s; actual five load samples 0.006997785, 0.007138043, 0.007407169, 0.006593100, 0.007037770 s, all below 0.4 s. Prior passing local samples also below thresholds. No allowance required. Generic lint (132 findings in 59 files), duration and ratchet diagnostics remain report-only; one new file duration baseline is missing. Existing warning receipts are retained.

A-10228 original M1 logs are now durable and independently read: corrected phone 6/6 and regression 50/50, full typecheck/build, local Darwin arm64 Node24.21.0 isolated pinned Headless Shell. Those original commands ran on parent 9ab39ded plus the fix working-tree delta subsequently committed as be2a3f9b; their original command/exit/timing/source attribution is retained, with no transcription rerun. Earlier failed 105-test run and focused/authorized retry evidence remain separately attributed as in A-10223/26; no aggregate green claim for that failed run.

Lead's fresh read-only dev conflict check against ea71c86a returned the exact task tree and clean worktree, no merge/head mutation. Coordinator d0a19827-afde-4f3e-acd3-790c591119a1 in topic-917 supersedes the earlier shared-fix merge direction: final settlement stays at be2a3f9b; Coordinator checked clean combination with T-1183, new phone tests have no clock pairs, and merge queue will check combined T1 including its guard. No combined-tree runtime pass is claimed here.

T3/T4 were not run on this task occasion; configured T3 is deferred to periodic/integrated occasions and omitted from batch tiers. Real platform notification demonstration remains affected after-stage QA; no per-item QA brief/criteria is claimed satisfied. Reviewer performed read-only source/log/Git/hub review, no tests, probes, live browser, GUI, edits, merge or delegation.

Durable final review: A-10232.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-23T20:56:32.531Z

Merged 267dfd13923978a835bc4675d08e02477e4dc3f9 onto dev.
