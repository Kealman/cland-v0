-- Presentation of the hub's queue, aged from receipt on the local monotonic clock.
local api = vim.api
local state = require('cland.state')
local M = {}
local received, timer

function M.set(queue)
  if state.S.verification == queue then return end
  state.S.verification = type(queue) == 'table' and queue or nil
  received = vim.uv.now()
end

local function elapsed()
  return received and math.max(0, vim.uv.now() - received) or 0
end

local function duration(ms)
  if type(ms) ~= 'number' then return '?' end
  local seconds = math.floor(math.max(0, ms) / 1000)
  if seconds < 60 then return seconds .. 's' end
  local minutes = math.floor(seconds / 60)
  if minutes < 60 then return minutes .. 'm' end
  return math.floor(minutes / 60) .. 'h' .. (minutes % 60 > 0 and (' ' .. minutes % 60 .. 'm') or '')
end

local function age(ms)
  return duration(type(ms) == 'number' and ms + elapsed() or nil)
end

local function eta(ms)
  -- Keep the hub's estimate: median-derived ETAs are approximate, not countdown deadlines.
  return type(ms) == 'number' and ('~' .. duration(ms)) or '?'
end

local function holder_name(holder)
  return holder.kind == 'hand run' and 'hand run' or holder.session or 'human'
end

function M.summary()
  local queue = state.S.verification or {}
  local holder = type(queue.holder) == 'table' and queue.holder or nil
  local waiters = queue.waiters or {}
  local line = 'verify: ' .. (holder and (holder_name(holder) .. ' ' .. age(holder.runMs)) or (#waiters == 0 and 'idle' or 'free'))
  if #waiters > 0 then line = line .. ' · ' .. #waiters .. ' waiting' end
  if holder then line = line .. ' · next ' .. eta(holder.etaMs) end
  return line
end

function M.lines()
  local queue = state.S.verification or {}
  local holder = type(queue.holder) == 'table' and queue.holder or nil
  local waiters = queue.waiters or {}
  local lines = { '', ' Verification queue', '' }
  if holder then
    lines[#lines + 1] = ' Holder: ' .. holder_name(holder) .. ' · ' .. (holder.item or 'no item') .. ' · ' .. (holder.mode or 'mode unknown')
    lines[#lines + 1] = ' running ' .. age(holder.runMs) .. ' · remaining ETA ' .. eta(holder.etaMs) .. ' · pid ' .. tostring(holder.pid or 'unknown')
    lines[#lines + 1] = ' worktree ' .. (holder.worktree or 'unknown')
    lines[#lines + 1] = ' since ' .. (holder.since or 'unknown')
  elseif #waiters > 0 then
    lines[#lines + 1] = ' Nothing running · slot free'
  else
    lines[#lines + 1] = ' nothing running · nothing waiting'
  end
  if #waiters > 0 then
    lines[#lines + 1] = ''
    for _, w in ipairs(waiters) do
      lines[#lines + 1] = ' ' .. w.position .. '. ' .. w.session .. ' · ' .. (w.item or 'no item') .. ' · ' .. w.mode .. ' · waiting ' .. age(w.waitMs) .. ' · admission ETA ' .. eta(w.etaMs)
    end
  end
  local metrics = queue.metrics or {}
  local run, wait = metrics.run or {}, metrics.wait or {}
  lines[#lines + 1] = ''
  lines[#lines + 1] = ' Metrics · last ' .. (metrics.count or 0) .. '/' .. (metrics.window or 20) .. ' runs · run median ' .. duration(run.medianMs) .. ' · p90 ' .. duration(run.p90Ms) .. ' · wait median ' .. duration(wait.medianMs) .. ' · p90 ' .. duration(wait.p90Ms)
  lines[#lines + 1] = ''
  lines[#lines + 1] = ' q previous centre view · ␣? keys'
  return lines
end

function M.start_clock()
  if timer then return end
  timer = vim.uv.new_timer()
  timer:start(1000, 1000, vim.schedule_wrap(function()
    local queue = state.S.verification
    if not queue or not (type(queue.holder) == 'table' or #(queue.waiters or {}) > 0) then return end
    for _, win in ipairs(api.nvim_list_wins()) do
      local role = vim.b[api.nvim_win_get_buf(win)].cland_role
      if role == 'sessions' or role == 'verification' then state.changed(); return end
    end
  end))
  api.nvim_create_autocmd('VimLeavePre', { once = true, callback = function() timer:stop(); timer:close() end })
end

return M
