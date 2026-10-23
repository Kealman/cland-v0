---
id: T-1174
kind: task
title: "The installable app: manifest, icons, badge and the phone sign-in"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: topic-912
branch: t/T-1174-the-installable-app-manifest-icons-badge
created: 2026-10-23T07:00:04.518Z
updated: 2026-10-23T18:11:54.042Z
---

## Summary

The page installs as an app: a manifest named for the project, opening on the inbox, standalone in the panel colour, with 192, 512 and maskable icons and an apple-touch-icon; the app badge carries the needs-you count where the platform has it; the link `cland web --qr` prints signs a phone in.

## Parent

E-419 (§3.6 and §3.7 installing and signing in, P39; choice "The manifest"; the first part of tracer step 6).

## What to build

- **The manifest.** The bundle is shared by every project, so the build emits the fixed fields (`display: standalone`, `id`, `scope`, a start URL the shell reads to open the inbox, the icons) and takes the theme and background colour from the panel token in `tokens.css`, so no colour value lives outside the tokens. The web edge serves `/manifest.webmanifest` with the project's name and short name added. `index.html` links the manifest, an `apple-touch-icon` and a `theme-color` from the same token. The edge's CSP already allows `manifest-src 'self'`.
- **Icons** of 192 and 512 px and a maskable one come from the brand mark under `docs/brand/` (the 512 and 180 px PNGs exist; the 192 and the maskable are rendered once with the tools the repo has, no new dependency) and are committed as PNGs.
- **The start URL** opens the inbox whatever area was saved, then leaves a plain `/` in the address bar.
- **The badge.** Where `navigator.setAppBadge` exists the needs-you count sets it and 0 clears it; elsewhere nothing happens.
- **The phone sign-in.** `cland web --qr` already prints the link and its QR code; this ticket proves that link signs a fresh phone context in with the 30-day cookie. Installability itself and the real badge are QA's demo with the full Chromium build.

## Acceptance criteria

- [x] C1. The edge serves `/manifest.webmanifest` as `application/manifest+json` with the project's name, `display: standalone`, a start URL that opens the inbox, the panel token's colour and icons of 192, 512 and maskable (test).
  - done: impl-1174 · 2026-10-23T17:13:21.933Z
  - verified: rev-23 [reviewer] · run rev-20261023-1174-final · 2026-10-23T17:25:32.420Z · commit bfcc16c99c33fc27925957006514be7b3390950c
- [x] C2. `index.html` links the manifest and an `apple-touch-icon`, every icon the manifest names is served as a PNG of its stated size, and the web typecheck finds no colour outside the tokens (test).
  - done: impl-1174 · 2026-10-23T17:01:12.581Z
  - verified: rev-23 [reviewer] · run rev-20261023-1174-final · 2026-10-23T17:25:32.420Z · commit bfcc16c99c33fc27925957006514be7b3390950c
- [x] C3. Opening the manifest's start URL at 390x844 after the saved area was Sessions opens the inbox (Web test).
  - done: impl-1174 · 2026-10-23T17:01:12.753Z
  - verified: rev-23 [reviewer] · run rev-20261023-1174-final · 2026-10-23T17:25:32.420Z · commit bfcc16c99c33fc27925957006514be7b3390950c
- [x] C4. With `setAppBadge` and `clearAppBadge` stubbed, the badge follows the needs-you count and clears at 0 (Web test).
  - done: impl-1174 · 2026-10-23T17:01:13.027Z
  - verified: rev-23 [reviewer] · run rev-20261023-1174-final · 2026-10-23T17:25:32.420Z · commit bfcc16c99c33fc27925957006514be7b3390950c
- [x] C5. The link `cland web --qr` prints, opened on the edge's loopback address in a fresh 390x844 context, signs it in with the 30-day cookie and opens the inbox (Web test).
  - done: impl-1174 · 2026-10-23T17:01:13.205Z
  - verified: rev-23 [reviewer] · run rev-20261023-1174-final · 2026-10-23T17:25:32.420Z · commit bfcc16c99c33fc27925957006514be7b3390950c

## Comments

### impl-1174 · 2026-10-23T16:59:33.223Z

Test-first slices complete: T2 manifest started red with 404; Web installed entry started red waiting for Inbox; Badging API started red waiting for initial clear. Green targeted samples now cover configured project name, token theme/HTML links/PNG dimensions, saved Sessions -> Inbox -> clean /, actual QR-decoded CLI link -> fresh phone -> fixed 30-day cookie/live socket, badge 0 -> 1 -> 2 -> 1 -> clear, and missing API. Hub/Web typechecks and guards, tier lint and provenance lint pass on local macOS arm64 working tree. Running requested neighbor files before review; real installability/badge remain stage QA.

### rev-23 · 2026-10-23T17:03:17.073Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1174-source
commit: 18e7ddb65802eeec199e5a21169e95b77e5a41e2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1174 full source review
Head18e7ddb65802eeec199e5a21169e95b77e5a41e2 / tree5fb77b98c5923ae168cf1f09892fb5b9ebffa093; fixed base/parent7c04ffe53c0261d45d9b87d9fdb3f3d2126fb78d. Branch t/T-1174-the-installable-app-manifest-icons-badge. Run rev-20261023-1174-source. Clear; findings[]; C1–C5 runtime pending.

## Standards
Pass. Build reads --panel from tokens.css for fixed manifest theme/background and HTML theme meta; no new colour constant or dependency. BrandPNG192/512/maskable512/Apple180 committed; independently read PNG dimensions and confirmed512/180 byte-identical to existing brand assets. Safe maskable80%-centred brand shape documented; no icon render/edit by Reviewer. webSources already hashes public assets/config/tokens; build-stamp/welcome path retained.

Edge manifest handling stays inside existing host/method/path/realpath confinement checks, parses fixed build JSON and serializes configured project name/short_name as JSON, then computes ETag/length from final body. Existing MIME manifest+json/CSPmanifest-src self retained, no authority/auth-boundary change. Daemon passes current project config callback; fallback basename for direct edge clients. No new frame/permission/command/setting. Docs hub/Web/test seam/implement pointer updated; retained skill provenance appends CHANGES through existing metadata pointer, role clause unchanged appropriately. Diff check clean.

Tests retain lowest adequate T2 edge/public sockets and Web isolated rendered behavior, sealed disposable roots/HOME/XDG/Git/accounts and scratch opener stubs; no GUI/tunnel access. Existing browser cleanup waits reaped process/census/hub closure unchanged. No waits expanded or final assertions dropped. QR helper retains prior cliLink=true path, adds only explicit qr option. New Web identity registered sorted, existing web-auth T2 registration unchanged.

## Spec
C1/C2 source: Vite emits id/scope/, standalone, start_url/?area=inbox and192/512any+512maskable PNG descriptors; built HTML links manifest/Apple180 and token theme. Project name injected by edge after confinement. T2 test uses configured Unicode name, checks MIME/fixed fields/token colours/meta/links, PNG signature/dimensions and final-response conditional ETag.
C3 source: inbox launch parameter captured before saved preferences, overrides saved primary area/row/detail and ignores prior phonePage, then replaces URL withplain/. Secondary split preferences kept for desktop restoration. Ordinary saved-area reload remains unchanged. Public Web reads actual manifest start URL after saved Sessions/reload, asserts Inbox/plain/ and subsequent reload.
C4 source: optional setAppBadge on authoritative known count; zero clears, missing API no-op, rejected platform promise caught. Stubs installed before navigation and public fake asks/answers prove clear→1→2→1→clear; missing API case preserves livecount without pageerror. No actual platform install/badge claim.
C5 source: real executable cland web --qr in sealed scratch environment, QR decoded against printed synthetic-originlink; exact path/token redeemed at fixture loopback percriterion. Fresh390x844touch/mobile signed-out context observes authresponse before navigation, fixed Max-Age2592000/HttpOnly/SameSiteStrict and expiry range, plainroot/Inbox plus authenticated Live socket. No external tunnel/realphone/cross-originHTTPS proof claimed; platform installation demo remains QA.

A-10114 is source-as-committed/local Darwinarm64 Node24.21 evidence map; A-10113 raw targeted61/61 pass/0fail/skip/cancel and clean owned-browser censuses verified. Targeted build/Hub+Web typechecks/guards/tier/provenance/static checks reported pass. New local samples T2max0.325s/Webmax0.695s below launch tier80% allowance thresholds, no enforced gate claimed in targeted invocation. Original reds manifest404/installedInboxmissing/badgeclear missing retained in implementation records. No configured exact-head/Linux/T3/load receipt yet; preserve raw receipts and provenance without transcription reruns.

Proceed with mode-free verify at exact18e7ddb6; final criteria await same-head configured result and audit new passing timing thresholds. Reviewer read-only Git/files/PNGs-as-data/hub, no tests/live browser/GUI/edits/merge. Per-item QA criteria/brief absent; affected after-stage real installability/badge QA separate. Standards0; Spec0.

### impl-1174 · 2026-10-23T17:12:31.154Z

Verification ee3291eb at 18e7ddb6 failed on Linux x64 droplet (A-10127): web-edge.test.ts:103 `/manifest.webmanifest`, `500 !== 200`; Web phase did not run. Reproduced exact assertion locally before fix. Its synthetic bundle wrote literal `fixture` as the manifest; endpoint now expects JSON. bfcc16c99c33fc27925957006514be7b3390950c updates only that fixture to a valid JSON template, preserving all existing header/cache/revalidation assertions. Local Darwin arm64 targeted web-edge+web-auth: 37/37, no skips, A-10128. No dev merge after initial review. Linux new T2 identity base .233s, 5/5 load samples worst .264s; below1.6s allowance threshold. New Web identities await completed Linux receipt.

### impl-1174 · 2026-10-23T17:12:41.592Z

Evidence-link correction to previous comment: fixture-fix targeted 37/37 log is A-10129, `/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-10129-t-1174-json-fixture-correction-targeted-t2-37-37.log`; A-10128 was a transcription error.

### rev-23 · 2026-10-23T17:13:13.056Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261023-1174-evidence-red
commit: 18e7ddb65802eeec199e5a21169e95b77e5a41e2
scope: evidence
findings: [{"severity":"medium","text":"Existing fixture writes literal fixture as manifest template, incompatible with new JSON injection. Configured edge test fails500vs200; use valid synthetic JSON retaining all header/cache/ETag assertions.","file":"hub/test/web-edge.test.ts","line":68}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1174 failed evidence at18e7ddb65802eeec199e5a21169e95b77e5a41e2
Run rev-20261023-1174-evidence-red. Not clear, C1 failed for affected manifest fixture integration.

Actual A-10127:11949–11953 `AssertionError [ERR_ASSERTION]: /manifest.webmanifest`, `500 !==200`, hub/test/web-edge.test.ts:103. Fixture at68 writes literal `fixture` for manifest.webmanifest; new confined endpoint parses its build template as JSON. This branch's synthetic manifest must become valid JSON while preserving header/cache/ETag assertions; production parsing need not accept malformed manifests. This is affected test migration, not classified as a shared defect.

Configured mode-free ee3291eb-2207-4f76-87c6-7e5265ca5e03 exit1. Raw ordinary records2153test passes/1failure,329file passes/1failure. T1 exit0; T2 hub phase fails, Neovim/Web not executed; full fallback T2 was selected, not fully completed. T3/T4 absent/deferred task policy. Separate actual new T2 load-gate5/5pass plus basepass, not inferred from header: manifest samples0.233208096base and0.212046757/0.215663706/0.263873613/0.210407566/0.201515302load, max<1.6s threshold. No Linux Web sample, no passing suite claim. Generic budgets/lint/ratchet report-only; no new duration allowance justified.

Linux x64 c-8 lon1 cland-v0-18bdf6ae, Node24.21.0/Neovim0.12.5, workers2; lifetime431s/$0.0299. Host gatebd7efbe97e055cedcf3861fb88ec6c2f03872984 reused, not repeated remotely. Actual T1 59.87s/T2phase274.02s, not projected estimates. C2–C5 final verification pending. Source clearance retained historically; new head needs fresh source review before verify. Reviewer read-only logs/source/hub, no tests/edits/browser/merge. Real install/badge QA remains after-stage.

Criteria: C1 failed (Configured manifest edge integration fails500vs200 because existing fixture writes non-JSON template; migrate fixture and reverify after new source review.).

### rev-23 · 2026-10-23T17:13:36.748Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1174-source-2
commit: bfcc16c99c33fc27925957006514be7b3390950c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1174 corrected source review
Head bfcc16c99c33fc27925957006514be7b3390950c / treec04b4a742b294cbcfd56cfc1ed0dc1fb422b90a7; parent/fixed point18e7ddb65802eeec199e5a21169e95b77e5a41e2. Run rev-20261023-1174-source-2. Clear; findings[]; C1–C5 runtime pending.

## Standards
Pass. Only synthetic fixtureBundle in hub/test/web-edge.test.ts changes: manifest now JSON.stringify({display:'standalone'}); sw/icon byte fixtures unchanged. Every existing status/header/cache/ETag/304/HEAD/confinement assertion retained, no timeout/product/docs/dev change. Diff check clean. Prior full source audit A-10116 carries forward.

## Spec
Affected fixture integration finding A-10130 resolved: valid manifest JSON can be project-name-injected by shipped edge, while malformed actual templates still return500 as before. T2 test's subject remains header/revalidation/immutableasset behavior. Real build manifest fields/theme/icons are independently tested in web-auth. C1 done needs refresh after historical failed-evidence mark; all final criteria await new-head receipt. Historical ee3291eb/A-10127 remains failed at18e7ddb6 with no Neovim/Web execution; base+actual5/5 T2manifest samples there are supporting coverage only, not green suite evidence.

A-10129 corrected evidence link verified: raw local Darwinarm64 targeted web-edge+web-auth37/37 pass/0fail/skip/cancel, duration_ms2835.999375 wholeprocess; no configured/new-head Linux claim. Request's A-10128 reference was corrected and is not used. No new source identity/bounds/allowance; Linux Web still unobserved. Preserve original receipts, no transcription reruns.

Proceed with mode-free verify at exactbfcc16c9 after C1 done refresh. Audit new passing tier80% samples from actual receipts before final settlement. Reviewer read-only Git/files/log/hub, no tests/browser/GUI/edits/merge. Real installation/badge after-stage QA separate. Standards0; Spec0.

### rev-23 · 2026-10-23T17:25:32.420Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1174-final
commit: bfcc16c99c33fc27925957006514be7b3390950c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1174 final evidence review
Headbfcc16c99c33fc27925957006514be7b3390950c / treec04b4a742b294cbcfd56cfc1ed0dc1fb422b90a7. Run rev-20261023-1174-final. Clear; findings[]; C1–C5 verified.

## Standards
Source audits A-10116/A-10131 carry forward, branch/tree and hub verify head match. Fresh configured mode-free1fc42b17-8fde-4dd6-8b1b-15b7595bb20d/A-10136 exits0. Raw ordinary finish records2740tests/407files all pass; separate actual load-gate5tests/5files pass for new T2manifest identity. No fail/skip/cancel. Actual T1(132files), fallback all hub+Neovim T2(239files), complete Web(36files) exit0. No T3/T4; configured task policy defers T3, no integrated claim. Five T2 repetitions are explicit scope records, not inferred headers; no Web load repetitions claimed.

Linux x64 c-8 lon1 cland-v0-4faed75d, Node24.21.0/Neovim0.12.5, workers2/Web4; lifetime572s/$0.0397. Host gate417a8f1117229396f9c1f16f7164579f6a6d8f0e reused, not repeated remotely. Actual phases T1 49.80s/T2 315.08s/Web119.41s; per-test sums/projections are not observed phase wall. Generic duration/lint/ratchet and existing out-of-scope tier diagnostics remain report-only (132lint findings59files,1missing file baseline), retained overages not claimed resolved. New T2base.182562247s and load max.238614822s, all-platform reported worst.325s local<1.6s. Four Web samples2.353678651/1.068612041/1.094724997/.787296517s all<3.2s. No new allowance triggered.

## Spec
C1/C2 verified: project-named manifest MIME/fixed fields/token theme and background; HTML manifest/Apple/theme links;192/512/maskable512/Apple180 PNG signature/dimensions; final injected JSON ETag/304. Existing synthetic edge fixture now valid JSON and full header/cache assertions pass, resolving historical integration finding.
C3 verified: actual start URL after saved Sessions opens Inbox, clears selection/phone page and consumes parameter to plain/, with ordinary reload persistence retained.
C4 verified: stubbed badging follows clear→1→2→1→clear from public asks/answers; missing API leaves livecount without errors. Real OS badge not claimed.
C5 verified: actual executable QR link decoded, exact token/path redeemed on scratch loopback by fresh390x844touch/mobile context; observed30day HttpOnly/SameSiteStrict cookie/expiry and live authenticated socket/Inbox/plain/. No tunnel/realphone/actual installation claim.

A-10127 old18e7ddb6 remains failed (manifest fixture500vs200, partial T2/noWeb) perA-10130, not used as green evidence. Earlier local targeted logs retain source-as-committed provenance; new receipt provides current Linux coverage. Implementer reports docs/agents/tests.md merge-tree conflict againstdevdd2aab60 and no source change; this verdict covers currentbfcc head only. Any authorized merge/change needs fresh source review and exact-head verification.

Reviewer read-only existing source/log/hub, no tests/browser/GUI/edits/merge. Real installability/badges remain affected after-stage QA; no per-item QA criteria/brief. Standards0; Spec0.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-1174 · 2026-10-23T18:10:38.094Z

Coordinator-authorized post-review dev integration completed at 0da55df800c063397b1e3e6ed9706a0b8d48413c, tree5c8f7effd5f4d698e69ce9010a40af2724126b81; pushed origin. Incorporates origin/dev a84547b8 (T-1168, T-1170, T-1169), after instructed hold. Conflict resolution keeps all tests.md seam paragraphs verbatim, README Phone topic thread under Phone plus dedicated Installable app section, and Shell phonePage Topics union together with inboxLaunch reset. No other install-source edits. Fresh local Darwin arm64/Node24.21.0 build + full root typecheck/guards passed; web-auth/web-edge/allphone*/shell/smoke targeted87/87,0fail/skip/cancel; asks/thread/approvals each once. Raw A-10166. Previous bfcc16c9 Linux suite/final verdict are historical; new merge head needs delta review then mode-free verify.

### rev-23 · 2026-10-23T18:11:54.042Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1174-source-3
commit: 0da55df800c063397b1e3e6ed9706a0b8d48413c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1174 merged-head delta source review
Head 0da55df800c063397b1e3e6ed9706a0b8d48413c; tree 5c8f7effd5f4d698e69ce9010a40af2724126b81. Branch t/T-1174-the-installable-app-manifest-icons-badge. Fixed prior final-clear bfcc16c99c33fc27925957006514be7b3390950c; incoming dev a84547b85220e6bf49981382198ef875e4b7afa7. Merge chain cad436b3 then0da55df8. Run rev-20261023-1174-source-3. Clear; findings []; all C1–C5 current-head runtime pending. Prior final A-10138 remains historical.

Coordinator authorizations independently read in topic-912:5d525993 merge dd2aab60;4be0d7fa/3b33ebe2 hold for lane order, keep already-made commit;9393df81 now merge a84547b8 after T-1170/T-1169 land, preserve paragraphs, build/typecheck and required targeted files, then delta review/verify. No unauthorized post-review dev merge.

## Standards
No findings. Exact install/approvals/thread/asks/inbox Web-phase seam paragraphs survive byte-for-byte against their originating parents. README retains Phone topic thread under Phone and independent Installable app section; related upstream phone ask/approval help and hub README remain. Tier manifest includes each new phone file once. Diff check clean.

Own install files unchanged from bfcc16c9: Vite manifest generation, HTML links, PNG icons, daemon project-name callback/web-edge manifest response, web-auth manifest test, corrected valid-JSON web-edge fixture, QR harness and phone-install cases. Earlier A-10116/A-10131/A-10138 audits carry forward. Upstream ask/approval/thread sources are incoming dev, without new branch-local changes except integration in Shell and docs resolutions.

## Spec
No findings in merge. Shell phonePage state/popstate/open supports Items|Artifacts|Topics while initializer retains inboxLaunch ? undefined; savedShell(inboxLaunch) resets primary area/row/detail and URL replacement remains. Thus installed entry wins over saved Sessions/phone page without dropping full-screen Topics navigation and Back. Shared sheet dispatcher still consumes sheet actions before phone-page dismissal. Needs-you Badging API effect is unchanged and uses known authoritative counts/optional API/error catch. T-1170 covered-thread reading fix and shared run/artifact layout arrive with upstream; ask and approval sheets remain via shared card modules.

A-10166 original raw targeted log inspected:87/87, zero fail/cancel/skip, clean owned browser censuses; manifest67.646750ms, QR345.099ms, badge330.134416ms, missingAPI279.969333ms. All requested phone ask/thread/approval identities present once along with web-auth/web-edge/shell/smoke and phone-install cases. Request reports fresh local Darwinarm64 Node24.21.0 isolated pinned Headless Shell build/root typecheck/static guards exit0 at merge tree. Raw targeted stdout has no standalone per-command exit/source metadata; no stronger attribution inferred. Local targeted receipt is not configured/Linux/current-head suite evidence. New local passing samples below prescribed thresholds, no allowance triggered.

Proceed with mode-free verification at exact0da55df8, followed by fresh final C1–C5 settlement and actual passing new-identity samples. bfcc16c9 green receipt stays prior-head only. Preserve original stdout/exits/timings/head attribution without transcription reruns. Reviewer read-only Git/files/log/hub; no tests/probes/live browser/GUI/edits/merge/delegation. Real platform installability/badge remain after-stage QA, no per-item brief/qaCriteria.
Standards:0 findings. Spec:0 findings.
