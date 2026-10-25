# hub/test/publish.test.ts

The sealed project fixture owns HOME, XDG and Git configuration and uses local disposable repositories for GitHub and territory. The CLI is the subject; the hub remains in-process.

T-1276 proves that successful publish records a landing, leaves push available while the item is open, and reports merged plan progress and closure after the task closes. The per-item/none stage needs no after-stage covers; the containing-cover and restart boundaries are covered by stage-closure-component.test.ts. No browser runs.

The plan-stage case waits, through bounded `eventually`, for the child's persisted tracker file to parse with `status: planned` before `clean(root)` commits the fixture (T-1306). The plan-set reply alone precedes asynchronous child reconciliation. Keep the publication and closed-stage assertions. For a deterministic negative control, capture the child's pre-plan bytes and its persisted planned bytes, replay the pre-plan bytes before `clean(root)`, then deliver the planned bytes after that commit: the unchanged publish assertion must fail with `publish needs a clean project root on dev`. Remove the replay writes for the passing case. Run the named case five times sequentially and retain the mode-free Linux verification receipt.
