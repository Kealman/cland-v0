---
id: T-1568
kind: task
title: Passkeys on the invite and sign-in pages
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1536
blocked_by:
  - T-1559
  - T-1567
topic: topic-1341
branch: t/T-1568-passkeys-on-the-invite-and-sign-in-pages
created: 2026-10-31T23:47:52.450Z
updated: 2026-11-02T15:50:09.116Z
closed: 2026-11-02T15:50:09.116Z
---

## Summary

The invite page offers a passkey first and a password as the fallback. The sign-in page offers passkey sign-in. Challenges are single-use and short-lived, and the hub checks them with L02's module. Only public keys and counters are stored. Tests drive headless Chromium with Chromium's virtual authenticator, so no new dependency is needed.

Hot files: `hub/src/hub/web-signin.ts`, `hub/src/hub/store.ts` [Host] or `users.ts` (a `passkeys` table: user id, credential id, public key, counter), `web/src/SignIn.tsx`, web tests with a CDP virtual authenticator.

## Acceptance criteria

- [x] C1. In headless Chromium with a virtual authenticator, an invited user registers a passkey on the invite page and is signed in, and the invite is consumed.
  - done: impl-1568 · 2026-11-02T14:11:29.038Z
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
- [x] C2. That user signs in again with the passkey from a fresh browser context on the sign-in page.
  - done: impl-1568 · 2026-11-02T14:11:29.182Z
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
- [x] C3. A replayed assertion, a challenge used twice or past its lifetime, and an assertion for another user's credential are refused.
  - done: impl-1568 · 2026-11-02T14:11:29.297Z
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
- [x] C4. `hub.db` holds only the credential id, public key and counter of a passkey, and no frame, log line or journal record carries a challenge response.
  - done: impl-1568 · 2026-11-02T14:11:29.531Z
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
- [x] C5. Where WebAuthn is unavailable, the invite page offers only the password and says so in a tooltip.
  - done: impl-1568 · 2026-11-02T14:11:29.648Z
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
- [x] C6. `package.json` and the lockfiles are unchanged.
  - done: impl-1568 · 2026-11-02T14:11:29.773Z
  - verified: rev-35 [reviewer] · run rev-35-1568-source-1 · 2026-11-02T14:16:01.903Z · commit fd62c7acd4d1318934fc2e31d7d77a8e8d8a048e
  - verified: rev-35 [reviewer] · run rev-35-1568-source-2 · 2026-11-02T14:23:07.427Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc
  - verified: rev-35 [reviewer] · run rev-35-1568-final-1 · 2026-11-02T14:44:33.813Z · commit 188081c8656cb5560369361aca6ccd9391e44bcc

## Comments

### impl-1568 · 2026-11-02T14:01:56.070Z

Rule 20 inventory: searched passkey/WebAuthn/verifyRegistration/verifyAssertion/createWebSignIn/registerPassword/user_passwords/SignIn and HTTP routes across hub, web, nvim, shared, docs, skills, QA and all test tiers. Consumers: web-edge owns createWebSignIn and shared cookie issuance; Users owns credentials/invite transaction; SignIn consumes HTTP. Existing web-auth/web-authority/web-signin/passwords/webauthn and web/signin/connection/phone-disconnected tests retain prior APIs/wire shape; QA sign-in fixtures retain password/link contracts. New HTTP routes and passkeys table only, no frame changes. Seams authorized by brief: isolated Headless Shell CDP virtual authenticator + public HTTP; persisted DB and log/journal observations specifically required by C4. Existing password and link tests will stay unedited.

### impl-1568 · 2026-11-02T14:07:25.363Z

Interface note for T-1624/tunnel consumers (Coordinator decision 7c5514bf): users mode, no configured HTTPS origin: GET /invite and /signin on Host 127.0.0.1:<port> return302 to http://localhost:<same port><same path/query> with no-store and no-referrer. Edge Host allow-list already accepts localhost. Browser stays on localhost after cookie issuance; no cross-host cookies. Exact-Origin API checks reject 127↔localhost in both directions. Single mode and printed cland web link flow unchanged. CDP browser navigation and native fetch localhost-resolution receipts are in passkeys.test.ts.

### rev-35 · 2026-11-02T14:16:01.903Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1568-source-1
commit: fd62c7acd4d1318934fc2e31d7d77a8e8d8a048e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1568 source review at fd62c7acd4d1318934fc2e31d7d77a8e8d8a048e
Scope: full. Request fc6393ef-4093-465b-9019-cfbc6bf5c424 from live claimant impl-1568.

Standards: no findings. Reviewed the complete branch diff, Users transaction boundaries, existing byte verifier and cookie helper, web edge admission, new Web tests and tier entry, README and kept skill change record. Rule 20 consumer inventory and redirect interface note are present. No package.json or lockfile changes.

Spec: no findings. Challenges are volatile, capped, expire after two minutes, capture user/origin/ceremony, and are deleted before finish validation. Existing verification checks signed challenge/origin/RP and credential signature/counter; sign-in looks up the credential under captured user identity. Registration saves only public credential facts and commits invite spend, activation and session together. Password fallback and unavailable tooltip are implemented. Coordinator decision 7c5514bf authorizes the narrowly scoped users-mode localhost redirect; exact-Origin APIs retain cross-host refusals.

Test source: isolated Headless Shell CDP virtual authenticators, fresh context sign-in, durable Profile/invite receipts, replay/failed-attempt reuse/expiry/other-user controls, public-only storage and response sentinel observations, localhost resolution and redirect headers, unavailable-password fallback. Shared fixture clock reaches both contexts. Existing password, link, connection and phone regressions remain unedited.

Criteria: C6 verified by source diff. C1–C5 remain unverified pending post-source-clear queued evidence at this exact head. Local reports in A-15863 are supplementary, not a queued suite pass. No tests or browser were run by Reviewer. QA remains affected/after-stage.

Criteria: C6 verified.

### rev-35 · 2026-11-02T14:22:32.934Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1568-evidence-1
commit: fd62c7acd4d1318934fc2e31d7d77a8e8d8a048e
scope: evidence
findings: [{"severity":"medium","text":"New per-test guide is absent from docs/agents/tests/index.md; the unchanged T1 membership assertion fails and stops queued verification before T2/Web.","file":"docs/agents/tests/web-test-passkeys.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1568 evidence review at fd62c7acd4d1318934fc2e31d7d77a8e8d8a048e: not clear.
Run a9fe7430-0635-411d-ac8a-b87692975af0, durable log A-15865.

Actual failure: "AssertionError [ERR_ASSERTION]: each per-test document must be indexed exactly once"; expected list contains web-test-passkeys.test.ts.md, absent from the actual index (A-15865 lines 8343–8363).

Medium — docs/agents/tests/web-test-passkeys.test.ts.md:1: The new guide has no entry in docs/agents/tests/index.md, so the unchanged required test-docs membership assertion fails and verification stops before T2/Web. Add its index row through the shared generator, retaining the test assertion.

Standards: one medium documentation integration finding. Spec: runtime behavior remains unverified by this failed queued run; no passkey failure was executed. C1–C5 remain unverified; C6's source mark remains. No criterion behavior is marked failed solely because its phase was unexecuted.

Provenance: exact reviewed head, Linux x64 6.8.0-142-generic droplet c-8 sfo2, Node v24.21.0, Neovim v0.12.5. T0 exit 0; T1 exit 1 (1333 pass / 1 fail / zero skipped or cancelled in tier output). T2/Web unexecuted; remaining T3 deferred and no T4 execution. No queued browser execution claimed. Host typecheck at tree 14d04043bee05c2305374699fa9a6e32b1f491de was not repeated remotely. Budget/lint notices remain report-only. Fix requires fresh exact-head source review before another queued run; no full task suite requested.

### impl-1568 · 2026-11-02T14:22:48.742Z

Fixed failed run a9fe7430/A-15865 own omission at new head188081c8656cb5560369361aca6ccd9391e44bcc: generator adds exactly one docs/agents/tests/index.md row for the passkey guide. No runtime/test/guide contents changed; no dev merge. Local macOS arm64 Node24.21.0 node --test hub/test/test-docs.test.ts reproduced exact missing-index assertion before fix (3pass/1fail), then4/4pass after generation (0.123s). Failed queued run was T0 pass, T1 failed; T2/Web unexecuted, not browser evidence. Fresh source review requested before re-verification.

### rev-35 · 2026-11-02T14:23:07.427Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1568-source-2
commit: 188081c8656cb5560369361aca6ccd9391e44bcc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1568 source re-review at 188081c8656cb5560369361aca6ccd9391e44bcc, full scope with unchanged source carried from rev-35-1568-source-1 / A-15864.

Standards: no findings. The complete fd62c7acd→188081c865 diff is one generated index row at docs/agents/tests/index.md:393. Its test link, guide link and guide heading agree, and both targets exist. It resolves the medium membership finding in rev-35-1568-evidence-1 / A-15866. No assertion was changed.

Spec: no findings. Parent is exactly fd62c7acd; runtime code, tests, dependencies and lockfiles are unchanged. Prior full source reasoning remains applicable. C6 verified at this new head. C1–C5 remain unverified until a fresh post-source-clear queued result at this head establishes the named runtime outcomes. A-15865 remains failed partial history (T0 pass, T1 fail, T2/Web unexecuted), not carried as passing evidence. Local test-docs red/green is reported by Implementer; Reviewer ran no tests. QA remains affected/after-stage.

Criteria: C6 verified.

### rev-35 · 2026-11-02T14:44:33.813Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1568-final-1
commit: 188081c8656cb5560369361aca6ccd9391e44bcc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1568 final evidence at 188081c8656cb5560369361aca6ccd9391e44bcc. Scope: evidence. Source clear rev-35-1568-source-2 / A-15867 remains applicable; branch tip equals the reviewed head.

Standards: no findings. Spec: no findings. C1–C6 verified.

Independently streamed actual named outcomes in A-15874:
- web/test/passkeys.test.ts: both cases pass. The registration/fresh-context case executes virtual-authenticator creation, authenticated Profile and consumed-invite receipts (C1), fresh context assertion sign-in (C2), replay/failed-attempt reuse/other-user credential/expired challenge refusals without cookies (C3), exact public-only storage columns/key/counter plus challenge-response sentinels against frames/logs/journal/database (C4), and authorized redirect/localhost resolution/both cross-host Origin refusals. The unavailable-WebAuthn case proves absent passkey button, availability tooltip and successful password fallback (C5).
- Unedited preservation: hub web-signin 3, web-auth 29, Web signin 2, phone-disconnected 3 pass. Connection has one outer pass and all three nested finish/pass receipts: printed link and reconnect, older bundle reload, protocol refusal.
- Existing byte verifier 11 pass. Test-docs 4 pass, including the exact index membership assertion that failed in A-15865.
- C6 was established by source diff at this head: package.json and lockfiles unchanged.

Queued run beabd97e-89d5-46b7-8b19-9327c48dd847 / A-15874: exit 0, 4757 pass, zero fail/cancel/skip/todo. T0/T1/fallback all T2/Web completed; T3 deferred to merge batch and T4 unexecuted. This is task verification, not full merge-batch coverage.

Recorded provenance: tree 33dbe2641e3c13a129e7c5d854d0bc9d584f40b3, uncached droplet c-8 sfo2, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5. Isolated Chrome Headless Shell binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing 156.0.8078.4. Host typecheck used that tree and was not repeated remotely. Budget/lint/skip-reason checks report-only; skips [] / missing reason count 0. Executor lifetime 1186 s and $0.0824 are billing facts, not suite wall time. Projections are not execution evidence.

A-15865 remains failed partial history, resolved by the source-reviewed index correction and fresh evidence above. QA affected/after-stage. Reviewer ran no tests/browser and made no edits.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-11-02T15:50:09.116Z

Merged fd9eb8edf1352542e9472aa7e6bef77a5054ad68 onto dev.
