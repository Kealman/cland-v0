-- Source-shaped account readings. The clock is sampled only on redraw: no timer or extra hub read.
local state = require('cland.state')
local M = {}
local sw = vim.api.nvim_strwidth
local epoch = require('cland.thread').epoch

local function reset_time(ts, now)
  local at = epoch(ts)
  if not at then return '--:--' end
  if os.date('%Y-%m-%d', at) == os.date('%Y-%m-%d', now) then return os.date('%H:%M', at) end
  if math.abs(at - now) < 7 * 86400 then return os.date('%a %H:%M', at) end
  return os.date('%Y-%m-%d', at)
end

local function age(seconds)
  if seconds < 60 then return '<1m' end
  if seconds < 3600 then return math.floor(seconds / 60) .. 'm' end
  if seconds < 86400 then return math.floor(seconds / 3600) .. 'h' end
  return math.floor(seconds / 86400) .. 'd'
end

local function colour(window)
  if window.severity then
    return ({ warning = 'ClandAmber', critical = 'ClandRed' })[window.severity] or 'ClandText'
  end
  if window.usedPercent >= 90 then return 'ClandRed' end
  if window.usedPercent >= 75 then return 'ClandAmber' end
  return 'ClandText'
end

-- Keep a whole window together where possible. Long labels/names still fit even the smallest panel.
local function account_line(c, account, now)
  local at = epoch(account.at)
  local seconds = at and math.max(0, now - at)
  local stale = seconds and seconds > 1800
  local chunks, width = {}, 0
  local indent = (' '):rep(math.min(3, math.max(0, c.width - 1)))
  local function flush()
    if #chunks > 0 then c:add(chunks) end
    chunks, width = {}, 0
  end
  local function put(text, group)
    chunks[#chunks + 1] = { text, group }
    width = width + sw(text)
  end
  local function append(text, group, separator)
    text = tostring(text):gsub('[\r\n\t]', ' ')
    separator = separator or ''
    if width + sw(separator .. text) > c.width and width > 0 then
      flush()
      put(indent)
      separator = ''
    end
    if width > 0 then put(separator) end
    -- Wrap a too-long source label at spaces, then by display cells if a word cannot fit.
    while sw(text) > c.width - width do
      local room, count, used, space = c.width - width, 0, 0, nil
      for i = 0, vim.fn.strchars(text) - 1 do
        local ch = vim.fn.strcharpart(text, i, 1)
        if used + sw(ch) > room then break end
        used, count = used + sw(ch), i + 1
        if ch == ' ' then space = count end
      end
      count = space or count
      if count == 0 then
        -- A double-cell glyph cannot fit in a one-column panel.
        put('…', group)
        text = vim.fn.strcharpart(text, 1)
      else
        put(vim.fn.strcharpart(text, 0, count):gsub('%s+$', ''), group)
        text = vim.fn.strcharpart(text, count):gsub('^%s+', '')
      end
      flush()
      put(indent)
    end
    put(text, group)
  end
  append(' ' .. account.name, account.limited and 'ClandRed' or stale and 'ClandDim' or 'ClandBold')
  if account.limited then
    append('✗ limited', 'ClandRed', '  ')
    append(account.limited.resetsAt and ('↻' .. reset_time(account.limited.resetsAt, now)) or 'until cleared', 'ClandRed', ' · ')
  elseif account.signedOut then
    append('signed out', 'ClandDim', '  ')
  elseif account.harness == 'opencode' then
    append('no limit data', 'ClandDim', '  ')
  elseif not at then
    append('no reading yet', 'ClandDim', '  ')
  else
    for i, window in ipairs(account.windows or {}) do
      local text = window.label .. ' ' .. ('%.0f%%'):format(window.usedPercent) .. ' ↻' .. reset_time(window.resetsAt, now)
      append(text, stale and 'ClandDim' or colour(window), i == 1 and '  ' or ' · ')
    end
    append(age(seconds), stale and 'ClandDim' or 'ClandText', ' · ')
  end
  flush()
end

function M.render(c)
  local accounts = state.S.accounts
  local folded = state.folded('accounts')
  c:add({ { ' Accounts' .. (folded and (' (' .. #accounts .. ')') or ''), 'ClandSection' } }, nil, { fold = 'accounts' })
  if not folded then
    local now = os.time()
    -- Preserve registry order, placing synthetic default accounts after the named entries.
    for _, defaults in ipairs({ false, true }) do
      for _, account in ipairs(accounts) do
        if (account.name:match('^default:') ~= nil) == defaults then account_line(c, account, now) end
      end
    end
  end
  c:add({})
end

return M
