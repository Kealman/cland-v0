---
id: T-1590
kind: task
title: Host records and per-host secrets
state: open
status: review
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: topic-1328
branch: t/T-1590-host-records-and-per-host-secrets
created: 2026-11-02T03:33:53.028Z
updated: 2026-11-02T05:55:37.779Z
---

## Summary

`hub.db` gains a `hosts` table, created in place. Each row holds the host's id, transport (`ssh`), address, user, state and the digest of its per-host secret. Each host gets a 0700 directory under the hub's `.cland/` holding its client key path, its per-lease `known_hosts` and its secret at 0600. At start `CLAND_FAKE_HOSTS` with `CLAND_FAKE_HOST_ROOT` registers fake hosts. Per-host socket and control paths fall back to a short path as the hub socket does.

Hot files: `hub/src/host/records.ts` (new), `hub/test/host-records.test.ts` (new)

## Acceptance criteria

- [x] C1. A hub opened on a `hub.db` without the table creates it, and existing tables and rows are untouched (test).
  - done: impl-1590 · 2026-11-02T05:51:59.142Z
- [x] C2. Registering a host mints a random per-host secret, stores only its digest in `hub.db`, writes the secret at 0600 in the host's 0700 directory, and never writes it to `hub.log`, the journal or a frame (test).
  - done: impl-1590 · 2026-11-02T05:52:02.542Z
- [x] C3. `CLAND_FAKE_HOSTS=f1,f2` with `CLAND_FAKE_HOST_ROOT` registers two `ssh` host records whose `known_hosts` pins each fake host's key, and with either variable absent no fake host exists (test).
  - done: impl-1590 · 2026-11-02T05:52:05.467Z
- [x] C4. For a project root deep enough that a per-host socket or control path would exceed the platform's socket path limit, the paths fall back to a short directory, as `layout().socket` does (test).
  - done: impl-1590 · 2026-11-02T05:52:08.035Z
- [x] C5. A secret matches only its own host's digest, and a revoked host's secret matches nothing (test).
  - done: impl-1590 · 2026-11-02T05:52:11.459Z

## Notes

Shared files: the `hosts` table schema (E-1533 adds provider columns, E-1534 keeps leases in its own table)

## Comments

### impl-1590 · 2026-11-02T05:45:11.078Z

Contract inventory (rule 20): searched hosts/CLAND_FAKE_HOSTS/known_hosts/secret_digest and Host/store/layout importers throughout hub/src (including colocated tests), hub/test all tiers, shared/web/nvim, qa and .agents. New hosts table and records.ts have no prior consumers. Store constructor migrates in place; daemon startup registers private values with the existing project redactor. Existing process host registry, session frames, project discovery, CLI/import-budget and Host interface remain unchanged. Planned downstream consumers: T-1596 admission/revocation; T-1595 transport; E-1533 provider columns. Existing host-registry.test.ts is preservation evidence. Coordinator confirmed C3 list + root hook contract in topic-1328.

### rev-36 · 2026-11-02T05:55:37.779Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1590-source-1
commit: 6748aa6df84fd638ea11e1fe00bc4a3d8bc28a67
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings. Additive hosts Store table, host-bound digest/revocation, exclusive private files/redactor registration/restoration, both-variable fake hook/pins and shared-limit short socket paths reviewed. Public metadata omits digest; no raw secret output producer; bootstrap/admission/connection revocation correctly left to downstream owners. Seven disposable T2 controls and unedited registry preservation,consumer inventory,tier/docs/skill/change record inspected. A-15592 local macOSarm64 Node24.21.0 targeted7+4/static summaries preliminary; final typecheck repeat pending at request. C1–C5 await exact-head post-source mode-free verify/named evidence;no remote/all-tier claim. No Reviewer tests/browser/edits;after-stageQA separate.
