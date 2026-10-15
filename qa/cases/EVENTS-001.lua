-- id: EVENTS-001
-- title: The events view shows heartbeat firings under key 9 and rule changes under the palette's kind filter, with needs-you unchanged
-- preconditions: the stub hub with two heartbeat rows (session coord, in-flight and stale counts), one rule row and one task row; needs you 0
-- expected: Space E lists all four; 9 keeps only the two heartbeat rows with their counts; numeric keys 1 to 9 stay the nine older kinds plus heartbeat and no key 10 exists; the palette's Filter rule events keeps only the rule row; needs you stays 0 throughout
-- since: E-423
-- regression: no
local now = os.date('!%Y-%m-%dT%H:%M:%S.000Z')
local beat = { id = 'beat-1', ts = now, kind = 'heartbeat', glyph = '●', subject = { kind = 'session', id = 'coord' }, session = 'coord',
  text = 'coord · in flight 3 · stale 2' }
local beat2 = vim.tbl_extend('force', beat, { id = 'beat-2', text = 'coord · in flight 1 · stale 0' })
local rule = { id = 'rule-1', ts = now, kind = 'rule', glyph = '●', subject = { kind = 'rule', id = '4' },
  text = 'rule 4: Verdicts go to the lead. (scope: all; reason: routing)' }
local task = { id = 'task-1', ts = now, kind = 'task', glyph = '⚑', subject = { kind = 'item', id = 'T-1' }, item = 'T-1', topic = 'general',
  session = 'impl', text = 'claimed by impl' }
local function lines()
  return table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
end
local function count(pattern)
  local n = 0
  for _, line in ipairs(vim.api.nvim_buf_get_lines(0, 0, -1, false)) do if line:find(pattern, 1, true) then n = n + 1 end end
  return n
end
return {
  title = 'The events view shows heartbeat firings under key 9 and rule changes under the palette filter',
  hub = 'stub',
  fixture = { project = 'qa-events-kinds' },
  scenario = { inbox = { needsYou = 0 }, events = { beat, beat2, rule, task },
    items = { { id = 'T-1', title = 'Event subject', kind = 'task', state = 'open', status = 'in progress' } } },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'the stub hub connected')
    qa.keys('<Esc><Space>E')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('events · newest first', 1, true) and s:find('in flight 3', 1, true) and s:find('rule 4: Verdicts go to the lead.', 1, true)
        and s:find('claimed by impl', 1, true)
    end, 10000, 'all four event rows')
    qa.expect(qa.state().needs_you == 0, 'needs you is 0 with heartbeat and rule rows present')
    qa.dump('events-all')

    qa.keys('9')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('in flight 3', 1, true) and s:find('in flight 1', 1, true) and not s:find('claimed by impl', 1, true)
        and not s:find('rule 4:', 1, true)
    end, 5000, 'key 9 keeps only heartbeat rows')
    qa.expect(count('in flight') == 2, 'one row per heartbeat firing\n' .. lines())
    qa.expect(lines():find('coord', 1, true), 'the heartbeat rows name the session')
    qa.dump('events-heartbeat')

    local titles = {}
    for i = 1, 9 do
      for _, a in ipairs(require('cland.actions').all()) do if a.id == 'events:' .. i then titles[i] = a.title end end
    end
    local want = { 'session', 'task', 'verdict', 'suite', 'release', 'artifact', 'usage', 'topic', 'heartbeat' }
    for i, kind in ipairs(want) do qa.expect(titles[i] == 'Filter ' .. kind .. ' events', ('key %d filters %s (got %s)'):format(i, kind, tostring(titles[i]))) end
    local has10 = false
    for _, m in ipairs(vim.api.nvim_buf_get_keymap(0, 'n')) do if m.lhs == '10' then has10 = true end end
    qa.expect(not has10, 'no numeric key beyond 9')

    qa.keys('<Esc><Space>p')
    qa.wait_for(function() return qa.screen():find('palette ›', 1, true) end, 5000, 'the palette')
    qa.keys('Filter rule events')
    qa.wait_for(function() return qa.screen():find('Filter rule events', 1, true) end, 5000, 'the rule kind filter in the palette')
    qa.keys('<CR>')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('kind: rule', 1, true) and s:find('rule 4: Verdicts go to the lead.', 1, true) and not s:find('in flight 3', 1, true)
    end, 5000, 'only the rule row')
    qa.expect(qa.state().needs_you == 0, 'needs you is still 0')
    qa.dump('events-rule')
  end,
}
