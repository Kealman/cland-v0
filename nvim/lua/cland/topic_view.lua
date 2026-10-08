-- One topic on screen: its thread above, its composer below, wired to the hub client. The shell (#25)
-- places views like this one; this module only knows its own two windows.
local api = vim.api
local Thread = require('cland.thread')
local Composer = require('cland.composer')

local M = {}

M.COMPOSER_HEIGHT = 3
M.HISTORY_LIMIT = 200

--- The thread and composer for `topic` ({id, title}) on `client`, without windows yet.
function M.new(client, topic)
  local view = { topic = topic, client = client }
  view.thread = Thread.new(topic)
  view.composer = Composer.new({
    topic = topic,
    send = function(text)
      if not client:connected() then
        view.thread:set_notice('not sent: ' .. (client.detail or 'the hub is not connected'), 'ClandRed')
        return false
      end
      client:request({ type = 'topic.send', topic = topic.id, text = text }, function(err)
        if err then
          view.thread:set_notice('not sent: ' .. err, 'ClandRed')
        end
      end)
      return true
    end,
  })

  client:on('connected', function()
    client:request({ type = 'topic.history', topic = topic.id, limit = M.HISTORY_LIMIT }, function(err, value)
      if err then
        return view.thread:set_notice('no history: ' .. err)
      end
      view.thread:merge(value.messages)
    end)
  end)
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

--- Show the view in the current window: the thread there, the composer in a split below, focused.
function M.show(view)
  local thread_win = api.nvim_get_current_win()
  api.nvim_win_set_buf(thread_win, view.thread.buf)
  vim.wo[thread_win].wrap = true
  vim.wo[thread_win].winbar = ' %#ClandBold#' .. view.topic.title:gsub('%%', '%%%%') .. '%*'
  view.thread:render()
  vim.cmd('botright ' .. M.COMPOSER_HEIGHT .. 'split')
  local composer_win = api.nvim_get_current_win()
  api.nvim_win_set_buf(composer_win, view.composer.buf)
  vim.wo[composer_win].winfixheight = true
  vim.wo[composer_win].wrap = true
  view.thread_win, view.composer_win = thread_win, composer_win
  vim.cmd('startinsert!')
end

return M
