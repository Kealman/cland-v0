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
