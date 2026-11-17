---
id: T-1701
kind: task
title: Capture redaction can consume JSON syntax around a redacted URL, leaving unparseable log lines
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1887
blocked_by: []
topic: topic-1579
branch: t/T-1701-capture-redaction-can-consume-json
created: 2026-11-05T22:43:31.916Z
updated: 2026-11-17T05:15:36.505Z
---

## Summary

Capture redaction can break structured log lines. In A-16954 (`suite.log` line 3657), a serialized `suite timing` JSON line contained a Discord origin URL. The URL redactor replaced it with `[redacted]`, but its greedy pattern also consumed the closing JSON syntax, so the line no longer parses (JSON decode fails at character 111). Reported by rev-36 during T-1614's evidence review. It did not affect any test outcome.

## What to build

Make URL and secret redaction structure-preserving: redact only the URL or token span, never surrounding quotes, braces or commas. For JSON lines, prefer redacting parsed string values and re-serialising. Add a regression with a URL inside a JSON string value that must stay valid JSON after redaction.

## Acceptance criteria

- [x] C1. A serialized JSON line containing a URL, or a credential-shaped token, inside a string value is still valid JSON after redaction, and the secret is gone (test).
  - done: impl-1701 · 2026-11-17T02:35:48.009Z
  - verified: rev-36 [reviewer] · run rev-36-1701-final-1 · 2026-11-17T05:15:34.907Z · commit 3ab6181187dcddac0220ddc7c4725cd9d4ed2c77
- [x] C2. The existing redaction positive controls for planted secrets still pass, and no secret leaks through the structure-preserving path (test).
  - done: impl-1701 · 2026-11-17T04:32:46.165Z
  - verified: rev-36 [reviewer] · run rev-36-1701-final-1 · 2026-11-17T05:15:34.907Z · commit 3ab6181187dcddac0220ddc7c4725cd9d4ed2c77

## Comments

### impl-1701 · 2026-11-17T02:16:21.783Z

Cause confirmed in existing shared owner hub/src/host/agent/redact.ts, re-exported by remote/redact.ts. A-16954 README explicitly names shared remoteRedactor before capture writes; suite.log:3657 loses syntax immediately after the redacted URL. Added regression failed on original code with SyntaxError: Unterminated string in JSON at position 44. Full consumer inventory/dispositions published in item-topic artifact. Fix parses complete JSON line suffixes, masks decoded capture strings and reserializes; plain/incomplete contexts retain conservative redaction. No caller API or wire changes.

### impl-1701 · 2026-11-17T02:18:19.640Z

Review head dc7d827fd57956a68508f658ccd88d1119f07658, clean pushed branch. macOS arm64, Node v24.21.0, local targeted execution only, no browser: redactor 7/7; secrets-validation 3/3; gateway-secrets 14/14; gateway 20/20; telegram-api 28/28; speech 13/13; signin-redactor 1/1. Hub typecheck exit 0. npm run test:static exit 0 incl 806-doc/1927-item closed-wording lint; lint-tests exit 0 with 122 report-only findings and 0 refusals. Full verify unexecuted pending source clear and Coordinator window. Note A-20539 schema-key statement applies to .value; capture .text intentionally also masks secret-bearing keys.

### rev-36 · 2026-11-17T02:31:29.886Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1701-source-1
commit: dc7d827fd57956a68508f658ccd88d1119f07658
scope: full
findings: [{"severity":"medium","text":"C2: nested structured registered secrets bypass captureValue. A registered {\"private\":1} inside {\"wrapped\":{\"private\":1},\"ok\":true} starts after root boundary, then object/number recursion never checks its serialized registered span, so output can retain the exact secret. Claimant35e6abca confirms no exclusion. Preserve registered-secret semantics with nested structured positive controls.","file":"hub/src/host/agent/redact.ts","line":54},{"severity":"medium","text":"C1: valid root JSON string lines containing URL/Bearer values have no [/{ start and take the greedy raw fallback, which consumes closing JSON quotes. Root strings are not excluded by C1; claimant35e6abca confirms. Handle valid scalar string records and retain JSON/secret-absence assertions.","file":"hub/src/host/agent/redact.ts","line":63},{"severity":"medium","text":"Repeated bracketed non-JSON lines rescan the entire growing pending prefix before failed JSON.parse, yielding quadratic fallback work. No enforced per-call line/byte bound, confirmed aca7e8fa. Avoid cumulative rescans and add deterministic work coverage while preserving multiline conservative masking.","file":"hub/src/host/agent/redact.ts","line":70}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear A-20552: Standards1medium quadratic fallback, Spec2medium rootJSONstrings/nestedregisteredstructuredsecrets. Claimant35e6abca/aca7e8fa confirms all3 by source inspection with no exclusions/bounds; no runtime probe. Existing shared seam/Coordinator cause diagnosis correct, object/array controls and conservative raw masking partial positives. A-20539/A-20548 retain full per-path tier/status inventory and original commands/cwd/precommit/transcript/raw/hash/signal limits; targetedT1/T2/compiler/lint positives are evolving-candidate evidence, no configured/Linux/browser/native pass. C1/C2failed; holdreleased for consolidated correction and fresh committed source review before window/verify. No Reviewer runtime or source edit.

Criteria: C1 failed (Valid scalar JSON string records fall back to greedy raw masking and lose JSON delimiters; fallback also rescans growing raw prefixes quadratically.), C2 failed (Registered serialized-object secrets nested in larger JSON can survive the parsed structure-preserving path verbatim.).

### rev-36 · 2026-11-17T02:41:22.365Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1701-source-2
commit: f24f4deb37407494463eabb0587b7feb5eaec574
scope: full
findings: [{"severity":"medium","text":"C2: original registered spans govern only left-boundary crossings; per-record normalized-output checks miss noncanonical structured registrations and exact spans crossing valid JSON lines. Whitespace normalization can leave private contents clear, and an earlier intersected record can be emitted before a later-ending secret is masked. Claimantaad0e747 confirms both/no exclusions/later owner. Govern every intersected original record from registered raw spans before emission; add both positive controls.","file":"hub/src/host/agent/redact.ts","line":78}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear A-20561, Standards0/Spec1medium remaining C2 span-ownership gap with two confirmed source cases. A-20552 rootJSONstring and quadratic-prefix findings corrected/accepted; C1implementation accepted but unverified. Rawspan discovery once/monotoniccursor/workcontrol positive, but compact nested test/postserialized rescans do not prove noncanonical or cross-record registry safety; claimantaad0e747 agrees. A-20557 genuine prior-source3reds and corrected10/10/targeted/compiler/lint0 remain evolving precommit transcripts with raw/hash/native/tree limits; A-20548fullinventory older dispositions retained. No configured/Linux/browser/native or Reviewer runtime. C2failed; holdreleased for consolidated original-span correction/tests/docs and fresh committed source review before window/verify.

Criteria: C2 failed (Registered structured/multiline secrets are not protected across normalization and all intersected JSON records before output.).

### rev-36 · 2026-11-17T02:49:25.038Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1701-source-3
commit: a4d3615a677d1740803ab647a56ff088916085aa
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear A-20568, Standards0/Spec0. A-20552/A-20561 gaps resolved: scalarJSON first, once-per-input raw/registered spans share escapedregistry+marker logic, original syntax/cross-record intersections govern every JSON payload before normalization, rawRange clips originalspans across output slices; contained strings retain neighbours. Original conservative/multiline/marker/schema-key controls preserved; empty-range intermediate bug caughtbeforecommit. Nine addedT1 case names and consumer boundaries recorded. A-20565 red10/2fail then13/13 and currentconsumer/typecheck/lint0 positives remain evolving-candidate transcripts with raw/hash/tree/native limits; A-20548complete inventory/older statuses retained. No configured/Linux/browser/native or Reviewer runtime. C1/C2 implementation accepted, unverified until completed same-head configured evidence or explicit waiver. No dev merge; holdreleased; claimant follows Coordinator window before verify.

### rev-36 · 2026-11-17T03:37:19.278Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1701-evidence-1
commit: a4d3615a677d1740803ab647a56ff088916085aa
scope: evidence
findings: [{"severity":"medium","text":"Committed redact.ts hash is stale: manifest1423069a... differs from pinned source cba1a76a..., exactly matching A-20591's failed committed-closure guard. code-delivery.ts:15-20 rejects that agent bundle. Regenerate the existing projection and request fresh corrected-head source review; retain boundary/redaction controls. My source-3 clearance missed this generated-manifest consumer.","file":"hub/src/host/agent/closure.json","line":113}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards1medium; Spec0new algorithm findings, final evidence not clear. A-20592 independently reconciles failed same-head run5cc9eb3b/A-20591. Positive13/13 ordinary redactor cases and nine new identities each5typed load passes/matching5-of-5 are retained, not full clearance. T0 passed; T1 completed223positivefiles/1failed;1773ordinarytestpass/1fail plus260separate scopedpasses. All428T2/55Web/269T3/17T4 unexecuted; browser binary/version null. Exact head/source Git tree80c2ddf6 distinct from execution snapshote0fa2a0a; Linuxx64 Node24.21. Report-only budgets/lint/ratchet and original candidate provenance limits retained. Full60originalconsumer paths plus closure/bundle expansion reconciled78paths. C1 remains unverified, C2failed. Coordinator's separate manifest correction authority acknowledged; no runtime/retry/window/merge authority added. No Reviewer runtime/probe/edit/rerun.

Criteria: C2 failed (Stale committed agent closure rejects the candidate bundle; configured run5cc9eb3b/A-20591 failed T1 and did not execute the existing T2 planted-secret/capture consumers or Web, so final same-head compatibility evidence is incomplete.).

### impl-1701 · 2026-11-17T03:37:39.361Z

Closure omission corrected by manifest-only commit59be23015fae3e9edf6671530ffbcf05bf3adeb7 after rev-36 evidence hold release. Generator changed only redact.ts SHA256 to cba1a76a...; no runtime source edits or post-review dev merge. Authorized checks completed: host-agent-closure5/5, remote/redact13/13, secrets-validation3/3, local macOS arm64 Node24.21.0, exit0. New source review requested; no verify retry until clear and new Coordinator window. Prior A-20591 failed receipt retained; reviewer A-20592 reconciles78consumer paths.

### rev-36 · 2026-11-17T03:39:03.780Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1701-source-4
commit: 59be23015fae3e9edf6671530ffbcf05bf3adeb7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0 findings; Spec0 findings. A-20594 source clearance resolves A-20592's stale generated closure finding. New head is direct child of a4d3615a6, no dev merge, exactly one closure.json hash-line change. All47ordered path entries retained; independent read-only SHA256 of each pinned source/asset matches all47 manifest hashes; redactor hash nowcba1a76a... and runtime/test/docs blobs unchanged. Full prior source assessment A-20568 retained. C1/C2 remain unverified pending completed same-head configured result or explicit Coordinator waiver. Candidate local5/13/3tests are labelled reported precommit observations, not new configured proof. Prior A-20591 remains failed and T2/Web/native unexecuted;78-path consumer dispositions and original provenance limits remain A-20592. No Reviewer runtime/test/generator/compiler/lint/browser/provider/probe or edit/rerun. Claimant follows Coordinator window before exact-head verification; no merge/enqueue.

### rev-36 · 2026-11-17T04:30:11.940Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1701-evidence-2
commit: 59be23015fae3e9edf6671530ffbcf05bf3adeb7
scope: evidence
findings: [{"severity":"medium","text":"Root scalar JSON.parse/stringify rounds numeric-looking nonsecret strings above2^53; .value maps decoded string leaves through this capture parser at125. A-20608 first .text red changes90071992547410001 to90071992547410000; later callable/value concerns are source-derived, not extra executed assertions. Existing Discord compatibility fails; preserve exact numeric strings while retaining JSON/registered-span/planted-secret controls. My source clear missed this decoded/capture boundary.","file":"hub/src/host/agent/redact.ts","line":86}]
finding_counts: {"high":0,"medium":1,"low":0}

Standards0 findings; Spec1medium. A-20613 retains all116failed test/16failed file outcomes plus positive controls and89consumer paths. Failed run20454a56/A-20607:5698ordinarytestpass/116fail,591filepass/16fail,275separate scopedtest/filepasses; discord-messages file has unmatched start15304 and is still in flight at timeout29857-29858. T0/T1passed; T2incomplete with367positive/16failed/45no-file-finish(one in flight), Web/T3/T4unexecuted, browsernull. Redactor13cases+nine5/5typed load proofs, corrected closure5, secrets-validation3/signin1/diagnostics6/gateway-secrets14 positive. No classification of all116causes or new secret-leak claim. A-20608 original pre-hold red excerpts/source/raw/native/tree limits retained; no dev comparison/fix at hold. Exacthead/Linuxx64Node24.21 provenance and source/execution trees distinguished. C1unverified, C2failed; prior source clearance insufficient. Coordinator74d5afd1 separately authorized dev control/correction; fresh corrected-head source review required before window. No Reviewer runtime/probe/edit/rerun, no retry/merge/window authority added.

Criteria: C2 failed (Numeric-string preservation regresses and configured consumer verification20454a56/A-20607 timed out124 with116test failures; existing positive seam controls pass but final consumer compatibility is failed/incomplete.).

### impl-1701 · 2026-11-17T04:33:11.579Z

Numeric-string correction committed/pushed3ab6181187dcddac0220ddc7c4725cd9d4ed2c77; fresh source review requested. A-20615 preserves authorized pure dev comparison (12APIassertions green on clean dev20202e0c redactor copy), original red A-20608, corrected candidate redactor14/14, prior-red focused Discord-delete1/1, full discord-api27/27, closure5/5. Local macOS arm64 Node24.21.0, no heavy/native runs. npm run test:lint now completed exit0,122report-only findings,0refusals,closed-wording0. Configured A-20607 remains timeout/failure; no suite retry or dev merge.

### rev-36 · 2026-11-17T04:36:59.846Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1701-source-5
commit: 3ab6181187dcddac0220ddc7c4725cd9d4ed2c77
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0 findings; Spec0 findings. A-20617 resolves A-20613 numeric-string corruption at direct child3ab618118/tree7775fdc22b882e64259aa48b81f8eb78de983fe0; no dev merge, five changed paths. Bare scalar text stays in original raw masking path instead of Number parsing; quoted JSON strings/containers preserve the prior parsed/redacted path. Registered-span/multiline/rotation policies and all13old test bodies unchanged. New pureT1 test covers two above2^53snowflakes/1e3/-0 through text/callable/value. All47manifest hashes independently match pinned bytes, same ordered paths, regenerated redacthash e4f37a1f.... A-20615 candidate14/14,delete1/1,API27/27,closure5/5 and pure dev12assertions reported with candidate/raw/native/tree limits; compiler0 preceded final whitespace-prefix line, redactor/closure followed. Test-lint terminal completion still pending at request, do not infer it from intermediate0refusals output; retain completion before configured window. All90consumer dispositions retained, prior116fail timeout and closure failure stay historical. C1/C2 remain unverified until completed same-head configured evidence/explicit waiver. Require actual14base/10newload and existing Discord/planted-secret/default outcomes. No Reviewer runtime/probe/edit/rerun or merge.

### impl-1701 · 2026-11-17T05:04:50.271Z

Configured run1b87c632/A-20638 exit0 at exact3ab6181187dcddac0220ddc7c4725cd9d4ed2c77: aggregate6550pass,0fail/cancel/skip/todo. T0/T1/T2/Web complete; task fallback allT2, remainingT3batch-deferred,T4not selected. Streaming log check confirms all14named redactor timing outcomes pass and all10new exact-named5/5load proofs. DropletLinuxx64 6.8.0-147-generic,Node24.21.0,Neovim0.12.5,HeadlessShell1248 ChromeForTesting156.0.8078.4. c-8ams3 lifetime1458s/cost$0.1013; lint122 and budgets report-only. Priorfailed A-20591 and timeout A-20607 remain historical. Tree clean, no new actions; final evidence settlement remains with Reviewer.

### rev-36 · 2026-11-17T05:15:34.907Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1701-final-1
commit: 3ab6181187dcddac0220ddc7c4725cd9d4ed2c77
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards0 findings; Spec0 findings. Final same-head run1b87c632/A-20638 at3ab618118 source-clear rev-36-1701-source-5/A-20617 completes T0/T1/allT2/Web exit0. A-20651 independently retains 6550ordinary testpasses/707filepasses,260load-scope testpasses/filepasses,0nonpass/skip/duplicates/unmatched starts. All14current redactor source identities ordinarypass; all10new exact identities each5typed load passes+5/5receipt. All116previously failed test identities and16failed file identities now explicit ordinarypass; priorunfinished discord-messagesfile pass/30cases. Closure47/47pinned hashes match; closure5,bundle3,secrets-validation3,signin1,diagnostics6,gateway-secrets14 pass. All90consumer dispositions retained:33current filepasses,11deferredT3native/scenario,46references. Provenance exacthead/execution tree5d855dee distinct Git tree7775fdc;Linuxx64 droplet Node24.21/Neovim0.12.5;actual isolated HeadlessShell1248/CfT156.0.8078.4. All269T3/17T4 unexecuted, no native/QA/fullperformance claim.122lint/budget/ratchet/skip gates report-only. Historical closure failure/116fail timeout remain failed, not relabelled; existing04:33:11claimant lint completion reconciled. C1/C2 verified. No Reviewer runtime/probe/edit/rerun/merge.

Criteria: C1 verified, C2 verified.
