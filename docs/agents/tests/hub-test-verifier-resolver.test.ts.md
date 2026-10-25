# hub/test/verifier-resolver.test.ts

T1 production-routing unit: HubCore over in-memory presence, holds and tracker records, with no hub process or child.

The shared first-line matcher cases pin the exact form, detail after the item (`review request T-<n> — branch and scope`), the epic `stage <name>` suffix, and the boundary that makes a letter glued to the id (`review request T-<n>abc`) or a buried phrase no request at all. The continued-first-line case runs the real routing seam: one Reviewer and one QA holder receive the message, the other holders do not, delivery acceptance records pending work only for the recipient, and a fully held pool queues the request and then releases it to exactly one holder. Assert on `outcomes`, `message.to`, `resolvedTo` and `pending` rather than on matcher internals.
