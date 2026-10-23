---
id: T-1186
kind: task
title: web/README.md and hub/README.md describe the web workbench as built, from a fresh clone to a signed-in browser
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-420
blocked_by: []
topic: topic-920
branch: t/T-1186-web-readme-md-and-hub-readme-md-describe
created: 2026-10-23T21:24:13.481Z
updated: 2026-10-23T22:39:01.441Z
closed: 2026-10-23T22:39:01.441Z
---

## Summary

E-420's C3 needs `web/README.md`, with its tunnel guide, and `hub/README.md` to describe the web workbench as built. A fresh clone must reach a signed-in browser by following them. Four epics changed these files in parallel, so read both end to end against the code at dev and fix what is stale, contradictory or missing.

## What to build

- **The read.** Read `web/README.md` and `hub/README.md`'s web edge sections against dev: the areas, keys, phone frame, notifications, install, tunnel guide, `cland web` options and `[web]` config.
- **The fixes.** Fix every statement the code contradicts. Remove "not yet" and "later ticket" sentences for work that has landed. Make sure the getting-started path, from a fresh clone through `npm install`, `npm run build`, `cland hub start` and `cland web`, is written once and in order.
- **The record.** List each change in the commit message.

## Acceptance criteria

- [x] C1. A sealed test follows the getting-started commands in `web/README.md` in a scratch clone, without starting a real browser, up to a minted `cland web --no-open` link that signs a Headless Shell context in (Web test).
  - done: impl-1186 · 2026-10-23T21:57:09.536Z
  - verified: rev-23 [reviewer] · run rev-20261023-1186-final · 2026-10-23T22:33:13.959Z · commit 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6
- [x] C2. `web/README.md` and `hub/README.md` contain no "not yet", "later ticket", "stand-in" or "pending" sentence about a landed feature, as a grep in the test asserts (test).
  - done: impl-1186 · 2026-10-23T21:57:09.631Z
  - verified: rev-23 [reviewer] · run rev-20261023-1186-final · 2026-10-23T22:33:13.959Z · commit 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6
- [x] C3. Every `cland web` option and `[web]` key the code accepts is described in `hub/README.md`, and every one described is accepted (test).
  - done: impl-1186 · 2026-10-23T21:57:09.795Z
  - verified: rev-23 [reviewer] · run rev-20261023-1186-final · 2026-10-23T22:33:13.959Z · commit 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6

## Comments

### impl-1186 · 2026-10-23T21:29:06.598Z

Read C1–C3 and E-420 C3; test seams are supplied in the assignment. Root install linked. Source audit and first T1 parser/config guards prepared before README edits. Local tests wait for the stage cover/QA reservation to end; no passing or red-run claim yet. Audit artifact posted in the item topic.

### impl-1186 · 2026-10-23T21:57:22.904Z

Implemented in faad5eac; merged Coordinator's dev a6c34f45 before source review, yielding pushed head 26e5c995 / tree 181ba12011b3ef9dfdfb63177d8bf9c9cdc76655. Commit message lists every correction. At exact head local macOS arm64: build, README guards 3/3, sealed README Web 1/1, auth 29/29, tunnel 1/1 and tier lint passed; A-10264 records evidence. Source review assigned through reviewer role. No suite yet; mode-free verification follows clear source. Coordinator retains E-419-demo landing hold.

### rev-23 · 2026-10-23T22:00:02.815Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1186-source
commit: 26e5c995c8dd763bb6ddc57bd1a4145d8f8f34cb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1186 full source review

Head 26e5c995c8dd763bb6ddc57bd1a4145d8f8f34cb; tree 181ba12011b3ef9dfdfb63177d8bf9c9cdc76655. Branch t/T-1186-web-readme-md-and-hub-readme-md-describe. Fixed base a6c34f456020ef42e0d1841c754bcc58c32d093b. Diff command: git diff a6c34f456020ef42e0d1841c754bcc58c32d093b...26e5c995c8dd763bb6ddc57bd1a4145d8f8f34cb. Owned commit faad5eac60f5c58a895ced08a4e915d79fd93a76 plus Coordinator-requested merge of that dev base; seven files, 401 additions/24 removals. Run rev-20261023-1186-source. Clear, findings []; all C1–C3 runtime pending.

## Standards

No findings. Reviewed the README web sections and changes against AGENTS.md, project rules 9/11/12/15–18, docs/agents/tests.md, docs/review-and-qa.md and their shipped owners. No separate CONTRIBUTING.md/CODING_STANDARDS.md found. Crew disables Reviewer subagents; both axes performed here. Fowler baseline considered without independent smell finding. No product behavior, dependencies, wire shapes, permission/role changes. Commit message lists each correction as requested.

T1 source inventories are appropriate: actual parseArgs AST options plus short aliases, actual web config parser/default keys, strict parsing of the documented TOML, and stale feature wording with explicit operational-state controls. Reading source and using the compiler/parser require no process/socket. Tests have matching T1 classification; the startup lifecycle has Web classification and dedicated seam documentation.

The Web test reads and asserts the single literal ordered getting-started block. It copies only owned source/manifests to a disposable seed, excluding generated output; no live Git metadata or tracker/runtime state is copied. Independent local Git init/commit/clone occurs under fixtureEnvironment, synthetic identity, sealed HOME/XDG/Git/provider/account state. The documented npm install is explicitly substituted with the shared root dependency symlink, avoiding registry/browser download; actual build and hub start execute from the clone. This is a stated seam limit, not an actual fresh npm install claim. A real detached hub process is justified because hub-start lifecycle is the subject, rather than replacing an adequate in-process rule test.

Openers and harness binaries are scratch stubs, child commands use bounded execFile with sealed final env, and Headless Shell uses the pinned executable and scratch profile. Browser HTTP and WebSocket routes refuse targets outside the scratch edge. It appends --no-open to the documented web command and asserts no opener receipt. There is no human browser/GUI or external Git/network target execution.

Observers for /auth and WebSocket are armed before navigation; the exact one-time link yields 302, root URL, named project, Live, one HttpOnly/SameSite Strict cookie and spent-link 401. Setup commands, browser setup and DOM/status waits are separately bounded. The test does not treat CLI startup acknowledgement or a socket open alone as completion. Teardown recovers daemon identity from scratch discovery on partial startup, stops/reaps that PID before root removal, and observes browser exit plus an empty owned process group. Shared cleanup orders resources/hub writers before directories. Final assertions and explicit teardown safety deadline remain; no sleep workaround.

Allowance is confined to the new exact Web identity: 5.4 s, E-880 owner, added 2026-10-23/expires 2026-10-30, citing local A-10261 passing 3.579514583 s at parent-plus-working-tree source. About 1.5 times that sample, above the 3.2 s (80% of 4 s) trigger. Coordinator 838c60cd explicitly confirms this allowance. No request/DOM/assertion/cleanup bounds changed. Other manifests only register the two new files; diff check clean.

## Spec

C1 is structurally complete: one ordered fresh-clone path includes npm install, build, checkout-local cland function, hub start and web. Hub overview links it rather than duplicating setup. The sealed local-source clone test follows that sequence with the explicit dependency substitution through actual CLI token sign-in in Headless Shell. Runtime receipt still needed.

C2 is structurally complete: obsolete staged prototype/request-observation and lifecycle wording is removed; areas start with Inbox; open snapshot membership is corrected to open rows and ancestors; full task-delta verdict history remains consistent with the client compatibility path. WebSocket sweep/silence statements match the 30-second sweep/60-second silence owner. Events state now distinguishes local filters from shared hub marks and complete browser summary paging. Artifact deletion is correctly Neovim-only under the web authority table, with web Keep/Archive described. Existing operational pending/stand-in terminology remains legitimate; the guard rejects feature deferrals with positive/negative controls. README phone/notifications/install/tunnel guidance remains intact. Runtime wording guard pending.

C3 is structurally complete: all accepted --no-open, --qr, --sessions, --revoke, --help/-h and no-option behavior, interactions and human-shell boundary are documented. Four optional web keys/defaults/types match parseConfig/defaultConfig: bind, origin, port and dist. Existing origin/port/admission details and restart requirements are preserved. Reload behavior is documented as implemented; runtime fix is separately filed T-1187, outside this docs item. Bidirectional option/alias and key inventories, executable TOML and defaults are tested; runtime evidence pending.

A-10249/61/64 are independently read summary evidence. They distinguish local Darwin arm64 precommit red/green (including initial overbroad wording controls corrected before docs), worst startup 3.579514583 s, and exact merged-head targeted build + T1 3/3, Web 1/1 at 2.944540334 s, auth 29/29, tunnel 1/1 and tier lint. Earlier typecheck/static/test lint passes belong to premerge source; initial lint order/timer-reason failures are disclosed. These summaries do not supply original command stdout/exit captures. Preserve retained originals durably at actual head/working-tree/platform/timing provenance without transcription reruns. No configured suite, load or QA pass is inferred from summaries.

Proceed with mode-free verification at exact 26e5c995, then final runtime C1–C3 settlement and actual identity/load-scope audit. No changed-head run without source review. QA policy none/after-stage, no per-item brief/criteria. Coordinator 838c60cd holds landing until the E-419 demo verdict and says not to merge dev again after verification absent conflict; this review does not waive that hold. Reviewer read-only source/Git/log/hub, no tests, probes, installers, edits, external browsing/network, browser/GUI, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable source review: A-10265.

### rev-23 · 2026-10-23T22:05:10.244Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1186-source-2
commit: b3a6658af2ca1b4c7db35cc2aa54397a536cf08e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1186 authorized documentation delta source review

Head b3a6658af2ca1b4c7db35cc2aa54397a536cf08e; tree 6ef97168d10ab937d069b64f06ff97faa25c6aa7. Branch t/T-1186-web-readme-md-and-hub-readme-md-describe. Fixed point/parent source-cleared 26e5c995c8dd763bb6ddc57bd1a4145d8f8f34cb; diff command git diff 26e5c995c8dd763bb6ddc57bd1a4145d8f8f34cb...b3a6658af2ca1b4c7db35cc2aa54397a536cf08e. Run rev-20261023-1186-source-2. Clear, findings []; all C1–C3 runtime pending. Full review A-10265 carries forward.

## Standards

No findings. Coordinator 1da20a2b-6b1e-4d4a-a25c-47e0e75d56c3 in topic-920 explicitly authorizes this correction and delta review after E-419 demo finding E419D-25 at a6c34f45. Commit names that origin and lists both changes. Only web/README.md and the matching docs/agents/tests.md browser seam paragraph change; no runtime, tests, dependencies, allowance, manifests or role clauses change, and no dev merge. Diff check clean.

Both locations distinguish test evidence from device dogfooding. The existing Badging API stub qualification remains, consistent with rules 16/17. No new fixture resource/tier/cleanup behavior to review; previous lifecycle, sealing and bounded observer audit stands.

## Spec

No findings. Overbroad “real badge/installation checked in full Chromium” prose is replaced by the exact Coordinator disposition: DevTools installability plus one service-worker notification in the full Chromium demo; real badges, installation prompts and standalone windows belong to human device dogfooding. This records the coverage boundary rather than asserting a broader completed QA result. Product support/secure-origin qualifications remain.

Original local logs A-10267 were independently inspected before this delta: 52 original native tool records, verified SHA256 702c172dbd7fff298a6d21026e7c62e38b3fa94862ce7cf9e69cbee0ecbadd76, original truncation preserved. They substantiate corrected red controls, precommit green timings, initial lint failures followed by corrected zero-refusal output, exact 26e5c995 checkpoint and its build/T1 3/Web 1/auth 29/tunnel 1 passes with browser group zero and hub PID reaped. They are correctly parent-head/local Darwin arm64 evidence, not current-head runtime evidence, not reconstructed stdout or reruns.

Admitted configured run 7aa13523-b0fb-4dcd-bdff-eaa23e248698 remains attributed only to parent 26e5c995 and cannot settle current readiness. Capture required current-head checks at their actual provenance, then mode-free verification at b3a6658a after this clearance; final criteria follow its matching receipt. No unchanged-head/cache claim for this changed commit.

QA policy none/after-stage, no per-item brief/criteria. Coordinator's E-419-demo landing hold remains in force; no merge performed or authorized by this verdict. Reviewer read-only source/Git/log/hub, no tests, probes, installers, edits, external browsing/network, browser/GUI, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable source review: A-10269.

### rev-23 · 2026-10-23T22:21:41.204Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1186-source-3
commit: 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1186 allowance delta source review

Head 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6; tree d903e4f6a44b129a7c1ead12a494d612681196c0. Branch t/T-1186-web-readme-md-and-hub-readme-md-describe. Fixed point/parent b3a6658af2ca1b4c7db35cc2aa54397a536cf08e; diff command git diff b3a6658af2ca1b4c7db35cc2aa54397a536cf08e...3f11ee3a4d31a042e443f5e125add59ecb1b7ba6. Run rev-20261023-1186-source-3. Clear, findings []; all C1–C3 runtime pending at replacement head. A-10265/69 source audit carries forward.

## Standards

No findings. Only the exact new README Web identity's duration allowance changes: 5.4 to 11.8 s, preserving E-880 owner and 2026-10-23/2026-10-30 dates. Reason retains original local provenance and adds exact Linux x64 c-8 lon1, four Web workers, parent head b3a6658a, run cafaab89-60d9-4b38-8508-5dc1efe05f22 and A-10276. 11.8 s is about 1.5 times the independently observed 7.858444498 s passing identity, satisfying the launch requirement. No test, assertion, wait, timeout, cleanup, README, dependency, role or other duration entry changes; no dev merge; diff check clean.

This resolves the allowance refresh that held final settlement. The parent configured run was green in report mode, not an assertion failure and not an enforced duration pass. Lead reports duration/tier manifest lint passing. Current-head build/targeted/configured checks remain to be captured before final settlement.

## Spec and evidence attribution

No findings. Independently audited parent A-10276: exit 0, 2784 ordinary test and 417 file finishes all pass, zero fail/skip/cancel. Actual T1 133 files, fallback all hub/Neovim T2 240 files, complete Web 44 files. Separate actual load-gate records establish 15 test/file passes, five per new T1 guard; no Web repetition scope is claimed. The new Web test passes at 7.858444498 s, above the former 5.4 s allowance. Its browser PID-reaped/empty-group and hub-PID-reaped diagnostics are present. No new README tier-tripwire warning; seventeen report-only warnings belong to unchanged tests.

Parent Linux x64 6.8.0-142-generic c-8 lon1 cland-v0-03ff6702, Node24.21.0/Neovim0.12.5, workers2/Web4, lifetime708s/$0.0492. Actual phase walls 66.03/369.66/164.79s, not projections. Full host check passed with zero lint refusals; remote T0 reused candidate tree 0ebc21dc94e1be0689081c6a3d302fb46f5e54e3 (independently a Git tree object), not repeated. Lint132/59 files, duration/ratchet/projection warnings and two missing file baselines remain report-only. T3/T4 not run, T3 deferred periodic/integrated and absent batch tiers. These are parent-head receipts, not replacement-head runtime evidence.

A-10268 original local tool result objects independently read: b3a6658a/tree6ef97168, Darwin arm64, build exit0, T1 guards3/3, Web1/1 at3.006878916s, auth29/29 and tunnel1/1 all exit0, no skips/fails/cancel; browser group0 and hub PID reaped. A-10267 export was already audited with original truncation and source checkpoints preserved. No transcription rerun.

Older 7aa13523/A-10270 at 26e5c995 is cancelled exit143/partial, no completed Web; it never supplies a green task receipt. It remains separately attributed.

Complete required replacement-head checks and mode-free verification after this source clearance, then settle C1–C3 at its matching head. QA policy none/after-stage, no per-item brief/criteria. Coordinator's E-419-demo landing hold remains; review does not authorize merge. Reviewer read-only source/Git/log/hub, no tests, probes, installers, edits, external browsing/network, browser/GUI, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable source review: A-10278.

### rev-23 · 2026-10-23T22:33:13.959Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261023-1186-final
commit: 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1186 final evidence review

Head 3f11ee3a4d31a042e443f5e125add59ecb1b7ba6; complete Git tree d903e4f6a44b129a7c1ead12a494d612681196c0; branch t/T-1186-web-readme-md-and-hub-readme-md-describe. Run rev-20261023-1186-final. Clear, findings []; C1–C3 verified. Full source A-10265 and authorized docs/allowance deltas A-10269/78 carry forward without further source change.

## Standards

No findings. Independently audited current-head configured receipt 8bf33eb7-48c6-477d-a24a-2cd4736a7693 / A-10282: exit 0, 2784 ordinary test finishes and 417 ordinary file finishes all pass, zero fail/skip/cancel. Actual T1 133 files, fallback all hub/Neovim T2 240 files and complete Web 44 files. Separate actual load-gate records establish 15 additional test/file passes: five for each of the three new T1 guards. Generic repetition headers alone are not used; no Web repetition scope is claimed.

Linux x64 6.8.0-142-generic, c-8 lon1 droplet cland-v0-8d98b35c, Node v24.21.0/Neovim v0.12.5, workers2/Web4, lifetime588s/$0.0408. Actual phase walls 53.50/302.65/133.23s. Projections and test-second sums are not phase walls. Full successful host npm run check output includes typecheck/build/static/test lint, zero refusals. Remote T0 reused host candidate tree 6c50b7ce5634428bb73eab13c89d119cc145000c, independently confirmed a Git tree object, and was not repeated remotely. Complete task Git tree is recorded separately above.

Lint132 findings/59 files, durations, ratchet and projected Web wall diagnostics remain report-only; two missing file baselines persist. Seventeen report-only tier-tripwire diagnostics remain in unchanged claude-code-schedule (13), suite-admission-cost (2), connection-snapshot (1) and web-authority (1) tests. No README tripwire diagnostic; no enforced clean-tier claim.

New T1 ordinary samples, seconds: wording0.034425070, CLI inventory0.016338464, config inventory0.004570433. Actual five-repetition maxima respectively0.041465384,0.025526859,0.004354312; historical maximum from parent run remains0.051048883. All below0.4s. New Web startup passes at6.697312405s, within the11.8s dated E-880 allowance. Worst passing historical sample remains7.858444498s on parent b3a6658a/A-10276, the correct basis for about1.5×11.8s. Owner/date/expiry/reason preserved, no assertion/wait/cleanup bound changed; no further allowance refresh needed.

## Spec

C1 established by the current-head passing Web lifecycle: literal ordered README path, independent sealed local source clone, explicit root dependency-symlink substitution for npm install, actual bundle build/detached hub start and CLI-minted --no-open link. Exact auth302, root URL, named project, Live, HttpOnly/SameSite Strict cookie and spent-link401 assertions remain. The run includes owned browser PID-reaped/group-census0 and hub-PID-reaped-before-directory-removal diagnostics. This does not claim registry installation, external clone/network or real GUI/phone execution.

C2 established by passing wording guard plus full source audit: obsolete landed-feature deferrals removed, legitimate operational pending/stand-in terms retained. C3 established by passing parser AST/short-alias and bidirectional config/default inventories and executable documented TOML. Each T1 identity also has five actual load passes.

A-10277 raw current-head local Darwin arm64 result objects independently read: build exit0, T1 guards3/3, Web1/1 at3.050574375s, auth29/29, tunnel1/1, all exit0/no skips/fails/cancel; owned cleanup receipts present. A-10268 belongs to b3a6658a. A-10267 original52-record export/hash/source checkpoints and original truncation remain attributed as audited in A-10269/78. No transcription reruns or repaired-output claim.

Parent cafaab89/A-10276 remains green report-mode runtime at b3a6658a; its larger passing sample required the allowance metadata refresh now reviewed. It was not an assertion failure. Older7aa13523/A-10270 at26e5c995 remains cancelled/partial, no completed Web, not a task pass. Current-head evidence supplies final settlement.

Branch tip/tree independently match the reviewed values. Implementer retains the conflict-only check/report-ready responsibility; no new dev merge or combined-tree test pass is claimed here. Coordinator's explicit landing hold until E-419 demo remains in force; final review clearance does not waive it.

T3/T4 not run at this task occasion; configured T3 deferred to periodic/integrated occasions and absent from batch tiers. QA policy none/after-stage, no per-item brief/qaCriteria; no stage QA claim. Corrected E419D-25 documentation distinguishes DevTools installability/service-worker notification demo from real badge/install-prompt/standalone-window device dogfooding. Reviewer read-only source/log/Git/hub, no tests, probes, installers, edits, external browsing/network, browser/GUI, merge or delegation.

Standards: 0 findings. Spec: 0 findings.

Durable final review: A-10283.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1186 · 2026-10-23T22:33:47.304Z

Ready at 3f11ee3a / tree d903e4f6: final same-head Reviewer verdict rev-20261023-1186-final verifies C1–C3 with no findings (A-10283). Mode-free Linux droplet run 8bf33eb7 passed 2784/2784 ordinary T1/fallback hub+Neovim T2/Web assertions plus actual T1 load 15/15; A-10282. Duration budgets report mode; host gate reused remotely; no T3/T4 receipt. Read-only conflict check after verification against origin/dev 01b93263 passed without changing HEAD (A-10284). Ready reported to Coordinator; claim retained; no merge or enqueue while E-419 demo hold remains.

### coord · 2026-10-23T22:39:01.441Z

Merged 9e83790d1a16c99eba45c39d49e8f7e10b670348 onto dev.
