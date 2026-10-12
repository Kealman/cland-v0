-- Only hub counts drive both displays at the supported widths.
return function(columns)
  local control = vim.fn.tempname() .. '.sock'
  vim.env.CLAND_STUB_CONTROL = control
  local at = '2026-10-10T10:00:00Z'
  local bound = { id = 'topic-count', title = 'Count item', status = 'open', unread = 0, item = 'T-12' }
  return {
    title = 'The top bar shows the hub count at ' .. columns .. ' columns',
    hub = 'stub', fixture = { project = 'qa-top-bar-now' },
    scenario = {
      topics = { { id = 'general', title = ('General 界 '):rep(20), status = 'open', unread = 0 },
        { id = 'agents', title = 'Agents', status = 'open', unread = 0 }, bound },
      presence = { { name = ('long-coordinator-界'):rep(8), role = 'coordinator', state = 'busy' } },
      inbox = {},
    },
    run = function(qa)
      vim.o.columns = columns
      qa.wait_for(function() return qa.state().hub.state == 'connected' and require('cland.state').topic(bound.id) end,
        10000, 'stub hub connected with item topic')
      qa.wait_for(function() return qa.screen():find('✓ needs you 0', 1, true) end, 10000, 'initial count')
      local function command(value)
        local pipe, done, err, result = vim.uv.new_pipe(false), false, nil, ''
        pipe:connect(control, function(e)
          if e then err, done = e, true; pipe:close(); return end
          pipe:read_start(function(read_err, data)
            if read_err then err, done = read_err, true
            elseif data then
              result = result .. data
              done = result:find('\n', 1, true) ~= nil
            else err, done = 'control socket closed', true end
            if done then pipe:read_stop(); pipe:close() end
          end)
          pipe:write(vim.json.encode(value) .. '\n')
        end)
        qa.wait_for(function() return done end, 5000, 'stub control reply')
        qa.expect(not err, 'stub control: ' .. tostring(err))
        return vim.json.decode(result)
      end
      local function event(id, to, extra)
        return { type = 'message', topic = { id = bound.id, title = bound.title, item = bound.item },
          message = vim.tbl_extend('force', { id = id, from = 'impl-1', fromKind = 'agent', fromRole = 'implementer',
            to = to, text = id, ts = at, topic = bound.id }, extra or {}) }
      end
      local function top() return qa.screen():match('^[^\n]*') end
      local function count(n)
        qa.wait_for(function() return top():match('needs you +(' .. n .. ')%s') end, 5000, 'count ' .. n)
        -- Render the production inbox panel header even when the 80-column layout has it hidden.
        local buf = vim.api.nvim_create_buf(false, true)
        vim.b[buf].cland_role = 'inbox'
        local win = vim.api.nvim_open_win(buf, false, { relative = 'editor', row = 1, col = 0, width = columns, height = 1, style = 'minimal' })
        local header = require('cland.bars').winbar(win)
        vim.api.nvim_win_close(win, true)
        vim.api.nvim_buf_delete(buf, { force = true })
        qa.expect(header:find(n > 0 and (n .. ' need you') or 'nothing needs you', 1, true) ~= nil, 'inbox header agrees with chip')
        qa.expect(top():find('sessions', 1, true) ~= nil, 'count fitting preserves the sessions chip')
        local rendered = vim.api.nvim_eval_statusline(require('cland.bars').topbar(), { use_tabline = true, maxwidth = columns }).str
        qa.expect(vim.api.nvim_strwidth(rendered) <= columns, 'top bar fits display cells')
      end
      local events = {}
      for i = 1, 427 do
        events[#events + 1] = { type = 'event', row = { id = 'event-' .. i, kind = i % 2 == 0 and 'verdict' or 'session',
          warning = i % 3 == 0, glyph = '·', subject = { kind = 'session', id = 'impl-1' }, text = 'event ' .. i, ts = at } }
      end
      command({ emits = events })
      qa.wait_for(function() return #require('cland.events').latest == 200 end, 5000, 'event flood received')
      local ib = { asks = {}, approvals = {}, waiting = {}, needsYou = 0 }
      local function inbox()
        command({ set = { inbox = ib }, emit = { type = 'inbox', inbox = ib } })
        count(ib.needsYou)
      end
      inbox()
      ib.needsYou = 7
      inbox()
      ib.needsYou = 0
      inbox()
      local burst = {}
      for i = 1, 98 do burst[#burst + 1] = event('ordinary-' .. i, i % 2 == 0 and { 'human' } or { 'coordinator' }) end
      command({ emits = burst })
      qa.wait_for(function() return require('cland.state').topic(bound.id).unread == 98 end, 5000, 'ordinary message flood received')
      count(0)
      command({ emit = event('watch', { 'coordinator' }, { fromRole = 'reviewer', text = 'review clear T-12' }) })
      qa.wait_for(function() return require('cland.state').topic(bound.id).unread == 99 end, 5000, 'watch verdict received')
      count(0)
      local ask = event('ask-new', { 'human' }, { ask = { state = 'open', options = { 'yes' }, free = true } })
      ib.asks = { { id = 'ask-new', topic = { id = bound.id }, question = 'ask-new',
        options = { 'yes' }, from = 'coordinator', ts = at } }
      ib.needsYou = 1
      command({ set = { inbox = ib }, emits = { { type = 'inbox', inbox = ib }, ask, ask } })
      qa.wait_for(function() return #qa.state().asks == 1 end, 5000, 'ask in inbox')
      count(1)
      ib.approvals = { { session = 'impl-1', label = 'impl-1 [Implementer]' } }
      ib.waiting = { { id = 'waiting', title = 'Decision', status = 'waiting for human', updatedAt = at } }
      ib.needsYou = 3
      inbox()
      qa.dump('now-count-' .. columns)
      qa.keys('<Esc>:Cland view thread topic-count<CR>')
      qa.wait_for(function() return require('cland.state').S.ui.view.id == bound.id end, 5000, 'reading the topic')
      count(3)
      command({ emit = { type = 'ask', topic = bound.id, ask = 'ask-new', card = { state = 'answered' } } })
      ib.asks = {}
      ib.approvals = {}
      ib.waiting = {}
      ib.needsYou = 0
      inbox() -- Informational events never change the hub's response count.
    end,
  }
end
