# Publishing evidence

Use `publishSessionEvidence` from the sibling `publish-evidence.ts` shipped with
this QA kit to publish an evidence file or directory. Run it inside the cland session that
owns the evidence; the helper sends `artifact.create` as that session through
its authenticated hub transport. It never prints or stores the session credential.

```js
import { publishSessionEvidence } from './.agents/skills/qa/publish-evidence.ts';
const result = await publishSessionEvidence({
  path: './evidence', title: 'Validation evidence', kind: 'file', topic: 'topic-123',
});
console.log(JSON.stringify(result));
```

Run a saved script with Node 24.13 or newer within the 24.x line. Use the actual
item topic. A definitive hub refusal reports
`Evidence refused: hub refused (<code>): <reason>` and removes the snapshot;
older hub replies without a code use `unknown`. Stop on that refusal. A cleanup
failure preserves the refusal and reports the observed snapshot disposition.
A transport failure triggers one artifact.create replay with the same private
snapshot path, arguments and retryKey. This is a request-bound reconciliation:
the hub's durable actor/key/fingerprint receipt returns the original artifact if
the first create succeeded, or the replay creates it if the first request was lost.
The helper generates a key when omitted. The receipt lives in the project store's
meta table, in the artifact registration transaction, and survives a hub restart
with the same project store and actor identity. It prevents duplicate artifacts
from late first success. A listed artifact with identical bytes is never completion
evidence for this request, so no artifact-list lookup or content match is used.
An uncertain replay keeps the snapshot and reports the original outcome-unknown
refusal. Stop there and reconcile manually before further attempts.
The installed library form `publishEvidence(args, artifactCreate)` also accepts
the publishing session's tool callback. Its optional fifth argument `replayUnknown`
enables the same replay policy; without it, transport failures retain the
snapshot immediately. Test callbacks are fakes.

The helper copies every regular file (including hidden and nested files) into a
private snapshot, scans UTF-8 and UTF-16LE bytes plus relative filenames, then
publishes those same bytes. Symlinks, special files, empty directories and
snapshots exceeding 50 MiB refuse. Stop capture writers before calling it.
Directory payloads need a Markdown entry file for the hub's folder publication;
a folder containing only `README.txt` receives an `artifact-source` refusal.
It runs both entry points, `assertPublishable` and `scanCapture`, backed by
one `secret-scan-policy.ts` implementation shipped with this kit. Both profiles
reject provider keys, private-key headers, credential assignments, sign-in query
values and private user paths. The QA-demo profile keeps contextual and
token-length Bearer detection; the capture profile additionally rejects any
nonempty Bearer value and the supplied exact secret, including short prose.
Both must detect a synthetic control generated for that invocation. Only an
exit-0 receipt for the exact snapshot, with that control matched and no matches,
allows publication. No archive unpacking or OCR is performed.

Refusals contain the file and containing line/column 1; cross-line matches may
name line 1. Unsafe filenames use a SHA-256 label. Matched values and scanner
exceptions are withheld. Redact false positives to an id and hash in the source
export and invoke the helper again; never bypass a refusal with artifact.create.
The control stays in memory and is excluded from the artifact.

The copied locator follows the cland executable on PATH to its installed
hub/bin/cland.ts entry and imports that package's hub/src/evidence-publish.ts.
Source checkout and curl-installer symlink layouts use this entry directly.
For Homebrew's executable wrapper, the locator checks its adjacent libexec
package after resolving the PATH symlink. It never executes or parses the wrapper.
It runs no child command and assumes no hub/src or docs directory in the host
project. Brief templates link to this guide relative to their copied destination
in qa/briefs. If no supported entry/helper is available, publication refuses with
update/PATH guidance. No alternate publication is attempted.

Snapshot setup failures are sanitized. Cleanup follows the selected artifact
receipt or scan refusal; a removal failure never replaces it. Failures expose a
value-free snapshot disposition (state and cleanup outcome); successful callers
keep the original artifact result and receive any cleanup failure as a structured
stderr diagnostic. After a cleanup failure, a filesystem observation reports the
snapshot as retained or removed; an unreadable observation stays unknown.
An unknown publication outcome keeps the snapshot for reconciliation. A definitive
refusal during retry also retains it because the first attempt may still be reading.
Embedded callers can observe
the same disposition through the optional SnapshotLifecycle callback.
