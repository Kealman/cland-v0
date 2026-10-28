# hub/test/artifact-upload.test.ts

T2 uses `projectHub`, human socket frames and `testMessenger`'s native upload
port. Scratch roots and child environments come from the sealed harness; no
platform, browser, token or native provider is needed.

Assert exact message and artifact identities, original file contents and filename
extensions, and exactly one artifact model frame per accepted file after its
committed result (sendFromHuman owns publication). Read history to prove there is one message and no ▣ post. Oversize,
eleventh-file and malformed base64 requests must leave no index, file or message;
a read-only Agents publication must remove already prepared files on rollback.
The size control is exactly one byte over a 1024-byte configured limit.
Native ingress replay returns the same id and artifact count. Preserve non-General
refusal, the previous topic.send-with-artifacts refusal and authenticated session
refusal. Native sidecars never enter the JSON frame, and frame fields cannot
choose an ingress id. Arm result observers before native sends.

Config init/update compatibility is in `hub/test/init.test.ts`; strict config-set
validation is in `hub/test/config-set.test.ts`. Web authority is exercised over
authenticated WebSocket in `hub/test/web-authority.test.ts`, without a browser.

Seed only a made-up speech secret in the sealed project file. A text attachment
and binary attachment containing its exact bytes must fail with secret-in-upload
on both native and base64 socket paths, leaving no files, rows or messages.
A clean binary positive control is stored byte for byte. Never mask media bytes.
The same project registry retains rotated secret values; check again at commit.
The config-set activation regression retains startup-only artifacts and requires
restart guidance rather than promising live reload.

Blank-caption permission belongs only to the artifact.upload producer. Keep the
original empty prompt.send refusal and draft-status assertion in artifacts.test.ts;
ordinary topic.send/attachedSend callers retain the default empty-text refusal.
When changing this boundary, run artifacts.test.ts, prompt-races.test.ts and the
isolated desktop/phone composer files serially beside the upload cases.

The native ownership control holds the file writer after preparation, mutates
the caller's source buffer, and requires the committed file to retain its original
bytes. Native uploads never opt into the HTTP reader's private-buffer handoff.
