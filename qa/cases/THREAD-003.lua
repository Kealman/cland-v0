-- id: THREAD-003
-- title: Per-message Markdown at 120 columns
-- preconditions: Coordinator Markdown, a wide table, a quote and a wrapped human header on the stub hub
-- expected: conceal, code inset, list alignment, compact links, intact quotes/headers and fitting full tables
-- since: T-133
-- regression: no
local dir=debug.getinfo(1,'S').source:sub(2):match('^(.*)/')
return dofile(dir..'/../support/thread-markdown.lua')(120)
