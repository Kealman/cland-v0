---
id: T-1165
kind: task
title: "The phone frame: one width seam and the bottom bar"
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by: []
topic: topic-906
branch: t/T-1165-the-phone-frame-one-width-seam-and-the
created: 2026-10-23T07:00:02.025Z
updated: 2026-10-23T13:41:43.202Z
---

## Summary

Below 640 CSS px the shell gives way to the phone frame: a compact header, one screen and a bottom bar of Inbox, Topics, Sessions, Events and More with their counts, More opening a small sheet of Items, Artifacts and Accounts. One width seam replaces the scattered 639 px checks, and the Web harness gains a phone context.

## Parent

E-419 (§3.6 the bottom bar, P24 and P26; choices "The phone width" and "Touch"; the prefactor and the first half of tracer step 1).

## What to build

- **The width seam.** One module answers whether the page is at phone width (below 640 CSS px), the way `desktop.ts` answers 1280 px, and the shell and the Sessions area's narrow row tap and Enter read it, so the phone has one breakpoint. Between 640 and 1279 px the desktop shell keeps running with the rail collapsed, as today.
- **The frame.** Below 640 px the rail is not rendered. A bottom bar holds Inbox, Topics, Sessions, Events and More, each a target at least 44 px tall with its icon, name and count, the current one marked. The counts come from the same source as the rail's badges; Events counts the events since the human's last look, as the inbox's events line does. The header keeps the project, the release chip, Search (the palette) and the needs-you pill with the hub dot; the Coordinator chip and `?` leave the header at this width (help stays in the palette).
- **No split, no drawer.** At phone width ⌘\ opens no split and a selected row opens no drawer; a split saved on the desktop stays saved and returns when the page is widened. A first load at phone width with no saved area opens Inbox.
- **More.** More opens a small sheet above the bar, without a scrim, listing Items, Artifacts and Accounts; choosing one opens it, and Escape (through the key map, never a component-local listener) or a tap outside closes it. Their read-only behaviour is the next ticket.
- **The harness.** A Web case can ask for a phone context: 390x844 with touch and the mobile flag in Chrome Headless Shell. Readiness waits for the bar's five slots instead of the rail's seven areas. No new dependency.

## Acceptance criteria

- [x] C1. At 390x844 the rail is absent and the bottom bar shows Inbox, Topics, Sessions, Events and More with their counts, and a tap on each of the four areas opens it (Web test).
  - done: impl-1165 · 2026-10-23T13:35:14.786Z
- [x] C2. At 640 px the shell shows the collapsed rail and no bar, and resizing to 639 px swaps the rail for the bar without a reload (Web test).
  - done: impl-1165 · 2026-10-23T13:35:14.863Z
- [x] C3. At 390x844 ⌘\ opens no split and a selected row opens no drawer, and a split saved at 1440 px returns when the page is widened again (Web test).
  - done: impl-1165 · 2026-10-23T13:40:36.836Z
- [x] C4. More opens a sheet above the bar without a scrim listing Items, Artifacts and Accounts, and Escape or choosing one closes it (Web test).
  - done: impl-1165 · 2026-10-23T13:35:15.095Z
- [x] C5. Every visible control of the header, the bar and the More sheet at 390x844 is at least 44 px tall (Web test).
  - done: impl-1165 · 2026-10-23T13:35:15.162Z
- [x] C6. `web/README.md` gains a Phone section on the width seam, the bar, More and the phone test context (docs).
  - done: impl-1165 · 2026-10-23T13:35:15.230Z
  - verified: rev-23 [reviewer] · run rev-20261023-1165-source-2 · 2026-10-23T13:41:43.202Z · commit 0da86127ddc3d5459c12bf11c2e42c9e00e6c035

## Comments

### impl-1165 · 2026-10-23T13:35:15.296Z

Implemented and pushed 29b3b8bb. C1–C6 covered by sealed phone Web cases and README. Local macOS targeted phone + six required neighboring files + session-actions, build/web typecheck and report-only lint pass; detailed source-review evidence and screenshot published in topic-906. No queued suite receipt yet; requesting source review before mode-free verification.

### rev-23 · 2026-10-23T13:38:04.510Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1165-source
commit: 29b3b8bb3c0678b47f5e8166dad0527b51e7d2e6
scope: full
findings: [{"severity":"medium","text":"M1: Phone sets split=false, satisfying Inbox's independent !props.split drawer condition after selecting a row. Gate this drawer via the shared phone seam, preserve inline actions, and add exact phone Inbox-selection/no-drawer regression.","file":"web/src/InboxArea.tsx","line":159}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1165 full source review
Head29b3b8bb3c0678b47f5e8166dad0527b51e7d2e6 / tree73324932a7ee73b5c158d8d013f640c28c75a08e
Parent/fixed baseadfc24801a9eb7be9aa3ba4427417daa7ff264cd; git diffadfc2480...29b3b8bb,13files296+/29-.
Run rev-20261023-1165-source. Not clear; M1 medium only; C3 failed. Other runtime criteria and C6 final verification pending.

Standards: no independent findings. phone.ts centralizes exact(width<640px) imperative/render seam; Sessions narrow event handlers and CSS now derive from it. Existing desktop1280 collapse seam preserved. Shared key map owns More Escape; no component-local raw listener. Native touch controls, fresh sealed phone harness context390x844/touch/mobile, five-slot readiness, existing desktop seven-area readiness and Web tier registration are present. No new dependency/protocol/role authority. README/test guidance updated. A-9888 decision3 explicitly says More has no count, overriding generic ticket bar-count wording.

Spec:
M1 medium — web/src/InboxArea.tsx:159. Shell's new !phone drawerOpen guard covers only the outer generic drawer. Inbox owns a separate aside guarded by !props.split && selectedEntry. Phone forces split=false, so selecting a phone Inbox ask/request/message/approval still mounts the360px Drawer, violating explicit C3/no-drawer and README. Current phone test selects only an Item and misses this path. Gate the reused Inbox drawer through the central width seam, retain required inline card/reply actions, and add a public phone Web regression with exact selected Inbox-row receipt and no Drawer. Implementer confirms the source gap; corrected head not covered here.

Other checks: phone removes rail rather than merely hiding it, renders four area buttons+More, marks current selection and reuses existing Inbox/Topics/Sessions badge facts; Events uses complete unfiltered shared-last-look paging and known zeros. More sheet above bar has no scrim, native choices, outside pointer/selection dismissal and shared Escape restores More. Header keeps project/release/Search/Needs you+hub dot and drops Coordinator/help. Controls use44px header/More and60px bar. Split/open-other routes and artifact navigation preserve single primary pane while keeping saved secondary/ratio; widening restores saved split. First no-preference load remains Inbox. 640/639 boundary and no-reload observer are covered; saved desktop split survives phone reload.

A-10044 screenshot inspected as an existing artifact, not browser QA: empty Inbox at390x844, compact header, five-slot bar and open More sheet fit horizontally and match intended hierarchy. It contains no selected Inbox row, so cannot establish M1/no-drawer behavior.

A-10045 evidence is explicitly working-tree targeted summary: local macOS arm64 Node24.21 build/Web typecheck and report-only lint pass; phone6(including parent), area-slots4, shell9, key-contexts3, palette11, sessions5, Inbox23, actions9 reported green. Local parent1.869395917s and badges0.338644416s; no new passing>=4s allowance trigger yet. Original initial reds and corrections retained in session records; no configured same-head receipt or Linux/T3 claim. Preserve original stdout/exits/head/timings without transcription reruns.

Complete findings:M1 only. Fresh corrected-head source review required before mode-free verification. Reviewer read-only Git/files/artifact-image inspection; no tests/live browser/GUI, edits or merge. After-stage affected QA separate; no per-item brief/outstanding QA criteria.

Criteria: C3 failed (Phone Inbox selection still mounts its independently rendered Drawer, outside Shell's phone guard.).

### impl-1165 · 2026-10-23T13:40:36.920Z

M1 corrected at pushed 0da86127: Inbox's independent drawer now shares the phone width guard; existing inline ask/approval and message/request actions retained. New exact-row phone regression was red with one Drawer and is green after the fix. Phone 7/7, Inbox 23/23, build/web typecheck/report-only lint green locally on macOS. C3 done refreshed. A-10048 or latest M1 artifact in topic-906 records corrected-head evidence; requesting fresh source review.

### rev-23 · 2026-10-23T13:41:43.202Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1165-source-2
commit: 0da86127ddc3d5459c12bf11c2e42c9e00e6c035
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1165 corrected source review
Head 0da86127ddc3d5459c12bf11c2e42c9e00e6c035 / tree424cd05ca0b90b6677a11ecd84a703a0153ff608
Parent29b3b8bb3c0678b47f5e8166dad0527b51e7d2e6; no dev merge.
Run rev-20261023-1165-source-2. Clear; findings []; C6 docs verified. C1–C5 runtime pending.

Standards: pass. Three-file focused correction uses the existing central usePhone subscription in InboxArea to gate only the independent drawer. No separate breakpoint, local keyboard listener, timeout expansion or unrelated behavior. Prior full audit A-10047 carries forward, including A-9888's explicit More-without-count decision.

Spec: M1 resolved. Inbox's independent aside now requires !phone as well as !split. Inline AskCard/ApprovalCard, message/request full bodies and existing row actions remain untouched. Phone regression selects a real public ask, observes exact aria-pressed row and inline options before zero-Drawer assertion; repeats exact selected message/request receipts, body/action-enabled assertions, then verifies one pane and no drawer surface. Existing Items/saved split/resize/More/count tests remain unchanged.

C6 verified: README Phone section accurately covers width<640 seam,640–1279 collapsed rail, five-slot bar, complete last-look Events count, More's authorized no-badge state/sheet/dismissal, compact header,44px controls, single pane/no drawer, preserved desktop split and390x844 touch/mobile harness context. Test guidance names the new Inbox row receipt.

A-10048 records working-tree original red expected0Drawer/actual1 after selected ask, green after guard, local macOS arm64 phone7/7 and Inbox23/23 plus build/Web typecheck/report-only lint. These are targeted source-as-committed summaries, not configured exact-head verification. A-10045 and screenshot A-10044 retain original provenance; no fresh visual/QA or Linux claim. Preserve original raw stdout/exits/head/timings without transcription reruns.

Proceed with mode-free verify at exact0da86127. Final C1–C5 await same-head configured result and new passing Web sample audit for4s allowance rule. Reviewer read only; no tests/live browser/edits. After-stage affected QA separate.

Criteria: C6 verified.
