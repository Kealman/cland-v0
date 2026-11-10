---
id: T-1782
kind: task
title: "DigitalOcean login volumes: from a snapshot, snapshot history, no test-only refusal"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1772
topic: null
branch: null
created: 2026-11-09T12:44:10.329Z
updated: 2026-11-10T05:08:03.442Z
---

## Summary

The DigitalOcean provider implements T-1772's three volume operations through its API: a volume created from a snapshot, a volume's snapshots listed, and a snapshot deleted with a confirming read. Its volume creation drops the "test-only" refusal: it proceeds when the caller supplies a login admission, and without one it is refused before any API call. Volumes carry the cland, project and pool tags, so the hourly lost-work check finds them.

## What to build

The API calls behind the three operations:
- `POST /volumes` with `snapshot_id`;
- `GET /volumes/<id>/snapshots`;
- `DELETE /snapshots/<id>`, confirmed by a GET that reads 404.

The snapshot window's 429 keeps mapping to `refused` with `rate limited` and a retry time. The login model passes a login volume admission (login, project and pool), and a create without one is refused naming it. The fake DigitalOcean API grows the endpoints. `docs/hub/host-providers.md` gains a subsection in place of the test-only sentence. A real DigitalOcean volume is created only in E-1539's live run.

## Acceptance criteria

- [ ] C1. Against the fake API, a volume created from a snapshot sends that snapshot id, the region, and the cland, project and pool tags (test).
- [ ] C2. `listSnapshots` and `deleteSnapshot` go through the fake API, and a delete reports deleted only after a GET reads 404 (test).
- [ ] C3. A volume create without a login admission is refused before any API call naming the admission, and with one it reaches the fake API outside the fake-host fence (test).
- [ ] C4. The DigitalOcean provider passes the volume contract cases T-1772 added (test).
- [ ] C5. No code, test or doc still names the test-only volume refusal.

## Blocked by

- T-1772

## Notes

- Hot files: `hub/src/host/provider/digitalocean.ts`, `hub/src/executor/droplet/api.ts`, `hub/test/fakes/digitalocean/fake-api.ts`, `docs/hub/host-providers.md`.
- Tests: `hub/test/host-provider-digitalocean-volumes.test.ts` (T2, edit), fake DigitalOcean API only; never a token or a real API.
- Serves epic C4 (single attachment on DigitalOcean) and C9 (the volume inventory), on the production provider path.
