---
id: T-1596
kind: task
title: Per-host secret admission and revocation
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1590
  - T-1592
topic: topic-1350
branch: t/T-1596-per-host-secret-admission-and-revocation
created: 2026-11-02T03:33:54.494Z
updated: 2026-11-03T01:51:20.699Z
---

## Summary

A per-host secret is never the human. On the Unix spoke edge it admits a spoke hello only with the launch credential of a session whose row is on that host, and that session must hold a role. On the hub socket it admits a host client whose frames must carry that host's session credentials (CLI, hooks, mod bridge); identity-free and human-only frames are refused. `cland host revoke <id>` (human-only) revokes the secret and closes that host's live connections.

Hot files: `hub/src/hub/dispatch.ts` (hello), `hub/src/hub/server.ts` (bearer check), `hub/src/host/host-authority.ts` (new), `hub/src/protocol.ts` (`host.revoke`), `hub/src/cli/host.ts`, `hub/test/host-secret-admission.test.ts` (new)

## Acceptance criteria

- [x] C1. On the Unix spoke edge, a hello with a host's secret and the launch token of a session whose row is on that host is welcomed with the session's role (test).
  - done: impl-1596 · 2026-11-03T00:06:12.595Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.028Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b
- [x] C2. With the same secret, a hello carrying another host's session, a local session, no launch credential, or a session with no role is refused (test).
  - done: impl-1596 · 2026-11-03T00:06:13.038Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.028Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b
- [x] C3. On the hub socket a client hello with a host secret never acts as the human: a frame with no session credential, or a human-only frame such as `role.set` or `session.launch`, is refused as forbidden (test).
  - done: impl-1596 · 2026-11-02T23:52:31.734Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.028Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b
- [x] C4. On the hub socket, a hook, mod-bridge or CLI frame carrying the credential of a session on that host is dispatched as that session (test).
  - done: impl-1596 · 2026-11-02T23:52:32.509Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.029Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b
- [x] C5. `cland host revoke <id>` closes every live connection admitted by that host's secret, later hellos with it are refused with a reason naming revocation, and the request is refused from a session or a host client (test).
  - done: impl-1596 · 2026-11-02T23:52:33.161Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.029Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b
- [x] C6. The project secret's admission on every edge is unchanged, and the hub-socket, spoke-auth and web-authority test files pass with no test edited.
  - done: impl-1596 · 2026-11-03T00:06:13.236Z
  - verified: rev-35 [reviewer] · run rev-35-1596-final-1 · 2026-11-03T00:33:18.029Z · commit dae0b8193cdd293d5180ded578afa4a75712f60b

## Notes

Shared files: `hub/src/hub/dispatch.ts` hello admission (E-1536's T-1571 also edits `dispatch.ts`); `hub/src/cli/host.ts`

## Comments

### impl-1596 · 2026-11-02T23:42:06.859Z

Contract inventory before edits (rule 20): inspected T-1590/T-1592 diffs and item comments plus T-1570/T-1584 authority seams. Admission consumers are server.createWebSocketEdge (daemon/createHub), socket.createSocketEdge, Dispatcher.open (stdio/web/gateway/test peers), core.hello and sessions launchIdentity/credential provisioning; client identity consumers include #asSession, session.signal hooks, session.bridge mod bridge and CLI credential validation. Store.hosts and harness process/session credentials are durable identity sources. Protocol ClientRequest/isClientRequest and web-authority exhaustive table require additive host.revoke migration; CLI host/run/help, shipped implement skill and host-agent docs require updates. Preservation owners: daemon.test.ts (hub-socket), auth.test.ts/spoke auth owner to resolve by search, web-authority.test.ts; Unix edge and session credential tests cover old wire shapes. Searched field/function strings across hub/src including colocated tests, hub/test all tiers, web/nvim/shared, QA and skills; no existing host.revoke producer or persisted reader.

### impl-1596 · 2026-11-02T23:48:06.669Z

Inventory addition: shared/socket-client.ts and hook.ts's raw mod-bridge socket are credential producers, so both now use shared/credential-actor.ts; legacy explicit-as CLAND_LAUNCH_TOKEN projection is retained. Host signal/bridge targets validate the durable row's launch generation as well as session id/name, because Sessions resolves launch owners before names. Snapshot/resume client hello features are denied for host principals to prevent identity-free model streams. shared/wire WorkbenchRequest, web authority exhaustiveness, gateway table enumeration and wire conformance migrate additively for host.revoke; old hello/request shapes stay unchanged. Preservation alias resolution: resilience-component.test.ts is the current spoke-auth owner (named wrong-secret test); daemon.test.ts is hub-socket.

### impl-1596 · 2026-11-02T23:50:54.798Z

Implementation validation on local macOS arm64 / Node 24.21.0 (working tree to be committed unchanged; no browser): new host-secret-admission T2 9/9 passed, including actual CLI credential producer and cland host revoke command, fake bridge receipt and exact native host socket closes; unedited daemon T3 18/18, resilience-component T2 8/8, web-authority T2 46/46 and cli-session-credential T2 9/9 passed. Typecheck passed after final additions. test:lint passed before the last producer test; final lint rerun in progress. Full queued verification has not run; after-stage QA remains with E-1532.

### impl-1596 · 2026-11-02T23:52:21.443Z

Full rule-20 consumer list and migration/unaffected classification are in A-16002 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16002-t-1596-contract-consumer-inventory.txt (132 matched files, including colocated tests, QA briefs and all runtime tiers). Final typecheck and test:lint exit 0; lint reports 0 refusals and existing advisory findings (report-only). Committed/pushed head 75ae97770c7b0f0da5556ddf2299a559c10d6ae9, tree 7e03c215f6387eec72f031da79003fcec99184b1. Pre-first-review fetch/merge origin/dev found already up to date; merge-tree conflict-free. Refreshing native daemon preservation at the committed head before requesting source review.

### rev-35 · 2026-11-02T23:58:15.502Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1596-source-1
commit: 5a51ef06911a6c1cf4a10c3531704f2281802335
scope: full
findings: [{"severity":"high","text":"Host proof checks binding.sessionId but passes the original hello frame to core.hello at1546. After B's spawn settles and before B's first own hello, Sessions' #firstHello fallback resolves B's token to B regardless of a supplied sessionId A; the host/role check therefore passes B. If A already has a live connection and its name is supplied/omitted, core.hello's joining path skips launch-token resolution and joins A. A host with only its own B token can thus act as another host/local session A with A's role. Bind the actual hello to the proved durable identity or reject mismatches before core.hello; add the settled-first-hello/live-foreign-target regression and assert no A delivery/role/connection mutation (rule26/C2).","file":"hub/src/hub/dispatch.ts","line":1528},{"severity":"medium","text":"Host admission requires a running ProcessTable row, but #spawnLaunch publishes that row only after await adapter.spawn and the PID probe. A valid credentialed early hello while spawn/probe is held therefore always fails row lookup, including anonymous first hellos, although the existing launch ownership seam supports them. Carry the admitted host/role in the captured launch proof or publish equivalent provisional durable ownership before the handshake; prove own-host early hello succeeds while cross-host/local/roleless variants remain refused (C1).","file":"hub/src/adapters/sessions.ts","line":123},{"severity":"medium","text":"HOST_USAGE remains frozen to host serve while usage.ts now prepends host revoke. The exact-export T1 compatibility test, aggregate --help test and both native host serve help regressions necessarily disagree. Migrate the independent expected HOST_USAGE block and retain full byte/side-effect assertions; the rule20 inventory missed this consumer (C6).","file":"hub/test/fixtures/cli-usage/commands.json","line":2}]
finding_counts: {"high":1,"medium":2,"low":0}

T-1596 full source review at 5a51ef06911a6c1cf4a10c3531704f2281802335. Branch tip pinned; live claimant impl-1596. Source not clear: one high/two medium unique findings. Reviewer performed read-only source analysis, no runtime reproduction, edits or browser.

## Standards

- High: dispatch.ts1528–1546 validates one durable identity and then admits the caller-supplied original identity. Rule26 requires the identity captured at admission to decide authorization. Full source trace below establishes the mismatch.
- Medium: frozen HOST_USAGE consumer (fixtures/cli-usage/commands.json:2) omitted from migration despite production usage/help edits. Rule20 consumer search must include exact/deep-equal independent fixtures; preservation tests are intentionally strict.

The new host authority module is deny-by-default and is applied after per-frame host/session credential proof, ahead of human user lookup/replay. Human-only host.revoke uses local transport and user-role checks; store revocation precedes tracked peer closes. CLI/hook/bridge credential projection is shared, with old project-secret request shapes retained. Protocol union, web policy, subsystem docs, implement skill and its CHANGES record migrate additively. Role-clause wording stays with the stated T-1610 owner; no separate role grant introduced here. These good boundaries do not cure the high spoke path.

## Spec

High / C2: cross-session join.
1. A is an already-connected role-holding session on local or another host. B is a newly settled running session on f1 whose own first hello has not occurred.
2. f1 authenticates with its host secret and sends a spoke hello carrying B's launch token but A's sessionId, with A's name or no name.
3. Sessions launch lookup at413–415 resolves #firstHello[Btoken].acceptedId to B, without requiring the supplied sessionId equal B. #spawnLaunch sets acceptedId at1262 and removes #launchIdentities at1308 while retaining accepted firstHello until a hello consumes it (427/1304).
4. Dispatcher precheck chooses binding.sessionId B, checks B's f1 row/role and accepts the proof (1527–1532).
5. Dispatcher calls core.hello with the original frame (1546). Core original/joining computation at1410–1412 sees A's live connection and skips launch lookup; the join branch at1431–1442 returns A.
6. Dispatcher checks only the returned role is non-null, so welcomes the host spoke as A. Subsequent spoke handling uses A's connection/role and bypasses host-client per-frame proof.
No runtime exploit was attempted. Fix must bind/refuse the actual admission using the already-proved identity before any core mutation. Regression must cover the accepted-first-hello window, preserve own B positive admission and verify A unchanged, not merely expect a refusal string.

Medium / C1: pending first hello.
hostSession only reads a published running table row. #spawnLaunch awaits adapter.spawn at1210 and native PID proof before table.put at1234. While either await is held, a legitimate own-host first hello has no row and is rejected. The existing launch identity mechanism supports early credentialed admission (unchanged name-reservation.test.ts226 demonstrates that boundary for the existing path), including anonymous identity proof. New test fixture first completes session.launch then edits its row host, so it cannot detect this gap. Use captured launch admission host/role authority, never a requested display name, and keep foreign/roleless negative controls.

Medium / C6: usage.ts adds revoke but frozen HOST_USAGE is still old serve-only text. cli-usage-compatibility.test.ts deep-equals all exports; cli-help.test.ts expands HOST_USAGE for full help and checks both host serve flags against that frozen block. These cannot all pass at this head without migration. Keep assertions intact and author independent updated expectation.

Other inspected paths: host clients authenticate current session credential/host/role per request, canonicalize as to durable identity, restrict human-only/snapshot/resume requests and validate plumbing targets/generation. Revoked state is checked on subsequent frames; known revoked digest produces sanitized refusal. Project-secret matching remains first on each original edge. C3–C5 have source controls, but runtime evidence remains unverified.

Evidence limitations: A-16004 reports local macOS arm64 Node24.21 targeted/static receipts with explicit prior-tree qualifications; no fresh queued/Linux/Web verification exists. Existing daemon/resilience-component/web-authority/CLI-credential tests unedited. New nine tests cover post-launch positives/refusals/CLI plumbing/revocation, but neither pending first hello nor settled-token foreign join. No unrun criterion marked verified.

Fail C1 (valid pending launch proof rejected), C2 (proof/admission identity mismatch), C6 (unmigrated frozen help expectation). Fresh corrected-head source review before verification; do not submit against this head. Standards worst high; Spec worst high; unique findings3.

A-16013: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16013-t-1596-source-review-proved-identity-differs-from-admitted-hello.md

Criteria: C1 failed (Valid early hello during held adapter spawn/PID proof has no published running process row and is refused.), C2 failed (Host precheck can prove B's token while core.hello joins already-connected foreign/local session A from the original unbound frame.), C6 failed (HOST_USAGE changed but the independent frozen expectation was not migrated; exact usage/native help regressions disagree.).

### impl-1596 · 2026-11-03T00:02:26.412Z

Review corrections in progress (A-16013): reproduced settled-first-hello foreign joins as actual 'welcome' !== expected 'error', named and nameless; held-spawn own and anonymous paths actually returned 'error' instead of 'welcome'. Corrections bind the exact proof into core.hello before any core mutation; explicit foreign requested ids/names are refused. Sessions captures host/role on LaunchOwnership at validated admission so pre-row hellos need no display-name authority. The optional core proof argument leaves all prior callers unchanged. Frozen usage consumer hub/test/fixtures/cli-usage/commands.json now independently includes revoke while preserving exact help assertions. Updated boundary tests currently pass 15/15; frozen usage 1/1. No dev merge after first review, no verification submitted.

### rev-35 · 2026-11-03T00:07:55.021Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1596-source-2
commit: dae0b8193cdd293d5180ded578afa4a75712f60b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1596 corrected full source review at dae0b8193cdd293d5180ded578afa4a75712f60b. Branch tip pinned, no dev merge. Source clear, findings[]. All three A-16013 findings resolved.

## Standards

No findings. Host proof and the core mutation now use the same internal LaunchIdentityProof. Dispatcher rejects explicit sessionId/name mismatches before core.hello, canonicalizes the actual hello and passes the original prove closure via an optional internal parameter. This argument is never parsed from frames. Old core callers omit it and retain their prior branch. The proof closure preserves anonymous admission identity rather than performing a second random identity derivation; reconnect uses the committed anonymous owner.

LaunchOwnership now captures validated host/role at launch admission, with one initializer and no persisted shape change. hostLaunch reads this captured proof for pre-row admission; published running rows remain the normal durable check. Neither display names nor requested host fields supply authority. New credential proof still precedes user resolution, replay, permission classification and writes; deny-by-default host policy and revocation remain unchanged.

The independently authored frozen HOST_USAGE now includes revoke. T1 exact export and native full/child help assertions remain unchanged. Inventory addendum in A-16019 covers core.hello/proof/ownership/HOST_USAGE consumers; unchanged daemon, resilience-component, web-authority, name-reservation and CLI-help files verified by pinned diff. No new dependency, role grant or wire caller-supplied proof field.

## Spec

No findings. C1/C2 correction:
- Two settled-first-hello foreign-target cases exercise named and nameless request IDs against a connected foreign/local session. Both require refusal before ownership mutation, then independently preserve A's role, credential inequality, native ping and exact original-spoke delivery receipt, followed by own B positive admission.
- Five held-spawn variants cover own, anonymous (including reconnect identity reuse), foreign-host, local and roleless. The test asserts no process row exists at the handshake, observes the held spawn receipt before triggering hello, then releases and checks final accepted row. Pre-row authority comes from captured launch admission.
- core receives the same proof/prove closure, eliminating the previous precheck-B/join-A split and anonymous second-derivation problem.
C3–C5 prior reviewed credential/client/revocation/producer paths remain unchanged. The host principal never receives human user resolution; request policy still validates current row/session credential and plumbing generation; revocation persists before peer closures and fences future frames.
C6 frozen help consumer migrated; existing project-secret preservation files untouched.

A-16019 retains actual red outputs (foreign join actual welcome versus expected error; own/anonymous pending hello actual error versus expected welcome), then reported local16/16 green plus unchanged-name-reservation75,daemon18,spoke-auth8,web-authority46,CLI-help7,frozen usage1. Artifact explicitly distinguishes final-tree static/host checks from preservation runs at identical production source before final test/doc-only additions. Local macOS arm64 Node24.21,no browser; no queued/Linux/Web pass claimed. Reviewer performed no runtime test/typecheck/lint/browser and made no edits.

C1–C6 remain runtime-unverified pending fresh mode-free verification at this exact source-clear head and required native preservation evidence for deferred files. Final evidence must retain head/tree/platform/executor/browser, exact named host16 and preservation receipts, completed/deferred phases and report-only advisories. QA affected/after-stage remains separate.

Totals: Standards0; Spec0.

A-16021: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16021-t-1596-corrected-source-review-canonical-host-admission-proof.md

### rev-35 · 2026-11-03T00:33:18.029Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1596-final-1
commit: dae0b8193cdd293d5180ded578afa4a75712f60b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, C1–C6 verified. Exact-head uncached 7f6f1c68/A-16043 exit0,4851 pass/zero fail/cancel/skip/todo; independently checked host16,spoke-auth8,web-authority46,frozen usage1,CLI-help7 timing outcomes. C6 daemon18 supplied by A-16044 raw named native output and separate exit0, production-equivalent pre-commit macOS arm64 Node24.21 receipt with explicit ordered source linkage, no execution-time tree hash; not represented as exact-commit or Linux T3 execution. Linux x64 droplet Node24.21/Nvim0.12.5, isolated Headless Shell1248/Chrome for Testing156.0.8078.4; T0/T1/allT2/Web and mapped T4 base completed. T3 deferred to batch,T4 repetitions skipped. Budget/lint/ratchet and skip-reason checks report-only. Source unchanged since clear; no findings. QA affected/after-stage remains separate. Reviewer ran no tests/browser. Detailed provenance and named evidence A-16045: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16045-t-1596-final-evidence-host-admission-and-preserved-project-secret-edges.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### impl-1596 · 2026-11-03T01:22:50.887Z

Authorized post-T-1573 merge completed once: new head 7bcd261b4bdb8a10928acf896999c144a71ea54b, parents dae0b8193 and dev6fbf54121. Only conflict SKILL.md, resolved by preserving both sections; added CHANGES/T-1596-merge-dev.md. No runtime manual resolution. Current source/tree checks: merged host16, unchanged daemon18 (native session93643 exit0 at committed new head), spoke8/web-authority46 and root typecheck pass on local macOS arm64 Node24.21, no browser. Lint in progress. Prior A-16043/A-16045 remain pre-merge receipts; fresh delta review and verification required. Shared origin/dev ref has since advanced to20c4f9511 (T-1624); merge-tree is conflict-free, no second merge taken.

### rev-35 · 2026-11-03T01:25:04.624Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1596-delta-source-1
commit: 7bcd261b4bdb8a10928acf896999c144a71ea54b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta source clear, no findings. Coordinator466bda11 confirmed. Both SKILL sections retained byte-for-byte with CHANGES; combined merge has no manual runtime resolution.12 critical admission/preservation files identical to previously clear dae0b8193, retaining canonical exact proof, captured host/role, host-client session credential policy, revocation ordering and unchanged C6 assertions. Incoming Host delegation/coverage cleanup/Telegram runtime changes require fresh verification; no carry-over claimed. A-16078 local macOS arm64 Node24.21 host16/C6 daemon18+spoke8+web46 and static native exits0 are targeted evidence only; daemon has exact committed head/tree and independent exit receipt. C1–C6 remain runtime-unverified at new head pending fresh mode-free verify. QA affected/after-stage separate. Reviewer ran no tests/browser and made no edits. Detail A-16081: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16081-t-1596-authorized-merge-delta-preserved-admission-and-skill-contracts.md.

### impl-1596 · 2026-11-03T01:51:01.660Z

Post-merge verification cbef7f65/A-16101 passed at unchanged source-reviewed7bcd261b4: exit0,4947 reported pass,zero fail/cancel/skip/todo. Named outcome scan confirms host16/spoke8/web-authority46/help7/usage1 plus merged landing selected tests; A-16078 retained exact-head macOS native daemon18/exit0. Uncached Linux x64 droplet c-8sfo2,Node24.21,Nvim0.12.5,HeadlessShell1248/ChromeForTesting156.0.8078.4; lifetime1430s,cost$0.0993. T0/T1/allT2/Web,selected T3 four files75 identities and mapped T4 guard once complete. Remaining T3 in merge batch,T4 repetitions/after-stage QA deferred; budgets/lint report-only. Final evidence review requested. Fresh fetch/merge-tree conflict-free; no new merge/source edit.
