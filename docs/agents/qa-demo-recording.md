# Demo recording

The QA role runs remote headless cases through `QA_DEMO_EPIC=<epic> sh .agents/skills/qa/qa-record.sh run <epic> <run> <case>`. The helper `qa-demo-record.ts --help` describes the private recorder interface. The hub supplies the demo lease and delivered build; these checks run locally before publishing its returned captures.

When the brief expects structured facts, commit a JSON array such as `["connected", "finished"]` and set `QA_EXPECTED_FACTS` to its local path. The case writes `<case>.facts.json` in `CLAND_QA_OUT`, with a `facts` object and optional `steps`, `error`, `errors` or `stepErrors`. The recorder merges only those fields into the final result and includes the sidecar as evidence; duplicate result/sidecar fields are refused. Native headless output stays compatible. Every listed key must be an own, non-null property of `facts`. Values `false` and `0` count as recorded facts. The manifest must be an array of nonempty strings. A malformed/unreadable manifest or missing fact produces BLOCKED, exit 2, rather than PASS. Without a manifest, existing Lua cases retain their previous result shape; no expectations are inferred from the brief's prose.

A claimed PASS also requires native exit 0 and no nonempty `error`, `errors` or `stepErrors` field anywhere in the result, including nested facts and steps. Null, false, empty strings and empty error arrays represent no error. Validation failures preserve remote captures for recovery and publish no evidence paths.

Before writing any local capture, the recorder scans the returned metadata, stderr and every base64-decoded capture. Recognized token query parameters, bearer credentials, common OpenAI/Anthropic/DigitalOcean/GitHub/Google/AWS key formats, named token/API-key assignments and private-key headers refuse publication. The diagnostic never includes matched values. Scanning reads UTF-8/UTF-16 text and URL/JSON escapes; it does not perform OCR, unpack archives or recognize every possible unlabelled credential. Keep exported captures limited to declared evidence and never include account directories or raw environment files.

Metadata is scanned again as parsed JSON strings, including nested result fields, stderr and names. JSON whitespace escapes such as tab/newline must not hide a recognized bearer credential before its decoded value is published. Safe escaped whitespace remains valid.

On refusal, the recorded result is BLOCKED with exit 2 and no evidence paths. Remote sources are retained until the demo lease ends; recover them only after redacting and scanning in a private scratch area. Manual `note`, local headless runs and rescue `recover` do not pass through this remote helper and require QA's pre-publication redaction and scan. Never put secret values or scanner patterns in argv or print matches; use files/fds and report counts or names only.

A Lua case can save the sidecar after its observed steps:

```lua
vim.fn.writefile({vim.json.encode({facts = {connected = true, finished = true}})},
  vim.env.CLAND_QA_OUT .. "/CASE-001.facts.json")
```

Replace the example values with observed receipts; a caught step error belongs in the sidecar too. With a nonempty manifest, an absent sidecar cannot establish the required facts.
