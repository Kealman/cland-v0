---
id: T-298
kind: question
title: "OpenCode launch policy: map roles.toml approval, sandbox, permissions, item rule and effort onto v2 session rules; the codemode experiment"
state: open
labels:
  - ready-for-human
  - hub
assignee: null
parent: T-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T16:20:57.757Z
updated: 2026-10-12T16:20:57.757Z
---

## Open question

From the T-295 research: OpenCode v2 lets a session be created with its own permission rules (an ordered list, per agent and per session), an agent and a model variant, but cland's adapter drops roles.toml's approval, sandbox, permissions, item rule (D8) and effort for OpenCode launches and mangles models written as `provider/model#variant`. Also untested: whether turning off OpenCode's "Code Mode" for cland's MCP server (`codemode: false`) makes models call `send` more reliably; today models reach `send` through a JavaScript `execute` tool.

To decide: map the launch policy of roles.toml onto OpenCode's session creation (what each field becomes, what has no counterpart), fix the model variant syntax, and run the codemode experiment with a measurement before changing the default.
