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
    send = function(text, done)
      if not client:connected() then
        view.thread:set_notice('not sent: ' .. (client.detail or 'the hub is not connected'), 'ClandRed')
        return done('not connected')
      end
      client:request({ type = 'topic.send', topic = topic.id, text = text }, function(err)
        if err then
          view.thread:set_notice('not sent: ' .. err, 'ClandRed')
        end
        done(err)
      end)
    end,
  })

  local function load()
    client:request({ type = 'topic.history', topic = topic.id, limit = M.HISTORY_LIMIT }, function(err, value)
      if err then
        return view.thread:set_notice('no history: ' .. err)
      end
      view.thread:merge(value.messages)
    end)
  end
  client:on('connected', load)
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
  client:on('delivery', function(event)
    if event.topic == topic.id then
      view.thread:set_stage(event.message, event.stage)
    end
  end)
  return view
end

return M
