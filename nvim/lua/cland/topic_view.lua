-- One topic: its thread buffer and its composer buffer, wired to the hub client. The shell's layout
-- (`layout.lua`) puts them in windows: the thread in the centre, the composer in a split below it.
local Thread = require('cland.thread')
local Composer = require('cland.composer')

local M = {}

M.COMPOSER_HEIGHT = 3
M.HISTORY_LIMIT = 200

--- The thread and composer for `topic` ({id, title}) on `client`, without windows.
function M.new(client, topic)
  local view = { topic = topic, client = client }
  view.thread = Thread.new(topic)
  view.composer = Composer.new({
    topic = topic,
    send = function(text, done, attachments)
      if not client:connected() then
        view.thread:set_notice('not sent: ' .. (client.detail or 'the hub is not connected'), 'ClandRed')
        return done('not connected')
      end
      -- a free answer to an ask (#33): `i` on its card or its inbox row armed the composer
      local answering = view.composer.answering
      if answering then
        view.composer:answer_to(nil)
        return client:request({ type = 'topic.answer', ask = answering.ask, text = text }, function(err)
          if err then
            view.composer:answer_to(answering.ask, answering.question)
            view.thread:set_notice('not answered: ' .. err, 'ClandRed')
          else
            require('cland.state').answered(answering.ask)
          end
          done(err)
        end)
      end
      local replying = view.composer.replying
      client:request({ type = 'topic.send', topic = topic.id, text = text, replyTo = replying and replying.id, artifacts = #attachments > 0 and attachments or nil }, function(err)
        if err then
          view.thread:set_notice('not sent: ' .. err, 'ClandRed')
        elseif view.composer.replying == replying then
          view.composer:reply_to(nil)
        end
        done(err)
      end)
    end,
  })

  local generation = 0
  local function load()
    generation = generation + 1
    local current = generation
    local function page(before)
      client:snapshot({ type = 'topic.history', topic = topic.id, limit = M.HISTORY_LIMIT, before = before }, function(err, value, events)
        if current ~= generation then return end
        if err then
          return view.thread:set_notice('no history: ' .. err)
        end
        view.thread:merge(value.messages, before ~= nil)
        if view.thread.archive and (value.more == true or #value.messages == M.HISTORY_LIMIT) and #value.messages > 0 then
          page(value.before or value.messages[1].id)
        end
        for _, e in ipairs(events) do
          if e.topic == topic.id then
            if e.type == 'ask' then view.thread:set_card(e.ask, e.card)
            elseif e.type == 'delivery' then view.thread:set_stage(e.message, e.stage) end
          end
        end
        -- a free answer armed for an ask that closed meanwhile goes
        local function disarm()
          local a = view.composer.answering
          local m = a and view.thread.by_id[a.ask]
          if m and type(m.ask) == 'table' and m.ask.state ~= 'open' then
            view.composer:answer_to(nil)
          end
        end
        disarm()
        -- the history holds only the latest messages: an older ask cached as open is checked against the hub's open
        -- asks, asked after the history so an ask opened meanwhile is in both
        client:inbox(function(ierr, inbox)
          if ierr or type(inbox) ~= 'table' or type(inbox.asks) ~= 'table' then
            return
          end
          local open = {}
          for _, a in ipairs(inbox.asks) do
            if type(a) == 'table' and a.id then
              open[a.id] = true
            end
          end
          view.thread:reconcile_asks(open)
          disarm()
        end)
      end)
    end
    page(nil)
  end
  client:on('connected', load)
  client:on('visibility', load)
  if client:connected() then
    load()
  end
  client:on('state', function(state, detail)
    view.thread:set_notice(detail, state == 'connected' and 'ClandDim' or 'ClandAmber')
  end)
  client:on('message', function(event)
    if event.topic and event.topic.id == topic.id then
      view.thread:add(event.message)
    end
  end)
  client:on('artifact', function(event)
    if event.artifact and event.artifact.topic == topic.id then load() end
  end)
  client:on('delivery', function(event)
    if event.topic == topic.id then
      view.thread:set_stage(event.message, event.stage)
    end
  end)
  -- an ask's card changed (#33); an ask no longer open takes no free answer
  client:on('ask', function(event)
    if event.topic == topic.id then
      view.thread:set_card(event.ask, event.card)
      local a = view.composer.answering
      if a and a.ask == event.ask and type(event.card) == 'table' and event.card.state ~= 'open' then
        view.composer:answer_to(nil)
      end
    end
  end)
  -- 1-9 and i on an open ask's card; i elsewhere in the thread is the composer
  require('cland.ask_card').keys(view.thread.buf, function(row)
    return view.thread:ask_at(row)
  end, function()
    require('cland.layout').show({ kind = 'thread', id = topic.id }, { insert = true })
  end)
  require('cland.actions').map('n', '<CR>', function()
    if view.thread:fold('za') then return end
    local a = (view.thread.artifact_rows or {})[vim.api.nvim_win_get_cursor(0)[1]]
    if a then require('cland.artifacts').open(a) end
  end, { buffer = view.thread.buf, desc = 'open artifact' })
  for _, key in ipairs({ 'zo', 'za', 'zc', 'zR', 'zM' }) do
    require('cland.actions').map('n', key, function() view.thread:fold(key) end, { buffer = view.thread.buf })
  end
  require('cland.visibility').keys(view.thread.buf, function() return 'topics', topic.id end)
  require('cland.actions').map('n', 'A', function()
    view.thread.archive = not view.thread.archive
    view.thread:render()
    load()
  end, { buffer = view.thread.buf, desc = 'show or hide archived messages' })
  require('cland.actions').map('n', 'ga', function()
    require('cland.layout').show({ kind = 'artifacts', id = topic.id }, { insert = false })
  end, { buffer = view.thread.buf, desc = 'topic artifacts' })
  return view
end

return M
