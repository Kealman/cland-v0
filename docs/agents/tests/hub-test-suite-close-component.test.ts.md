# hub/test/suite-close-component.test.ts

T-1029: execute two scripted Linux shards through the production scheduler, wait
for the parent result and drain verification work before stopping the first
`projectHub`. Start a second hub with the same owned provider and clock; its first
stage submission must reuse the original run, count Linux in the result, and
create no replacement droplets. This is T2: no worker process, real provider or
browser runs. Do not replace completion with seeded successful parent fields.
Post-restart plan and QA currency use the held-tree case in
`stage-closure-component.test.ts`, which keeps the older receipt shape covered.
