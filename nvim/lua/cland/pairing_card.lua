-- Local approval only: the hub resolves and consumes the stored numeric identity.
local api = vim.api
local state = require('cland.state')
local M = {}

function M.open(row)
  local messenger = row.messenger == 'telegram' and 'Telegram' or 'Discord'
  local lines = {}
  for _, text in ipairs({ messenger, 'User ' .. row.userId, 'Name ' .. row.name, 'Code ' .. row.code, 'Expires ' .. row.expires, '', '1 approve pairing' }) do
    vim.list_extend(lines, vim.split(text, '\r?\n'))
  end
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].bufhidden = 'wipe'
  vim.b[buf].cland_role = 'pairing_card'
  local width = 40
  for _, text in ipairs(lines) do width = math.max(width, api.nvim_strwidth(text) + 2) end
  width = math.min(width, vim.o.columns - 4)
  local function draw(status)
    if not api.nvim_buf_is_valid(buf) then return end
    vim.bo[buf].modifiable = true
    api.nvim_buf_set_lines(buf, 0, -1, false, vim.list_extend(vim.deepcopy(lines), { status or '' }))
    vim.bo[buf].modifiable = false
  end
  draw()
  local win = api.nvim_open_win(buf, true, { relative = 'editor', row = 3,
    col = math.floor((vim.o.columns - width) / 2), width = width, height = #lines + 1,
    border = 'rounded', style = 'minimal', zindex = 90, title = ' pairing ', footer = ' q close ',
  })
  vim.wo[win].winbar = ''
  vim.wo[win].wrap = true
  local function close() if api.nvim_win_is_valid(win) then api.nvim_win_close(win, true) end end
  local pending = false
  local function approve()
    if pending then return end
    local client = require('cland.views').client
    if not (client and client:connected()) then draw('the hub is not connected'); return end
    pending = true
    draw('approving…')
    client:request({ type = 'pairing.approve', messenger = row.messenger, code = row.code }, function(err, value)
      pending = false
      if err then
        local text = 'not paired: ' .. tostring(err)
        draw(text)
        state.say(text, 'ClandRedBar')
        return
      end
      close()
      state.say('paired ' .. value.pairing.name .. ' (' .. value.pairing.userId .. ')', 'ClandGreenBar')
    end)
  end
  local actions = require('cland.actions')
  actions.map('n', '1', approve, { buffer = buf, nowait = true, silent = true })
  for _, key in ipairs({ 'q', '<Esc>' }) do actions.map('n', key, close, { buffer = buf, nowait = true, silent = true }) end
end

return M
