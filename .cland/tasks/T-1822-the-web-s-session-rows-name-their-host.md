---
id: T-1822
kind: task
title: The web's session rows name their host
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by: []
topic: topic-1489
branch: t/T-1822-the-web-s-session-rows-name-their-host
created: 2026-11-12T10:07:19.924Z
updated: 2026-11-12T11:35:44.140Z
closed: 2026-11-12T11:35:44.140Z
---

## Summary

The web's session rows name the host each session runs on, on the desktop row and on the phone's session page. The process row already carries the host; this ticket shows it.

## What to build

The session row's facts gain the host id for a session on a remote host, beside the harness, model and account. A local session shows no host. The phone's session page shows the same fact. The fact's tooltip says it is the host the session runs on. Colours come from tokens, with secondary text at 4.5:1 on ground and selection.

## Acceptance criteria

- [x] C1. A session on a fake host names its host id on its Sessions row and on its phone session page, and a local session names none (test).
  - done: impl-1822 · 2026-11-12T10:21:50.707Z
  - verified: rev-35 [reviewer] · run rev-35-1822-final-1 · 2026-11-12T10:49:12.586Z · commit b63182b8eeb016bd31fd76b06cbdb30bc3225fa0
- [x] C2. The host fact has a tooltip, and the typecheck's colour and contrast checks pass on the row in its selected state (test).
  - done: impl-1822 · 2026-11-12T10:12:45.181Z
  - verified: rev-35 [reviewer] · run rev-35-1822-final-1 · 2026-11-12T10:49:12.586Z · commit b63182b8eeb016bd31fd76b06cbdb30bc3225fa0

## Blocked by

None (can start immediately)

## Notes

- Hot files: `web/src/sessions/SessionRow.tsx`, `web/src/sessions/SessionPage.tsx`, `web/src/sessions/Sessions.module.css`.
- Tests: `web/test/sessions.test.ts` and `web/test/phone-sessions.test.ts` (Web, `projectHub` with a fake host, isolated Headless Shell).
- Serves epic C3.

## Comments

### impl-1822 · 2026-11-12T10:10:41.735Z

Red before fix on macOS arm64 Node v24.21.0 / isolated pinned Headless Shell: both new remote-host browser cases failed at the intended missing UI boundary: locator.textContent: Timeout 3000ms exceeded waiting for getByTitle('Host the session runs on'). Registered testHost and fake Codex launch succeeded. No shared contract changes: SessionRow already inherits optional HarnessProcessView.host; existing old/absent rows remain omitted. Browser-only consumers changed: SessionRow.tsx and SessionPage.tsx.

### rev-35 · 2026-11-12T10:20:12.227Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1822-source-1
commit: 67e40cccf68be76c282f4b55a20f346af5fdcdc8
scope: full
findings: [{"severity":"medium","text":"Desktop local omission count0 passes for a missing local-worker row; phone-sessions.ts225–231 waits only generic dl before absence, not displayed Session identity. Lead7efb76ab confirms no earlier exact local receipt. Add bounded positive local-row/phone-page identity observation before retaining absence assertions, perRule9/C1; keep remote tooltip/selection checks.","file":"web/test/sessions.test.ts","line":33}]
finding_counts: {"high":0,"medium":1,"low":0}

A-18988 complete source1 NOT CLEAR one medium test-proof gap/no product bug. Clean67e40cccf/tree42baf2694a2527f160212fc5742dd427b65324a5/base94b73e73c. Two existing optional host facts render remoteid/tooltip, local/absentguard; reusedCSSModulesmuted/selection and4.5contrastguard, no CSS/keymap/wire/native/dependency change. Synthetic registeredtestHost rejectsnative, sharedWebfixtureownership/sealing andensureWebBuildcanonicalhook retained. Guides/readbindingA18973/75 inspected. A18985 honestprecommit tool excerpts7+6green/finaldesktop1, nativeexit inference/candidate changes/nohash/browsermanifestnotruntimeversion/positivecensus0notTMPDIRproof; notLinuxreceipt. C2runtimechecks pending. Holdreleased for positiveidentity fix, functionaltargetedcheckwithbriefrequiredinventory and freshcommittedsource review before modefreeverify. No extradevmerge/native/provider/provenance-onlyrerun/Reviewerexperiment.

Criteria: C1 failed (Local host omission is not bound to a positively observed rendered local session on both surfaces.).

### rev-35 · 2026-11-12T10:23:36.786Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1822-source-2
commit: b63182b8eeb016bd31fd76b06cbdb30bc3225fa0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-18993 source2 CLEAR0findings. Cleanb63182b8e/tree9a0775484c03a465cd59d583f7d32790841d7131; onlytwoWebtests7add1delete,no merge/product/CSS/fixture change. Desktop positively awaitsvisiblelocal-worker/exactname beforecount0; phone awaits exactSessiondd thenretainsidentityassertion beforehostfacts/omission. A18988proofgapresolved; remote tooltip/selectedmutedchecks retained. A18992 actual13/13cases,13browsercensusafter0+hubstopped,desktop1.356/phone0.960,positivepubscan inspected. Precommitunchangedworkingcontent/no perrunhash/packagebrowserpinnotruntimeversion/separatesignalunknown qualified. TMPDIRexport9898same/emptydeltas,rawsetsprivate;notindependentlyrecomputed/globalempty/privateTmpclaim. PriorstaticA18985retained, noReviewerexperiment. C1/C2finalverificationawaitmodefreeexactheadpositiveWebcases+T0colour/contrastoutputs. Holdreleased;no extradevmerge/native/provider/provenancererun. QAafterstage/fullT3T4separate.

### rev-35 · 2026-11-12T10:49:12.586Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1822-final-1
commit: b63182b8eeb016bd31fd76b06cbdb30bc3225fa0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-19006 FINAL CLEAR C1/C2verified0findings. Same-head e9a6944e/A19005 actual namedphonepass1.745769487s/desktop2.622791103s withpositivefullfiles6+7cases; sourceA18993localidentityfix/remoteid/tooltip/selectionassertions retained. ActualT0hostgate lines30–31 token-onlyfixtures+23tokens≥4.5ground/selection;notrepeatedLinux. Streaming6185basecases/683basefiles, separate125loadcase/filepasses,0negative/skip;218T1/413T2/52Web,noneT3/T4. NewWebcasesbaseonce;Webrepetitionsreport0files/0required,no5claim. Git9a0775484c03a465cd59d583f7d32790841d7131/normalizeddba98c2c53107f42c9e4bf171f708d7d442ae99c independentlymatchesprovenance;cleanhead. Linuxx64Node24.21/nvim0.12.5,c8lon1,2workers(Web4),1283s/$0.0891; suiteprovenanceHeadlessShell1248 ChromeTesting156.0.8078.4 exactbinaryretained,notinventedpercasebrowser.version. Reportlint122/59+budgets/ratchet remainreport,newcasesbelow4s. LocalA18985/92precommit/capture/inventorylimitsretained,noglobalemptyclaim. NoReviewerexperiments. RemainingT3/T4/stageQAseparate;holdreleased,claim untilnormalmerge.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-12T11:35:44.140Z

Merged 089d045f525fef5ae15cade2ba83bb14e20de514 onto dev.
