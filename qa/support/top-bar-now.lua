-- Message frames from the stub hub drive the production top bar at both supported widths.
return function(columns)
  local control = vim.fn.tempname() .. '.sock'
  vim.env.CLAND_STUB_CONTROL = control
  local at = '2026-10-10T10:00:00Z'
  local bound = { id = 'topic-count', title = 'Count item', status = 'open', unread = 0, item = 'T-12' }
  return {
    title = 'The top bar counts now at ' .. columns .. ' columns',
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
        qa.expect(top():find('sessions', 1, true) ~= nil, 'count fitting preserves the sessions chip')
        local rendered = vim.api.nvim_eval_statusline(require('cland.bars').topbar(), { use_tabline = true, maxwidth = columns }).str
        qa.expect(vim.api.nvim_strwidth(rendered) <= columns, 'top bar fits display cells')
      end
      local burst = {}
      for i = 1, 20 do burst[#burst + 1] = event('background-' .. i, { 'coordinator' }) end
      command({ emits = burst })
      qa.wait_for(function() return require('cland.state').topic(bound.id).unread == 20 end, 5000, 'background burst received')
      count(0)
      local before = command({ requests = true }).requests
      command({ emit = event('addressed', { 'human' }) })
      count(1)
      qa.expect(vim.deep_equal(before, command({ requests = true }).requests), 'message alone updates the count without polling')
      command({ emit = event('watch', { 'coordinator' }, { fromRole = 'reviewer', text = 'review clear T-12' }) })
      qa.wait_for(function() return require('cland.state').topic(bound.id).unread == 22 end, 5000, 'watch verdict received')
      count(1)
      local ask = event('ask-new', { 'human' }, { ask = { state = 'open', options = { 'yes' }, free = true } })
      command({ emit = ask })
      count(2)
      command({ emits = {
        { type = 'inbox', inbox = { asks = { { id = 'ask-new', topic = { id = bound.id }, question = 'ask-new',
          options = { 'yes' }, from = 'coordinator', ts = at } }, approvals = {}, waiting = {}, notifications = {}, needsYou = 1 } }, ask,
      } })
      qa.wait_for(function() return #qa.state().asks == 1 end, 5000, 'ask in inbox')
      count(2)
      qa.dump('now-count-' .. columns)
      qa.keys('<Esc>:Cland view thread topic-count<CR>')
      count(1)
      command({ emits = {
        { type = 'ask', topic = bound.id, ask = 'ask-new', card = { state = 'answered' } },
        { type = 'inbox', inbox = { asks = {}, approvals = {}, waiting = {}, notifications = {}, needsYou = 0 } },
      } })
      count(0)
    end,
  }
end
