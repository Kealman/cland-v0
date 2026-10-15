-- id: RULEBOOK-002
-- title: The rulebook view adds, edits and retires a rule through the hub, keeps a refused draft, and follows a hand edit live
-- preconditions: a fixture project on the stdio hub with an empty rulebook
-- expected: a adds rule 1 with origin workbench (written to .cland/RULES.md and selected in the view); e with an unknown role is refused in the draft, which keeps its text; e then saves the edit; X retires the rule with a reason; a hand edit of .cland/RULES.md shows without a key press
-- since: E-423
-- regression: no
local api = vim.api
local function rules_file(root)
  local f = io.open(root .. '/.cland/RULES.md', 'r')
  if not f then return '' end
  local s = f:read('*a'); f:close(); return s
end
local function rows_text()
  local rb = require('cland.rulebook')
  if not (rb.buf and api.nvim_buf_is_valid(rb.buf)) then return '' end
  return table.concat(api.nvim_buf_get_lines(rb.buf, 0, -1, false), '\n')
end
return {
  title = 'The rulebook view adds, edits and retires a rule through the hub',
  fixture = { project = 'qa-rulebook-write' },
  run = function(qa)
    qa.wait_for(function() return qa.state().hub.state == 'connected' end, 10000, 'the hub connected')
    qa.keys('<Esc><Space>R')
    qa.wait_for(function() return qa.screen():find('No rules yet.', 1, true) end, 5000, 'the empty rulebook')

    -- a: a new rule from the draft's Text, Scope and Reason fields
    qa.keys('a')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('Text:', 1, true) and s:find('Scope: all', 1, true) and s:find('Reason:', 1, true)
    end, 5000, 'the new rule draft')
    qa.keys('gg0f:a Run serially.<Esc>j0f:lDaimplementer<Esc>jAavoid contention<Esc>:w<CR>')
    qa.wait_for(function()
      return qa.state().view.kind == 'rulebook' and rows_text():find('rule 1 · ', 1, true) and not qa.screen():find('Text:', 1, true)
    end, 5000, 'rule 1 saved and the rulebook shown')
    qa.expect(api.nvim_get_current_line():find('rule 1', 1, true), 'the new row is selected')
    qa.expect(rows_text():find('implementer · active', 1, true), 'rule 1 row shows its scope and status\n' .. rows_text())
    local file = rules_file(qa.root)
    qa.expect(file:find('## 1 ', 1, true), 'RULES.md holds ## 1\n' .. file)
    qa.expect(file:find('Scope: implementer', 1, true) and file:find('Status: active', 1, true), 'RULES.md fields\n' .. file)
    qa.expect(file:find('Origin: workbench', 1, true), 'origin workbench\n' .. file)
    qa.expect(file:find('Reason: avoid contention', 1, true) and file:find('Run serially.', 1, true), 'reason and text\n' .. file)
    qa.dump('rulebook-added')

    -- e: an unknown role is refused by the hub; the draft and its text stay
    qa.keys('e')
    qa.wait_for(function() return qa.screen():find('Text: Run serially.', 1, true) end, 5000, 'the edit draft filled from rule 1')
    qa.keys('j0f:lDaimpossible<Esc>:w<CR>')
    qa.wait_for(function()
      local s = qa.screen()
      return s:find('unknown role impossible', 1, true) and s:find('Text: Run serially.', 1, true)
    end, 5000, 'the refusal in the draft, text kept')
    qa.expect(not rules_file(qa.root):find('impossible', 1, true), 'the refused edit wrote nothing')
    qa.dump('rulebook-refused')
    -- the same draft, corrected, saves the edit
    qa.keys('gg0j0f:lDaall<Esc>ggA Every time.<Esc>:w<CR>')
    qa.wait_for(function()
      return qa.state().view.kind == 'rulebook' and rules_file(qa.root):find('Run serially. Every time.', 1, true)
    end, 5000, 'the edit saved')
    file = rules_file(qa.root)
    qa.expect(file:find('Scope: all', 1, true) and file:find('Origin: workbench', 1, true), 'the edit keeps number and origin\n' .. file)
    qa.expect(not file:find('## 2', 1, true), 'an edit adds no rule')

    -- X: retire with a reason
    qa.keys('gg')
    api.nvim_win_set_cursor(0, { 2, 0 })
    qa.keys('X')
    qa.wait_for(function() return qa.screen():find('Retire rule 1', 1, true) end, 5000, 'the retire reason prompt')
    qa.keys('superseded<CR>')
    qa.wait_for(function() return rows_text():find('rule 1 · .* · retired') end, 5000, 'rule 1 shows retired')
    file = rules_file(qa.root)
    qa.expect(file:find('Status: retired', 1, true) and file:find('superseded', 1, true), 'RULES.md records the retirement and its reason\n' .. file)
    qa.expect(file:find('## 1 ', 1, true), 'the retired rule stays in the file')

    -- a hand edit of the file (a merge, an editor) shows in the open view without a key press
    local f = assert(io.open(qa.root .. '/.cland/RULES.md', 'w'))
    f:write(file .. '\n## 2 Hand added\nScope: reviewer\nDate: ' .. os.date('!%Y-%m-%d') .. '\nStatus: active\nOrigin: shell\nReason: hand edit\n\nRead the queue first.\n')
    f:close()
    qa.wait_for(function() return rows_text():find('rule 2 · Hand added · reviewer · active', 1, true) end, 10000, 'the hand-added rule pushed to the view')
    local text = rows_text()
    qa.expect(text:find('rule 2', 1, true) < text:find('rule 1', 1, true), 'the active rule sorts above the retired one')
    qa.dump('rulebook-hand-edit')
  end,
}
