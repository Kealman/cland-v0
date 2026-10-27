---
id: T-1382
kind: task
title: "artifact.upload: files as bytes become the human's artifacts on one new message, without a ▣ post, under the [artifacts] limit"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1311
blocked_by: []
topic: null
branch: null
created: 2026-10-27T23:37:26.682Z
updated: 2026-10-27T23:37:38.368Z
---

## Summary

The one protocol gains `artifact.upload`. Each file comes with a name, a MIME type and its bytes, and the frame names the topic, an optional caption, kind, addressees and reply. In one step it creates the artifacts and one new message of the human's carrying them, with no ▣ post. `[artifacts] max_upload_mb` bounds each file.

## What to build

**Shared contract change:** a new client request. Consumers to migrate:
- the `ClientRequest` union and its request guards in `protocol.ts`, and the `shared/wire` types;
- the gateway's authority table: `artifact.upload` with `topic.send`'s rule, so General or a reply in the replied message's topic, while `topic.send` with `artifacts` stays refused;
- the web authority table;
- the audit record, and `hub serve`'s usage line on what remotes may do;
- the tests of both authority tables.

Neovim, the web client, skills and QA briefs gain no call in this ticket. Sessions are refused with `forbidden`.

**Behaviour.**
- The hub validates every file before writing anything:
  - at most 10 files;
  - a name made safe, and a MIME type of the `type/subtype` form or `application/octet-stream`;
  - each file within `max_upload_mb`.
- It creates `file` artifacts whose extension follows the name and MIME rule in the assumptions, attributed to `human`. It then sends one human message with the caption as its text, `via` from the edge, and `to`, `kind` and `replyTo` validated as `topic.send` validates them, carrying all the artifacts.
- The artifacts and the message register in one store transaction under the existing artifact creation queue. A refusal or a failure leaves neither an index entry nor a file.
- Artifact subscription events still fire. No `▣ … ·` message is posted.
- An upload that carries an ingress message id the hub already stored returns that message and creates nothing.
- Socket clients send `data` as base64 within the 1 MiB frame. The in-hub edges hand Buffers beside the frame on their conversation, and the frame minus its bytes passes the same authority and audit path.
- The result is `{ message, artifacts }`.

`[artifacts] max_upload_mb = 50` gets its type, default, template line, parse rule and `config set` validation, so `cland init` renders it and `cland update` adds it to an existing managed file. Spec §3.6 and §3.1; ADR 0003 (one protocol).

## Acceptance criteria

- [ ] C1. One `artifact.upload` with a PNG and a PDF from a human socket client makes exactly one General message from `human` carrying both artifacts with `.png` and `.pdf` paths, the caption as its text, and no `▣` message in the topic (test).
- [ ] C2. A file one byte over `max_upload_mb`, or an eleventh file, is refused with a validation error and leaves no artifact index entry, no file under `.cland/artifacts` and no message (test).
- [ ] C3. Through an injected gateway remote, an upload into General with Buffers beside the frame records `via = "telegram"`, an upload into an item topic without a reply is refused as `forbidden` by the gateway table, and a replay with the same ingress id returns the first message without new artifacts (test).
- [ ] C4. A session's `artifact.upload` is refused as `forbidden`, and `topic.send` with `artifacts` from a remote stays refused (test).
- [ ] C5. `cland init` renders `max_upload_mb = 50` under `[artifacts]`, `cland update` adds it to a managed config that lacks it, and `cland config set artifacts.max_upload_mb 0` is refused (test).

## Notes

Shared files: hub/src/protocol.ts, shared/wire/index.ts, hub/src/hub/dispatch.ts, hub/src/hub/artifacts.ts, hub/src/hub/store.ts, hub/src/remote/authority.ts, hub/src/hub/web-authority.ts, hub/src/init/config.ts
