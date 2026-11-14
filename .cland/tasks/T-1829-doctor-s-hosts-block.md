---
id: T-1829
kind: task
title: Doctor's hosts block
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1828
topic: topic-1509
branch: t/T-1829-doctor-s-hosts-block
created: 2026-11-12T10:07:21.390Z
updated: 2026-11-14T15:51:58.972Z
closed: 2026-11-14T15:51:58.972Z
---

## Summary

`cland doctor` gains a hosts block. It checks the provider token's presence and fingerprint, each pool's image against its key, the free logins per pool and harness, the signed-out logins, the hosts' reachability and the hosts' spend against the sub-cap. Each `warn` names its fix. Doctor makes no provider or paid call.

## What to build

A hosts check module beside the remote checks, in doctor's `ok`, `warn` and `fail` shape, with `--json`:
- **Token.** For each provider that a pool uses, its presence and fingerprint from T-1828, read from the running hub. An absent token is `warn`, with the fix naming `DIGITALOCEAN_TOKEN` in the hub's environment and a hub restart.
- **Pool images.** For each pool, its image record against the key computed locally, as `cland host prepare` computes it. A stale image is `warn`, naming the changed parts, with `cland host prepare <pool>`; an absent image is `warn` too.
- **Free logins.** The free logins per pool and harness, for the harnesses of the roles placed on the pool. Zero free is `warn`, with `cland login add <harness> --pool <pool>`.
- **Signed-out logins.** One `warn` per signed-out login, with `cland login signin <name>`.
- **Reachability.** Each live host, `ok` when ready, or `warn` with its outage start and the fix, `cland host stop <id>`, or `cland host destroy <id>` for a host the hub cannot reach.
- **Spend.** Today's hosts spend against `[hosts] daily_spend_usd`. From 80 % it is `warn`, with `cland config set hosts.daily_spend_usd <n>`.

Without a running hub, the hub-backed lines read "hub not running" with `cland hub start` (question 17). A project with no pool prints one `ok` line, "no host pool".

## Acceptance criteria

- [x] C1. With the token unset, doctor's token line for a `digitalocean` pool is `warn` with a fix naming `DIGITALOCEAN_TOKEN` in the hub's environment; with a made-up token it is `ok` with its fingerprint, and the value is in neither the text nor the `--json` output (test).
  - done: impl-1829 · 2026-11-14T14:32:39.637Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
- [x] C2. A pool image whose key no longer matches, after a changed lock file, reads `warn` with the changed parts and `cland host prepare <pool>` (test).
  - done: impl-1829 · 2026-11-14T14:32:39.863Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
- [x] C3. The free logins per pool and harness are listed, and a placed role's harness with no free login reads `warn` with `cland login add <harness> --pool <pool>` (test).
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
  - done: impl-1829 · 2026-11-14T15:12:11.992Z
- [x] C4. A signed-out login reads `warn` with `cland login signin <name>`, and an unreachable fake host reads `warn` with its outage start and its fix (test).
  - done: impl-1829 · 2026-11-14T14:32:40.421Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
- [x] C5. Today's hosts spend reads against `[hosts] daily_spend_usd`, and is `warn` with its fix from 80 % of it (test).
  - done: impl-1829 · 2026-11-14T14:32:40.764Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
- [x] C6. During a doctor run the fake DigitalOcean API records no request and no host is created (test).
  - done: impl-1829 · 2026-11-14T14:32:40.979Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9
- [x] C7. Without a running hub the hub-backed lines read "hub not running" with `cland hub start`, and a project with no pool prints one `ok` line (test).
  - done: impl-1829 · 2026-11-14T14:32:41.317Z
  - verified: rev-35 [reviewer] · run rev-35-1829-final-1 · 2026-11-14T15:12:02.548Z · commit c42b234b6a3f36ecb5a6f7683b741d36d10671b9

## Blocked by

- T-1828

## Notes

- Hot files: `hub/src/doctor/hosts.ts` (new), `hub/src/cli/doctor.ts` (the check list).
- Tests: new `hub/test/doctor-hosts.test.ts` (T2, `projectHub`, the fake DigitalOcean API with a request log for the token and image lines, the fake host provider and the fake harness binaries for the login and host lines, seeded spend ledger), after `hub/test/doctor-remotes.test.ts`.
- Serves epic C4.

## Comments

### impl-1829 · 2026-11-14T14:23:52.182Z

Consumer sweep before edits: doctor rows retain Check and {root,version,checks,summary}; CLI runDoctor/report, setup (uses requirements only), doctor fixtures and doctor*.test.ts, CLI usage fixtures/help tests, remote-discovery tests and QA E-1532 stage 3/6 inspect named rows, not totals. Neovim/web have no doctor row parser. host.status consumers: CLI host.ts, host-status.test.ts (deep-equal ready row), pool-spend-cap.test.ts, login-binding/startup/authority tests and QA E-1534/E-1535/E-1537 briefs. Proposed additive optional outageSince only on hosts with an outage; ready rows and old replies unchanged. hosts.state, Neovim/web frames and persisted records unchanged. Image key comparison will be shared with preparePools; no provider construction in doctor.

### impl-1829 · 2026-11-14T14:31:52.563Z

Consumer sweep addendum: host.status exact references are hub/src/cli/{host,login}.ts, hub/src/hub/{dispatch,web-authority}.ts, hub/src/protocol.ts, shared/wire/index.ts; tests host-status, host-secret-admission, login-capacity-list, login-remove, web-authority-unit, web-authority, web-hosts-authority, web/test/{hosts,hosts-view}; QA E-1534{,-stage-3}, E-1535{,-stage-1,-stage-3}, E-1537-stage-{1,2}. Only host-status deep-equals individual ready hosts, which stay byte-compatible. Other clients select named fields or only authorize the request; no migrations required for optional outageSince. New doctor test keeps literal previous host.status wire shape with unknown outage/spend and host.providers refusal. Key functions poolImageKey/samePoolImageKey/preparePools consumers: provision-host, provider/digitalocean, pool-image and host-provider-digitalocean-prepare; shared comparison preserves prepare/admission behavior. No Neovim, setup, startup probe, retained-record or shipped skill consumes host.status host rows positionally.

### rev-35 · 2026-11-14T14:37:49.278Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1829-source-1
commit: fbedef62585e02e03a7a610665a0405a337ffb9c
scope: full
findings: [{"severity":"medium","text":"C3: host.status.capacity is admission capacity, not free-login count: one reusable key/shared disk supplies maxHosts and exclusive inventory is capped. Report authoritative scoped actual free counts with key/shared/exclusive controls.","file":"hub/src/doctor/hosts.ts","line":53},{"severity":"medium","text":"C3: capacity keys include global login harnesses and retained removed pools, so doctor warns about unplaced harnesses and can suggest adding to an unconfigured pool. Limit free-login rows to configured pools and role harnesses placed there.","file":"hub/src/doctor/hosts.ts","line":53},{"severity":"low","text":"Ready rows can now carry outageSince during the health grace period before unreachable. Qualify the unchanged-shape statement to healthy ready rows and describe this additive interval.","file":"docs/hub/host-status-stop.md","line":5}]
finding_counts: {"high":0,"medium":2,"low":1}

Complete first source pass not clear; A-19379 records both axes, C3 findings, low compatibility wording and evidence limits. C1/C2/C4–C7 source paths/tests reviewed but no criteria verified before corrected-head configured evidence. A-19378 all975 rows/tiers match pinned manifest; unknown-reach scope is conservative, not execution. Original tool excerpts/candidate/raw-capture limits and isolated prefix inventory accepted as qualified targeted evidence; no suite or global cleanup claim. Full pass complete: release pin for corrections, then request fresh source review before mode-free verify. Reviewer read-only.

Criteria: C3 failed (Admission capacity is mislabeled as actual free-login counts and rows are not restricted to placed role harnesses/configured pools.).

### impl-1829 · 2026-11-14T14:38:45.359Z

Review fix contract sweep: adding host.status pool.freeLogins (configured placed-role harness keys only), retaining capacity admission semantics. Same consumer union as earlier sweep/A-19378: host-status first pool deep-equal migrates freeLogins:{}; other CLI/login/web/authority/QA consumers select their existing fields, so unaffected. Doctor keeps previous wire regression with absent freeLogins => unknown warning. LoginRecords owns indexed actual-count query reusing capacityEligibleSql; no copied client eligibility policy. Retired pool spend/hosts still report; free-login rows suppressed. Healthy ready rows without an observed outage stay unchanged; grace-period ready rows may include outageSince.

### rev-35 · 2026-11-14T14:43:53.774Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1829-source-2
commit: efd261248e0501c0d62efcef613d9b915b361132
scope: full
findings: [{"severity":"low","text":"The warning is now based on zero actual freeLogins, not zero admission capacity. Replace 'Zero capacity' with 'Zero free logins'; max_hosts=0 can have a positive free count.","file":"docs/hub/cland-doctor.md","line":18}]
finding_counts: {"high":0,"medium":0,"low":1}

Source recheck clear with one low; no high/medium remains. A-19385 confirms source1 C3 fixes: shared indexed freeCount counts identities rather than admission slots; additive freeLogins is configured/placed-harness scoped, removed-pool count rows suppressed, older missing fields unavailable; key/shared/exclusive/unplaced controls retained. Grace-period outage docs corrected. Actual combined inventory+2 supersedes stale zero claim; separate lone9-case delta0 and prior capture/candidate limits remain qualified. All run-dependent criteria remain unverified pending same-head mode-free evidence. Complete source pass releases hold; any further edit requires a fresh pinned review before verification.

### rev-35 · 2026-11-14T14:44:46.279Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1829-source-3
commit: c42b234b6a3f36ecb5a6f7683b741d36d10671b9
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Wording-only delta clear; A-19391. Sole change replaces Zero capacity with Zero free logins in doctor guide, resolving source2 low. No executable/test/contract changes; clean local HEAD and origin task tip match. Previous source-clear behavior/evidence limits carry unchanged. All run-dependent criteria remain unverified; mode-free verify may run at this exact head, with final evidence audit afterward. Reviewer read-only.

### rev-35 · 2026-11-14T15:12:02.548Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1829-final-1
commit: c42b234b6a3f36ecb5a6f7683b741d36d10671b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; C1–C7 verified. A-19393 independently audits A-19392: all 9 required doctor identities pass once ordinary plus 5 load repetitions each; ordinary file pass at 14591. All 6,275 ordinary test / 693 ordinary file finishes pass, with 170 load test/file positives separately and no negatives. All 975 conservative consumer paths retained: 220 T1, 419 T2 and 54 Web ordinary file passes, zero selected missing; 265 T3 and 17 T4 deferred. Exact head/normalized tree match reviewed source; Linux x64 droplet, Node 24.21.0, isolated Headless Shell 1248 / Chrome 156.0.8078.4. Capture/candidate limits and corrected combined +2 versus isolated delta0 inventory remain explicit; report-only advisories are not clean-enforce proof. Prior C3 failures resolved by reviewed actual-count/scope fixes. Broader T3/T4 and after-stage QA remain separate. Head clean/unchanged; Reviewer read-only.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-11-14T15:51:58.972Z

Merged 3ecb6a24dd2ef55e289647fc554ea4e85ca77df0 onto dev.
