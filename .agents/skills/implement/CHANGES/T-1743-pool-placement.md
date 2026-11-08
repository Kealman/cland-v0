# T-1743: session pool placement

Launch admission refreshes the role pool, selects a registered ready provisioned
Host by integer milli-slot weights and holds capacity through checkout/spawn.
Missing/full pools refuse before launch effects. Explicit host frames bypass
selection and provisioned pins check room; Coordinator/Aide stay local. See
`docs/hub/session-pool-placement.md` and the session-pool-placement test guide.

Source review also requires exact final readiness revalidation, durable failed
native capacity until positive stop, and credited idle-worker handoff promises.
