-- id: THREAD-004
-- title: Per-message Markdown at 80 columns handles four T-86 narrow-width breakages
-- preconditions: Coordinator Markdown, a wide table, a quote and a wrapped human header on the stub hub
-- expected: no phantom link wraps, covered headers, overwritten quote characters or mid-row table wraps
-- since: T-133
-- regression: no
local dir=debug.getinfo(1,'S').source:sub(2):match('^(.*)/')
return dofile(dir..'/../support/thread-markdown.lua')(80)
