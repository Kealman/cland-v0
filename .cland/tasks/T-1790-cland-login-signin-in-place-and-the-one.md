---
id: T-1790
kind: task
title: "`cland login signin` in place, and the one-sign-in hint"
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1781
  - T-1789
topic: topic-1479
branch: t/T-1790-cland-login-signin-in-place-and-the-one
created: 2026-11-09T12:44:11.998Z
updated: 2026-11-11T18:06:03.753Z
closed: 2026-11-11T18:06:03.753Z
---

## Summary

`cland login signin <name>` re-runs the harness's own sign-in over `ssh -t` on the host and volume that hold the login, while its sessions keep running. It then snapshots the disk under `fsfreeze` and marks the login `ready`. A signed-out login bound nowhere is first attached to a pool host, as `login add` does. A second sign-out of one account within a day adds the hint "This account seems to allow one sign-in: set exclusive or add an account."

## What to build

T-1777's sign-in runner on the existing mount, with no new volume. A Codex sign-in in place runs on the login's own home, whose credentials are already dead (question 12). The sign-in ends with freeze, snapshot and thaw through T-1781. The hint keeps a 24 h window on the hub clock, keyed by account, or by login when the login has no account; it appears in the card, the Agents line and `cland login list`. The `login.signin` frame and `cland login signin` are added.

## Acceptance criteria

- [x] C1. `cland login signin <name>` on a signed-out login runs the fake sign-in over `ssh -t` on the host holding it, with the same volume id and no volume created (test).
  - done: impl-1790 · 2026-11-11T16:47:18.520Z
  - verified: rev-35 [reviewer] · run rev-35-1790-final-1 · 2026-11-11T17:26:43.378Z · commit 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
- [x] C2. The sign-in is followed by freeze, snapshot and thaw on that disk through the snapshot owner, and the login reads in-use while it keeps bindings or ready when unbound, with a new last sign-in (test).
  - done: impl-1790 · 2026-11-11T16:47:18.661Z
  - verified: rev-35 [reviewer] · run rev-35-1790-final-1 · 2026-11-11T17:26:43.378Z · commit 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
- [x] C3. The sessions of that harness on the host keep running through the sign-in, and their next turn uses the renewed login (test).
  - done: impl-1790 · 2026-11-11T16:47:18.923Z
  - verified: rev-35 [reviewer] · run rev-35-1790-final-1 · 2026-11-11T17:26:43.378Z · commit 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
- [x] C4. A signed-out login bound nowhere is attached and mounted on a ready pool host for its sign-in, and is detached after it (test).
  - done: impl-1790 · 2026-11-11T16:47:19.057Z
  - verified: rev-35 [reviewer] · run rev-35-1790-final-1 · 2026-11-11T17:26:43.378Z · commit 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
- [x] C5. A second sign-out of one account within 24 h of hub-clock time adds the one-sign-in hint to the card, the Agents line and `cland login list`, and a sign-out 24 h or more after the first does not (test).
  - done: impl-1790 · 2026-11-11T16:47:19.334Z
  - verified: rev-35 [reviewer] · run rev-35-1790-final-1 · 2026-11-11T17:26:43.378Z · commit 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa

## Blocked by

- T-1781
- T-1789

## Notes

- Hot files: `hub/src/host/login-signin.ts`, `hub/src/host/login-signals.ts` (the hint), `hub/src/cli/login.ts` (`signin`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-signin.test.ts` (T3 with `fake-ssh` and the fake binaries for C1 to C4; T2 on the fake clock for C5).
- Serves epic C8.

## Comments

### impl-1790 · 2026-11-11T14:58:45.343Z

Rule-20 sweep before edits: suite importingTests over every hub/nvim/web test finds 697 reached and 15 unknown (counted reached), full list in attached topic artifact. Explicit production consumers: LoginRecords store/persisted readers, LoginSignals, LoginCards, Sessions notice callback, agents-topic lifecycleNotice, prepareLoginSignIn/preparePoolLogin, LoginSnapshots/snapshotLoginDisk, terminalLogin/runLogin, protocol/dispatch/web-authority and shared wire. Explicit fixtures/tests: login-records/list/add/add-component/signin/terminal/signed-out/signed-out-native/snapshots/exclusive/keys/wait/reconcile plus host-create-ready, host-destroy-native, host-restart, host-unreachable, host-stop, login-write-back and login-key-spawn (native scopes retained). Docs/skills/QA: docs/hub/logins, accounts-and-limits, session-permissions, login test docs, implement skill and E-1535 stage-1/stage-2 briefs. Additive signedOut hint keeps older wire rows valid; prior-shape list regression retained. Signin frame is new; existing add/signed-in semantics preserved. Existing account poller/web account signedOut is separate user account domain and unaffected. Planned additive registrations: protocol, dispatch, cli/help, cli/login (signin).

### impl-1790 · 2026-11-11T15:10:49.135Z

Consumer sweep addendum: signedOut.oneSignIn is additive for LoginCards, Sessions Agents notice, CLI list and stored episode recovery; old wire rows stay valid in existing list tests. login_signout_window migrates empty, stores one timestamp/account-or-name and prunes ≤64 expired indexed rows/sign-out; no startup history scan. Existing generic transition(signed-out→creating) test/setup callers remain on its documented binding-deleting path; production renewal uses begin/finish. C4 reuses login add's existing inventory/attach/mount/cleanup body with an existing volume, no Binder extension. New native fixture copies T-1789 setup with explicit fake-root overlay (existing fixture correction is assigned to T-1813). Local native new file/add/write-back green; complete TMPDIR name sets unchanged 0→0 cland-h. Wire frame addition also updates shared/wire and explicit web refusal inventory.

### impl-1790 · 2026-11-11T15:22:51.502Z

C3 scope disposition from Coordinator decision 82ab5bec-2463-4194-8b68-07cb27e4fd82 (2026-11-11 15:22:36Z, item topic): bound live-native next-turn OpenCode is the representative C3 end-to-end proof. T-1790 additionally must prove bound Codex signin on its existing dead credential home produces the renewed login file there; this narrower proof is still to add after pinned review a756d5c2. Native next-turn renewal for Codex and Claude Code moves explicitly to T-1813 with the Coordinator's criterion. Startup recovery disposition: no terminal census currently identifies CLI SSH sign-in; only exact captured machine-birth deletion receipt clears the interrupted-sign-in fence, never detached-volume inventory or time. Full consumer graph dispositions A-18787; honest original tool-output excerpts A-18788 keep precommit-local coverage distinct from reviewed-head verification.

### rev-35 · 2026-11-11T15:24:42.780Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1790-source-1
commit: a756d5c2dc165ceaff574fe86bb37ee1d581f4a8
scope: full
findings: [{"severity":"high","text":"Standards rules9/12/24/25 and SpecC2: renewal calls snapshotLoginDisk directly outside LoginSnapshots.work/control.installThaw. beginRelease can observe a recorded freeze while native freeze is held, see no running owner, thaw and remove intent before that freeze completes; the late freeze can then leave the disk frozen. Lead044b9f3c confirms. Register renewal snapshot work with the existing shared owner and keep held-freeze/release/thaw/shutdown regressions; Coordinator2691da6d explicitly requires this.","file":"hub/src/host/login-signin.ts","line":21},{"severity":"medium","text":"Standards rule26 and SpecC1/C2/C4: the renewal authorize callback rechecks host and sign_in token but never captures/revalidates the writer binding episode or retained volume birth/attachment authority through inventory, native effects and completion. Ordinary creating-state bind refusal does not exclude concurrent unbind/detach or same-values episode replacement. Lead3cba1efe confirms no protecting owner. Carry exact admitted binding/native volume identity through the shared owners and add held-inventory/rebound/detach controls before effects/publication.","file":"hub/src/host/login-add.ts","line":56},{"severity":"medium","text":"Standards rules12/25/26 and SpecC2/C4: new durable sign_in/creating admission has only an in-memory pending.complete owner. Startup reconciliation and snapshot scheduling exclude creating, so hub death or snapshot failure strands renewal with no recovery/join owner. Lead3cba1efe confirms; sign_in currently stores UUID only, not admitted host/machine-birth authority. Implement Coordinator feb9d4e1/1cd13e7f recovery: metadata signed-out/interrupted, invalidate old token, preserve bindings, retain exact-machine-birth interrupted fence until that machine's persisted deletion receipt; no timer or detached-volume settlement. Add late-token/refusal/positive-release/reopen controls.","file":"hub/src/host/logins.ts","line":293},{"severity":"medium","text":"Standards rule23: both bindings(name) selection calls materialize all retained reader bindings, and finishSignIn also materializes bindings(name).length; non-exclusive reader cardinality is unbounded. Lead3cba1efe confirms. Use indexed store-owned writer/any-binding existence reads with a reader-heavy returned-row/query-work regression. The new retained login_signout_window also needs the admitted indexed pruning/work-budget regression; only functional clock boundaries exist now (leadcb7aea8e). Preserve bounded expiry pruning and no history scan.","file":"hub/src/host/login-add.ts","line":14},{"severity":"medium","text":"Standards rule12: recovered-hint test registers raw t.after(Store.close) after tempProject's grouped cleanup hook. The hub may drain earlier, but directory-removal phases run before the borrowed Store closes, and failed drainage does not make later phases safe. Lead044b9f3c confirms this setup/cleanup gap. Prearm joined hub/Store ownership at acquisition, attempt all disposals in dependency order before root removal, and retain adverse setup/drain controls.","file":"hub/test/login-list.test.ts","line":13},{"severity":"medium","text":"Standards rules16/20 and CLI compatibility: LOGIN_USAGE changed for signin but the frozen help consumer remains unchanged. cli-usage-compatibility.test.ts deep-compares every export against those bytes, so this required consumer is unmigrated. Lead99f09963 confirms no disposition/refresh. Use the existing refresh procedure, preserve compatibility/planted controls and update affected help/test guidance.","file":"hub/test/fixtures/cli-usage/commands.json","line":77},{"severity":"medium","text":"SpecC1/C3 test coverage: current all-three-harness case proves unbound sign-in/cleanup, while bound live-next-turn proof is OpenCode only. Coordinator82ab5bec now accepts OpenCode as C3 representative and moves Codex/Claude native next-turn renewal explicitly to T1813, but still requires a bound Codex renewal proving use of its own dead home and the renewed login file there. That narrower bound Codex control is absent at this pin; add it without claiming deferred harness next-turn coverage.","file":"hub/test/login-resignin-native.test.ts","line":25}]
finding_counts: {"high":1,"medium":6,"low":0}

A-18789 complete pinned source1 NOT CLEAR:7 distinct findings (1high freeze/thaw owner race;6medium identity, interrupted owner, bounded reads/work proof, fixture cleanup, frozen help, required bound Codex home control). Lead confirms substantive gaps. Coordinator2691da6d requires shared snapshot owner and bound in-use/unbound ready; feb9d4e1 withdraws timer exception;1cd13e7f recovery keeps exact-machine-birth interrupted fence until existing deletion receipt;82ab5bec accepts representative OpenCode C3 but requires bound Codex dead-home proof, other native next turns T1813. No source edits/experiments during pin. A18788 honest precommit tool excerpts/signals unknown; A18785 TMPDIR equality qualified; A18787 normalized717 test identities, directed8T3 set separately planned. Real T1792 accessor integration and catalog work explicitly future per4b8ca260, no final evidence claim. C1–C5 failed for listed incomplete requirements, none verified. Hold released for consolidated fixes and fresh committed source review before verification; no provenance-only rerun or Reviewer native/browser/provider activity.

Criteria: C1 failed (Existing renewal lacks captured binding/native-volume authority across awaits and leaves frozen CLI-help compatibility consumer unmigrated.), C2 failed (Renewal freeze/snapshot bypasses shared LoginSnapshots work, permitting early thaw before held freeze settles; interrupted admission also lacks recovery.), C3 failed (Safe live renewal ownership is incomplete; approved representative OpenCode scope still requires the absent bound Codex dead-home renewal proof.), C4 failed (Existing-volume selection/attachment ownership and interrupted renewal cleanup/recovery remain incomplete.), C5 failed (New retained hint-table work-budget proof and recovered-hint fixture hub/Store/root disposal are incomplete.).

### impl-1790 · 2026-11-11T15:42:56.073Z

Rule-20 correction addendum: SnapshotTarget adds optional mounted/validate callbacks and LoginSnapshots.signIn registers creating renewal work in the existing map; existing schedule/manual consumers keep prior defaults, release/shutdown share native freeze/thaw. onReleased now also acknowledges detached signed-out disks with no bindings (login-release writer paths, snapshot/release/reconcile tests and docs migrated); it cannot settle a native terminal fence. Private sign_in now owns id/state/captured host+machine birth; daemon startup calls sign-in recovery after T-1793 reconciliation before scaling, and provision-host's persisted exact-machine deletion boundary settles it. Active/host indices page admissions without scanning retained login/provision history. No existing SSH terminal census, no time settlement. New T2 recovery and budget tests plus metadata-owner failure controls added; T1 shared-owner/held-inventory tests added. Frozen LOGIN_USAGE owning row migrated with all legacy controls retained. Directed future local T3 set remains the eight named files in reviewer reply7a4910c0; other T3 is batch-deferred, T2/T1 selected/fallback Linux verify. C3 Codex/Claude native next-turn deferral to T-1813 remains explicit; narrower bound Codex control is now written, unexecuted.

### impl-1790 · 2026-11-11T16:03:27.847Z

Rule-20 final caller/catalog addendum before integration: Coordinator e2055aa9 approves replacing only dispatch.ts:326's existing snapshot identity literal (plus necessary import). snapshotHostIdentity callers are dispatch's existing resolver, preparePoolLogin in login-add.ts, and the same-/changed-birth renewal regression in login-signin.test.ts. prepareExistingLoginSignIn now requires captured Machine and identity; pool/bare existing-volume callers and every unit caller migrated. Coordinator37ec5feb approves settleLoginSignInsForHost invoking existing fenceLostLoginRelease with preserveRelease for an unbound interrupted mount only after exact-machine deletion; original release/startup callers keep defaults and receipt/admission metadata is retained. New unbound positive-release regression passes. Native8 at72b0612bd is A-18795 (26/26, all code0/signalnull), explicitly pre-integration diagnostics, not final verification. Default npm run test:nvim-fixtures completed all49 consumers,6057 frames and live attach control at72b0612bd; no generated diff, no explorer rewrites to revert. A-18796 captures recorder stream. T4 included solely by Coordinator a6c54b21 recording exception; T4 verification remains stage/epic-deferred. Catalog49 tier list:
T2: nvim/test/account-poll.test.ts
T2: nvim/test/agents-filters.test.ts
T2: nvim/test/artifact-browser-component.test.ts
T2: nvim/test/artifact-render.test.ts
T2: nvim/test/artifacts.test.ts
T2: nvim/test/client-component.test.ts
T2: nvim/test/crew.test.ts
T2: nvim/test/criteria-component.test.ts
T2: nvim/test/declined-ask-component.test.ts
T2: nvim/test/events-quiet.test.ts
T2: nvim/test/events.test.ts
T2: nvim/test/explorer-card-component.test.ts
T2: nvim/test/explorer-component.test.ts
T2: nvim/test/explorer-compose-component.test.ts
T4: nvim/test/explorer-outline-load.test.ts
T2: nvim/test/explorer-roots-component.test.ts
T3: nvim/test/explorer.test.ts
T2: nvim/test/graph.test.ts
T2: nvim/test/human-marks-component.test.ts
T2: nvim/test/inbox-actions.test.ts
T2: nvim/test/inbox-requests.test.ts
T2: nvim/test/inbox-sections.test.ts
T2: nvim/test/item-prefixes.test.ts
T2: nvim/test/items.test.ts
T2: nvim/test/launcher-component.test.ts
T4: nvim/test/launcher-input-load.test.ts
T2: nvim/test/layers-component.test.ts
T3: nvim/test/layers.test.ts
T2: nvim/test/message-users.test.ts
T2: nvim/test/needs-you.test.ts
T2: nvim/test/palette-component.test.ts
T3: nvim/test/palette.test.ts
T2: nvim/test/panel-placement-component.test.ts
T2: nvim/test/plan-component.test.ts
T2: nvim/test/progress-counts-component.test.ts
T3: nvim/test/qa.test.ts
T2: nvim/test/remote-via.test.ts
T2: nvim/test/rulebook-component.test.ts
T2: nvim/test/session-archive.test.ts
T2: nvim/test/session-resume.test.ts
T2: nvim/test/sessions.test.ts
T2: nvim/test/shell-component.test.ts
T3: nvim/test/shell.test.ts
T4: nvim/test/thread-oracle-soak.test.ts
T2: nvim/test/thread.test.ts
T3: nvim/test/ui.test.ts
T2: nvim/test/vboard.test.ts
T2: nvim/test/verification-queue.test.ts
T2: nvim/test/verification-view.test.ts

### impl-1790 · 2026-11-11T16:31:18.289Z

Directed T-1792 integration consumer disposition: begin/finish now call LoginRecords.assertNotRemoving and assertSnapshotSettled, with native snapshot work retaining its own admission while running. Removed the temporary injected fence constructor seam; real remove/snapshot-admission regressions replace injected cases. beginRemove has the approved one shared assertNotSigningIn call before any claim/effect; actual fake-provider machine deletion then permits removal. LoginCards.withdrawRemoving is retained unchanged; hint/fence text remains separate. T-1792 administrative hostless markSignedOut transitions do not contribute to the operational repeated-death hint (new regression); native host-bound episodes still do. Snapshot identity has exactly three production callers: dispatch resolver capture, dispatch authorizeCleanup comparison, and preparePoolLogin renewal capture. The first two replace existing literals only. prepareExistingLoginSignIn requires captured Machine+identity; new sign-in deletion-receipt caller uses fenceLostLoginRelease with preserveRelease, matching freeze identity, no new release fence and no inferred success. Existing generic signed-out→creating transition callers remain binding-deleting; renewal alone uses beginSignIn/finishSignIn. Provider rate refusal follows Coordinator 500b1ffa: known not-sent leaves ready/in-use with pending/retryAt; only unknown native outcome retains creating. The shared LoginSnapshots timer owns retry. Work/tree evidence: directed merged uncommitted tree, local macOS Node24.21, no browser, 12 named T1/T2 files197/197 code0, hub typecheck code0; no native or Linux verification claimed yet.

### impl-1790 · 2026-11-11T16:36:41.973Z

Owner-loss contract sweep before correction: LoginSignIn production consumers are preparePoolLogin/prepareExistingLoginSignIn/prepareLoginSignIn and dispatcher peer-close, shutdown closers, before-plan-disconnect and connection-pinned login.signed-in completion. Injectable prepareLogin fixtures in login-add-component and runner fixtures in login-host-pin retain add behavior through optional interrupt fallback. Renewal adds interrupt owner loss; real CLI post-nativeClosed completion remains the same wire shape, as Coordinator18d3cb27 explicitly chose. Protocol/shared wire/CLI need no edit; older-wire list/completion controls stay. Tests reached explicitly include login-signin, login-signin-recovery, login-add-component, login-host-pin, login-terminal, login-resignin-native and existing directed native8; prior graph/tier dispositions remain. login add shares the synthetic-null gap but remains unchanged under Coordinator cec7ed39; Coordinator filed T-1814 (Bugs,S). Policy e516d138 overrides prior graceful-stop failure clearing: all owner loss without close receipt retains interrupted exact-machine fence; only connection-pinned native completion or machine deletion settles.

### rev-35 · 2026-11-11T16:40:41.050Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1790-source-2
commit: 85352c52df09c2583630b8a23da0ec63a4ac8050
scope: full
findings: [{"severity":"medium","text":"Standards rules9/12/25/26 and SpecC1–C4: peer-close and #loginClosers synthesize pending.complete(null), indistinguishable from a close-gated CLI receipt. Bound renewal deliberately performs no unmount/drain, then markSignedOut clears sign_in without proving the separate SSH signer has exited; a second signer may be admitted while the first still writes. Lead5bc54b41 confirms. Coordinator e516d138/cec7ed39 override graceful-stop clearing;18d3cb27 requires additive LoginSignIn.interrupt() for owner loss, pinned-connection post-child-close login.signed-in remains the receipt, no wire/CLI change. Invalidate pending/token and retain exact-machine interrupted fence, join already-admitted real completion without overriding its receipt, and add held-disconnect/shutdown/second-signer/wrong-or-late-connection controls. Login-add's analogous gap is explicitly separate T1814; leave its behavior unchanged.","file":"hub/src/hub/dispatch.ts","line":1467},{"severity":"medium","text":"Standards rules24/26 and SpecC2/C4: signIn validates a new admission but launch returns any prior work keyed only by login name. An older scheduled/manual snapshot held in resolve before native admission can coexist with a permitted queued-backup renewal. That older ready/in-use generation must reject after the row becomes creating; renewed terminal success inherits its rejection and never admits its own backup. Lead8378ab3a confirms no exclusion. Drain older-generation work, revalidate current durable admission, then admit/join only the matching renewal generation. Add an actual held prior-owner regression; metadata-only queued-backup tests do not cover this path.","file":"hub/src/host/login-snapshots.ts","line":149}]
finding_counts: {"high":0,"medium":2,"low":0}

A-18802 complete integrated source2 NOT CLEAR:2medium remaining. Original high freeze/thaw owner gap is fixed; indexed reads/work controls, captured episode/machine/volume checks, startup deletion fence, fixture owner, frozen help and bound Codex control appear addressed. Remaining1: peer loss/#loginClosers fabricate complete(null) and clear renewal token with no native-close receipt (lead5bc54b41); Coordinator e516d138/cec7ed39/18d3cb27 requires interrupt(), unchanged exact-connection CLI receipt/wire, conservative machine fence; add gap separateT1814. Remaining2: LoginSnapshots returns old name-only work to new renewal admission; old generation then rejects creating and strands renewed success (lead8378ab3a). Drain/revalidate and admit/join matching generation. Directed T1792 runtime matches efaba34f8; real guards and single approved beginRemove fence present. Rate refusal policy500b1ffa intentional. A18801 supporting precommit197/local/static qualified; A18795/96 prior native/catalog not current coverage. C1–C4failed, C5 remains unverified; no extra production findings. Clean fixed head/read-only review only. Hold released for correction and fresh committed source review before native8/verify; no provenance-only run.

Criteria: C1 failed (Dispatcher owner loss can clear the bound renewal admission without the CLI native-close receipt and admit a concurrent signer.), C2 failed (New renewal can inherit an old queued snapshot generation's rejection rather than admit its own backup; owner-loss settlement remains unfenced.), C3 failed (Disconnect/shutdown can release renewal authority while the original SSH signer may still write to the live session's disk.), C4 failed (An old queued snapshot owner can strand successful unbound renewal in creating without admitting its own snapshot/completion.).

### rev-35 · 2026-11-11T16:50:16.438Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1790-source-3
commit: 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18804 source3 CLEAR: Standards0/Spec0. Both A18802 gaps resolved: renewal interrupt distinguishes receipt-less owner loss, invalidates pending entry/token and preserves exact-machine fence without native cleanup; accepted close-confirmed completion retains shared outcome. Add fallback stays T1814; wire/CLI unchanged per18d3cb27. Snapshot owner drains older generations, revalidates and admits/joins matching renewal work. Seven real-owner T2 receipt outcomes, T1 unbound no-cleanup and actual held-generation/duplicate/invalidation T2 controls source-aligned and cleanup prearmed/joined. Earlier A18789 corrections remain: shared freeze owner/identity/recovery, real removal guards, indexed work proofs, guarded Store disposal, frozen help and bound Codex home control. Current done marks all present; no run-dependent C1–C5 final marks yet. A18803 precommit68/113 supporting receipts and report-only diagnostics qualified; A18795/96 old native/catalog not current coverage. Clean fixed head/read-only diff check; no Reviewer experiments. Hold released; exact-head native8 then mode-free verify per Coordinator; final case/file/consumer reconciliation and runtime verdict still required, fullT3/T4/QA separate.

### impl-1790 · 2026-11-11T16:53:12.336Z

Reviewed-head native evidence: A-18805 original redacted producer captures at3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa after source3 clearance. macOS arm64 Node24.21 local,fakes only,browser none. All finite directed8 paths executed serially: login-resignin-native3,login-add1,login-write-back1,login-signed-out-native1,login-key-spawn4,host-create-ready12,host-destroy-native3,host-restart1 (all hub/test/*.test.ts),26/26 tests,zero failures/skips; all8 producer code0/signalnull close receipts. Complete before/after TMPDIR name sets unchanged,cland-h0→0,not a global /tmp claim. Owner-checked preservation lock released within15min; no concurrent test/verify. New native case samples4034.97ms boundCodex,3979.22ms unbound allharnesses,3761.90ms OpenCode nextturn; existing C-216 allowances apply,not Linux timing claims. Linux mode-free verify submitted after lock release,receipt pending. OtherT3 deferred to merge-batch coverage,T4 to stage/epic,QA after-stage. Earlier A-18795 native and A-18796 all49 catalog evidence remain earlier-head diagnostics/recording.

### impl-1790 · 2026-11-11T17:22:20.629Z

Final actual receipt reconciliation published after A-18807 verification and A-18808 current-head default49 recorder. Conservative prior/current∪unknown∪explicit union776 normalized paths (prior717,current graph717,unknown15 countedreached,explicit66),actual case/file facts separate. All675 current T1/T2/Web manifest paths have positive file+case receipts;6119 base cases/677 base files,zero negatives/skips. Separate47identities×5 load proof is235test+235file finishes,not extra base cases. Linux changedT3 renewal3cases and mapped inboxT4guard1basecase ran; otherT3/fullT4 deferred. Native8 local26/26 stays A-18805. Catalog49 map:40T2 ordinary current verification;6T3/3T4 ordinary current unexecuted/deferred per Coordinator77f18a15,but all49 now have current-head recording-only A-18808 (6057frames+liveattach,code0/signalnull,clean/no generateddiff). Incoming login.remove changed shared-wire/protocol since72,so conditional regeneration was performed; six named frame-builder files had no diff. PriorA18796 remains earlier-head recording-only. All at3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa,source unchanged. Droplet Linuxx64/Node24.21/Neovim0.12.5,ChromeHeadlessShell1248/ChromeForTesting156.0.8078.4;budget/ratchet/skipchecks reportmode. Lifetime1179s/cost$0.0819 are executor facts,not suitewalltime. Awaiting reviewer final same-head settlement;no additional test/suite requested.

### rev-35 · 2026-11-11T17:26:43.378Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1790-final-1
commit: 3683b2f7b098e0a875b7ce8fd6f49eccd6b2eefa
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18812 final CLEAR, Standards0/Spec0, C1–C5 verified at unchanged reviewed3683b2f7b. Independent A18807 audit:6119 base test/677 base file passes,235 separate load test+235 load-file passes (47×5),zero negative/skipped/cancelled;all675 manifest T1/T2/Web files have positive case+file receipts;3 Linux renewal native cases pass once; mappedT4 base only. A18805/06 eight serial Darwin native producers/26 named passes,each close0/signalnull,exact TMPDIR9878-name equality with scope/provenance limits retained. A18809 all776 conservative prior/current/unknown/explicit paths preserved,tiers checked,all exported event IDs/counts matched:525 Linux paths,7 additional local-native,228T3/16T4 ordinary deferred. A18808 current default49 catalog+liveattach code0/null,6057frames,recording-only;40T2 ordinary pass,6T3/3T4 ordinary deferred under77f18a15 after incoming wire login.remove triggered authorized rerun. C3 OpenCode representative+boundCodex own-home proof per82ab5bec;Codex/Claude native next turns T1813. Normalized verification tree independently matches; Linux executor/browser and Mac launcher/redactor/scan qualification retained. Report-only budgets/lint not clean-budget claim. FullT3/broaderT4/after-stageQA remain separate. Clean fixed head; no Reviewer experiments/source mutation. Hold released.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-11-11T18:06:03.753Z

Merged 44a2775c9f7fb25fca92f9f528fca3b34dec495c onto dev.
