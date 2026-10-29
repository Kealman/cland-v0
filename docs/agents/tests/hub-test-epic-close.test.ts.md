# hub/test/epic-close.test.ts

Use the sealed in-process project hub and existing injected Git graph. Duration
ownership cases use real task.close/task.edit frames with clear QA evidence;
plant both a test allowance and a file allowance, require every key and the
re-own step, and keep the original tracker bytes after refusals. Include the
human QA override: it must not bypass ownership. Re-own to an open release and
observe the returned closed item, retaining the manifest bytes and dates.
Keep the explicit absent-manifest close control for ordinary user projects.
The existing no-manifest cases retain previous wire frames and QA behaviour.

The duration cases use pacingOwner before root allocation and acquisition,
with an ownDirectory removal barrier. Startup has its own deadline; dispatcher
frame and QA-spoke acquisition have separately bounded owned observers. Catch
setup failure and join disposal before removal. Omitted/aborted startup controls
hold the readiness receipt until the actual hub serves, then require rejection,
the hub’s stopped receipt, zero observer/clock timers and the removed-root fact.
Older epic tests retain their existing setup; this ownership seam is scoped to
the new duration cases. CLI help changes migrate only TASK_USAGE in the frozen
commands.json; keep cli-usage-compatibility and cli-help guards unchanged.
