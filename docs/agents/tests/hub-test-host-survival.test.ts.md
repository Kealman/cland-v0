# hub/test/host-survival.test.ts

`hub/test/host-survival.test.ts` checks persisted mixed-harness rows with two
recording Hosts, unavailable startup, coalesced host readiness and positive birth
loss. Its twenty seconds are logical clock time; it claims no native lifecycle
or real downtime. Native harness and spoke evidence lives in
`hub/test/host-survival-native.test.ts`.

A held startup pass first fails an earlier row, then receives readiness while a
later row is held. It requires the shared flight to retry the earlier row before
settling; setup and completion each have their own bound.
