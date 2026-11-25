# hub/test/stage-containment-component.test.ts

The fixture uses disposable tracker files, in-memory SQLite and injected Git
facts. Two plans each contain 1,000 merged tasks. Restored cover binding and a
replacement landing must perform zero synchronous containment visits. The
affected stage stays open with pending evidence until background containment
settles; the unaffected stage retains its durable closure. Setup is outside the
measured test callback and normal cleanup joins the tracker before root removal.

An independent `stage-snapshot-member-visit` observer counts synchronous fact
mapping apart from the deferred containment loop. Restored binding and repeated
reads must reuse snapshots; a replacement landing maps its affected 1,000-member
stage once and maps zero unaffected members. Source state/status saves, reparenting
and removal then change cached merged/card facts through watched file indexing;
the change observer is armed before each save/removal and awaits its publication.
Publication replacement, plan changes and evidence-history settlement have
controls in stage-closure-component, planned-stage and plan-gate.

Run `node --test hub/test/stage-containment-component.test.ts` on a supported
Node runtime. No browser, credential, network or native Git process is used.
