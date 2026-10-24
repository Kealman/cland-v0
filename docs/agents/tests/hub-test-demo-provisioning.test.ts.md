# hub/test/demo-provisioning.test.ts

Use the sealed T2 public demo frames with an injected provider and scripted
machine. Arm bounded observers before start, then hold provider creation and
delivery independently. Assert status stays `provisioning` and exec refuses
with the same lease id and commit through both holds. After the durable ready
receipt, retain `active` status and accepted exec assertions. Keep missing and
released lease controls. Release every hold and await the admitted start in
`finally`, so fixture cleanup stops all writers before removing owned roots.
