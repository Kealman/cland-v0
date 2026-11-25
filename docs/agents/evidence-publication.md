# Publishing evidence

Use the [self-contained QA kit guide](../../.agents/skills/qa/EVIDENCE.md) for
the installed helper locator, invocation, scanner controls and snapshot lifecycle.
The guide and locator travel with provisionSkills; the host project needs no
hub/src directory or provisionDocs entry. The installed cland package supplies
the implementation. Both scanner entry points delegate to the pure policy shipped
in the QA kit. Their shared pattern families cover provider keys, private-key
headers, credential assignments, sign-in query values and private user paths.
The QA-demo profile preserves contextual and token-length Bearer detection;
the capture profile also rejects short Bearer values and its supplied exact
secret. Evidence publication requires both profiles to accept the snapshot.

Session publication reconciles transport failures by replaying artifact.create
once with identical arguments, snapshot path and the same generated or supplied
retryKey. Only a positive create/replay receipt permits snapshot cleanup. The
hub's existing actor/key/fingerprint receipt lives in the project store's meta
table, committed with the artifact registration, and survives hub restart when
the store and actor identity are retained. Older identical artifacts never supply
completion evidence. An uncertain replay retains the snapshot and the
outcome-unknown refusal. Definitive
hub refusals stop publication; no protocol or permission change is required.
