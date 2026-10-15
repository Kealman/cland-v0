-- id: RULEBOOK-001
-- title: The rulebook view lists rules with scope, status and date, unfolds reason and origin, and gt opens a thread origin at the human's message
-- preconditions: a fixture project on the stdio hub; a human message typed in General; .cland/RULES.md written with an active thread-origin rule, an active Aide-origin rule and a retired memory-origin rule
-- expected: Space R shows one row per rule as rule <n> · title · scope · status · date, active rules first in number order and the retired one dimmed; Enter unfolds text, reason and origin (topic title and message time, Aide name, memory path); gt on a non-thread origin says so; gt on the thread origin opens General at the human's message; the palette's Rulebook opens the view
-- since: E-423
-- regression: no
local api = vim.api
local today = os.date('!%Y-%m-%d')
local function rows_text()
  local rb = require('cland.rulebook')
  if not (rb.buf and api.nvim_buf_is_valid(rb.buf)) then return '' end
  return table.concat(api.nvim_buf_get_lines(rb.buf, 0, -1, false), '\n')
end
-- the buffer line of rule n's header row (row parts are kept by the view)
local function header_line(n)
  for i, row in pairs(require('cland.rulebook').rows) do
    if row.rule.number == n and row.part == 'header' then return i end
  end
end
return {
  title = "The rulebook view lists rules, unfolds reason and origin, and gt opens a thread origin",
  fixture = { project = 'qa-rulebook-read' },
  run = function(qa)
    qa.wait_for(function()
      return qa.state().hub.state == 'connected' and qa.screen():find('No messages in General yet.', 1, true)
    end, 10000, 'General, connected')
    -- the human states the rule in General
    qa.keys('Run one suite at a time, please.<CR>')
    qa.wait_for(function() return qa.screen():find('Run one suite at a time, please.', 1, true) end, 5000, 'the human message in General')
    local message
    require('cland.rulebook').client:request({ type = 'topic.history', topic = 'general' }, function(err, value)
      if err then message = { error = tostring(err) }; return end
      for _, m in ipairs(value.messages or {}) do
        if m.text == 'Run one suite at a time, please.' and m.fromKind == 'human' then message = m end
      end
      message = message or { error = 'no human message in the history' }
    end)
    qa.wait_for(function() return message end, 5000, 'the human message id')
    qa.expect(not message.error, 'topic.history: ' .. tostring(message.error))

    -- a hand-written rulebook (the hub re-reads it): a thread origin, an Aide origin and a retired memory origin
    local f = assert(io.open(qa.root .. '/.cland/RULES.md', 'w'))
    f:write(table.concat({
      '# Project rules', '',
      '## 1 Older rule', 'Scope: all', 'Date: 2026-10-14', 'Status: retired 2026-10-15',
      'Origin: memory:/planning/memory/older-rule.md', 'Reason: replaced', '', 'Old text.', '',
      '## 2 Serial suites', 'Scope: implementer', 'Date: ' .. today, 'Status: active',
      'Origin: message:general/' .. message.id, 'Reason: contention', '', 'Run one suite.', '',
      '## 3 Briefs address the role', 'Scope: coordinator, aide', 'Date: ' .. today, 'Status: active',
      'Origin: session:helper', 'Reason: handovers', '', 'Address the role, never a session name.', '',
    }, '\n'))
    f:close()

    qa.keys('<Esc><Space>R')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('Rulebook ·', 1, true) and s:find('rule 1', 1, true) and s:find('rule 2', 1, true) and s:find('rule 3', 1, true)
    end, 10000, 'the rulebook with three rows')
    qa.expect(qa.state().view.kind == 'rulebook', 'the centre view is the rulebook')
    local text = rows_text()
    qa.expect(text:find('rule 2 · Serial suites · implementer · active · ' .. today, 1, true), 'rule 2 row: title, scope, status, date\n' .. text)
    qa.expect(text:find('rule 3 · Briefs address the role · coordinator, aide · active · ' .. today, 1, true), 'rule 3 row\n' .. text)
    qa.expect(text:find('rule 1 · Older rule · all · retired · 2026-10-14', 1, true), 'rule 1 row, retired\n' .. text)
    qa.expect(text:find('rule 2', 1, true) < text:find('rule 3', 1, true) and text:find('rule 3', 1, true) < text:find('rule 1', 1, true),
      'active rules first in number order, then the retired one')
    local dimmed = false
    local ns = api.nvim_get_namespaces()['cland.rulebook']
    for _, m in ipairs(api.nvim_buf_get_extmarks(require('cland.rulebook').buf, ns, 0, -1, { details = true })) do
      if m[2] + 1 == header_line(1) and m[4].hl_group == 'ClandRuleRetired' then dimmed = true end
    end
    qa.expect(dimmed, 'the retired rule is dimmed (ClandRuleRetired)')
    qa.dump('rulebook-rows')

    -- the Aide origin and the retired memory origin unfold
    api.nvim_win_set_cursor(0, { header_line(3), 0 })
    qa.keys('<CR>')
    qa.wait_for(function()
      local t = rows_text()
      return t:find('Address the role, never a session name.', 1, true) and t:find('Reason: handovers', 1, true) and t:find('Origin: helper', 1, true)
    end, 5000, 'rule 3 unfolded: text, reason, Aide origin')
    qa.keys('gt')
    qa.wait_for(function() return qa.screen():find('origin is not a thread', 1, true) end, 5000, 'gt on an Aide origin says it is not a thread')
    qa.keys('<CR>')
    api.nvim_win_set_cursor(0, { header_line(1), 0 })
    qa.keys('<CR>')
    qa.wait_for(function()
      local t = rows_text()
      return t:find('Old text.', 1, true) and t:find('Reason: replaced', 1, true) and t:find('Origin: /planning/memory/older-rule.md', 1, true)
    end, 5000, 'rule 1 unfolded: memory origin path')
    qa.keys('<CR>')

    -- the thread origin resolves to the topic title and the message time, and gt opens it
    api.nvim_win_set_cursor(0, { header_line(2), 0 })
    qa.keys('<CR>')
    qa.wait_for(function()
      local t = rows_text()
      return t:find('Run one suite.', 1, true) and t:find('Reason: contention', 1, true) and t:find('Origin: General · ' .. message.ts, 1, true)
    end, 5000, 'rule 2 unfolded: Origin: General · <message time>')
    qa.dump('rulebook-unfolded')
    api.nvim_win_set_cursor(0, { header_line(2), 0 })
    qa.keys('gt')
    qa.wait_for(function()
      local v = qa.state().view
      return v.kind == 'thread' and v.id == 'general' and qa.screen():find('Run one suite at a time, please.', 1, true)
    end, 5000, 'gt opens General at the human message')
    local line = api.nvim_get_current_line()
    qa.expect(line:find('Run one suite at a time, please.', 1, true) or qa.screen():find('Run one suite at a time, please.', 1, true),
      'the cursor is on the human message')
    qa.dump('rulebook-origin-thread')

    -- the palette action Rulebook opens the same view
    qa.keys('<Esc><Space>p')
    qa.wait_for(function() return qa.screen():find('palette ›', 1, true) end, 5000, 'the palette')
    qa.keys('Rulebook')
    qa.wait_for(function() return qa.screen():find('␣R', 1, true) end, 5000, 'the Rulebook action with its key')
    qa.keys('<CR>')
    qa.wait_for(function() return qa.state().view.kind == 'rulebook' and not qa.screen():find('palette ›', 1, true) end, 5000, 'the palette opens the rulebook')
    qa.expect(#require('cland.actions').audit() == 0, 'rulebook keys use the action registry')
  end,
}
