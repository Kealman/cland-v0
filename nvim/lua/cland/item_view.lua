-- The item view (spec section 5, Item.dc.html, #36): the item file in the centre. A title line with the id and
-- the state, the body as Markdown text, the verdicts (the latest of each kind on top) and the comments on the
-- left; the fields column on the right (state, kind and labels, parent, assignee, claim, topic, branch, blocked
-- by, blocks, cost, file). The body and the comments come from `task.view`, fetched again whenever the item's
-- summary changes (a `task` event, a refresh); `e` opens the file itself, which the hub re-indexes on save.
local api = vim.api
local state = require('cland.state')
local items = require('cland.items')

local M = { bufs = {}, detail = {}, pending = {}, stale = {} }
local ns = api.nvim_create_namespace('cland.item_view')

function M.setup(client)
  M.client = client
  -- whatever was fetched before may be stale after a reconnect (an edit while away keeps `updated`), and a
  -- fetch lost with the connection failed: every item in view is fetched again
  client:on('connected', function()
    for id in pairs(M.detail) do
      M.stale[id] = true
    end
    state.changed()
  end)
end

local function sw(s)
  return api.nvim_strwidth(s or '')
end

--- Words of `text` wrapped to `width` display columns; a word longer than the width is cut. A width below
--- MIN_WRAP (an indentation past the window's edge) wraps at MIN_WRAP: the cut must advance.
local MIN_WRAP = 8
local function wrap(text, width)
  width = math.max(MIN_WRAP, math.floor(tonumber(width) or MIN_WRAP))
  local out = {}
  for _, para in ipairs(vim.split(text or '', '\n', { plain = true })) do
    -- an indentation keeps at most half the width
    local lead = (para:match('^(%s*)') or ''):sub(1, math.floor(width / 2))
    local cur = ''
    for word in para:gmatch('%S+') do
      local next = cur == '' and (lead .. word) or (cur .. ' ' .. word)
      if sw(next) > width and cur ~= '' then
        out[#out + 1] = cur
        cur = lead .. word
      else
        cur = next
      end
      while sw(cur) > width do
        out[#out + 1] = vim.fn.strcharpart(cur, 0, width)
        cur = vim.fn.strcharpart(cur, width)
      end
    end
    out[#out + 1] = cur
  end
  return out
end

local function hhmm(iso)
  if type(iso) ~= 'string' then
    return ''
  end
  local y, mo, d, h, mi = iso:match('^(%d+)-(%d+)-(%d+)T(%d+):(%d+)')
  if not y then
    return iso
  end
  -- the file's times are UTC; show them in local time
  local t = os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = tonumber(h), min = tonumber(mi), sec = 0 })
  local offset = os.difftime(os.time(), os.time(os.date('!*t')))
  return os.date('%Y-%m-%d %H:%M', t + offset)
end

--- The cost the claiming session's harness reported, where its adapter has usage; nil when unknown.
function M.cost(it)
  local c = items.claim(it)
  if not c then
    return nil
  end
  for _, p in ipairs(state.S.processes) do
    if p.name == c.session and type(p.usage) == 'table' then
      local u = p.usage
      for _, k in ipairs({ 'costUsd', 'cost_usd', 'total_cost_usd', 'cost' }) do
        local v = tonumber(u[k])
        if v then
          return ('$%.2f'):format(v)
        end
      end
    end
  end
end

--- Ask the hub for the whole item (body, comments, verdicts).
function M.fetch(id)
  if M.pending[id] or not (M.client and M.client:connected()) then
    return
  end
  M.pending[id] = true
  M.stale[id] = nil
  local it = state.item(id)
  local asked_at = it and it.updated
  M.client:request({ type = 'task.view', item = id }, function(err, value)
    M.pending[id] = nil
    if err then
      -- a failed fetch is not current: the next reconnect, `task` event or change fetches again; what was
      -- shown before stays, with the error under it
      local prev = M.detail[id]
      M.detail[id] = prev and not prev.error and vim.tbl_extend('force', prev, { note = tostring(err) }) or { error = tostring(err) }
      M.detail[id].failed = true
    elseif value and value.item then
      M.detail[id] = value.item
    else
      M.detail[id] = { error = 'task.view answered no item', failed = true }
    end
    -- the summary this fetch answers: a later change to it fetches again
    M.detail[id].seen = asked_at
    state.changed()
  end)
end

--- The item changed (a `task` event): its body and comments are fetched again when it is in view.
function M.invalidate(id)
  M.stale[id] = true
end

local function field(label, value, group)
  return { label = label, value = value, group = group }
end

--- The fields column, as {label, value, group} rows.
function M.fields(it, d)
  local out = {}
  local st = items.status(it)
  local g = items.GLYPH[st]
  out[#out + 1] = field('state', g[1] .. ' ' .. it.state .. (st ~= it.state and st ~= 'open' and (' · ' .. items.WORDS[st]) or ''), g[2])
  local labels = type(it.labels) == 'table' and #it.labels > 0 and table.concat(it.labels, ', ') or 'no labels'
  out[#out + 1] = field('kind', (it.kind or 'task') .. ' · ' .. labels)
  local parent = items.present(it.parent) and state.item(it.parent)
  out[#out + 1] = field('parent', items.present(it.parent) and (it.parent .. (parent and (' ' .. parent.title) or '')) or '—', items.present(it.parent) and 'ClandBlue' or 'ClandDim')
  out[#out + 1] = field('assignee', items.present(it.assignee) and it.assignee or '—', items.present(it.assignee) and nil or 'ClandDim')
  local c = items.claim(it)
  out[#out + 1] = field('claim', c and (state.label(c.session, c.role) .. ' · since ' .. hhmm(c.claimedAt):sub(-5)) or '—', c and 'ClandTeal' or 'ClandDim')
  local t = items.topic(it)
  out[#out + 1] = field('topic', t and (t.title .. (t.status and (' · ' .. (t.status == 'waiting for human' and 'waiting for you' or t.status)) or '')) or 'no topic yet', t and 'ClandBlue' or 'ClandDim')
  out[#out + 1] = field('branch', items.present(it.branch) and it.branch or '—', items.present(it.branch) and nil or 'ClandDim')
  local blockers = {}
  for _, b in ipairs(type(it.blocked_by) == 'table' and it.blocked_by or {}) do
    local other = state.item(b)
    blockers[#blockers + 1] = b .. ' (' .. (other and other.state or 'unknown') .. ')'
  end
  out[#out + 1] = field('blocked by', #blockers > 0 and table.concat(blockers, ', ') or '—', #items.open_blockers(it) > 0 and 'ClandAmber' or 'ClandDim')
  local blocks = items.blocks(it.id)
  out[#out + 1] = field('blocks', #blocks > 0 and table.concat(blocks, ', ') or '—', #blocks > 0 and nil or 'ClandDim')
  out[#out + 1] = field('cost', M.cost(it) or '—', 'ClandDim')
  out[#out + 1] = field('file', (d and d.path) or ('.cland/tasks/' .. (it.file or '')), 'ClandDim')
  return out
end

--- The verdicts, the latest of each kind first, then the earlier ones.
function M.verdict_rows(verdicts)
  local latest, earlier, seen = {}, {}, {}
  for i = #verdicts, 1, -1 do
    local v = verdicts[i]
    if not seen[v.verdict] then
      seen[v.verdict] = true
      latest[#latest + 1] = v
    else
      table.insert(earlier, 1, v)
    end
  end
  table.sort(latest, function(a, b)
    return a.verdict == 'review' and b.verdict ~= 'review'
  end)
  return latest, earlier
end

-- Lines are lists of {text, hl} chunks.
local function body_lines(it, d, width)
  local L = {}
  local function add(chunks)
    L[#L + 1] = chunks
  end
  local function text(s, group, indent)
    for _, l in ipairs(wrap(s, width - (indent or 1))) do
      add({ { (' '):rep(indent or 1) .. l, group } })
    end
  end
  text(it.title or '', 'ClandBold')
  add({ { ' ' .. ((d and d.path) or ('.cland/tasks/' .. (it.file or ''))) .. ' · updated ' .. hhmm(it.updated), 'ClandDim' } })
  add({ { ' ' .. ('─'):rep(math.max(1, width - 2)), 'ClandFaint' } })
  if not d then
    add({ { ' loading the item…', 'ClandDim' } })
    return L
  elseif d.error then
    add({ { ' ' .. d.error, 'ClandRed' } })
    return L
  end
  if d.note then
    add({ { ' not current: ' .. d.note, 'ClandAmber' } })
  end
  -- the body as Markdown text: headings bold, list markers and quotes kept
  local body = vim.trim(d.body or '')
  if body == '' then
    add({ { ' (no body)', 'ClandDim' } })
  else
    local fence = false
    for _, line in ipairs(vim.split(body, '\n', { plain = true })) do
      if line:match('^%s*```') then
        fence = not fence
        add({ { ' ' .. line, 'ClandFaint' } })
      elseif fence then
        add({ { ' ' .. line, 'ClandDim' } })
      elseif line:match('^#+%s') then
        text(line, 'ClandBold')
      elseif line:match('^%s*>') then
        text(line, 'ClandDim')
      else
        local indent = line:match('^(%s*[-*+] )') or line:match('^(%s*%d+%. )')
        if indent then
          local rest = line:sub(#indent + 1)
          -- a list nested deeper than half the width keeps its marker at half the width
          local lead, marker = indent:match('^(%s*)(.*)$')
          indent = lead:sub(1, math.max(0, math.floor(width / 2) - #marker)) .. marker
          line = indent .. rest
          local first = true
          for _, l in ipairs(wrap(line:sub(#indent + 1), width - 1 - #indent)) do
            add({ { ' ' .. (first and indent or (' '):rep(#indent)) .. l } })
            first = false
          end
        else
          text(line)
        end
      end
    end
  end
  add({})
  local verdicts = type(d.verdicts) == 'table' and d.verdicts or {}
  add({ { ' VERDICTS · ' .. #verdicts, 'ClandSection' } })
  if #verdicts == 0 then
    add({ { ' none yet', 'ClandDim' } })
  end
  local latest, earlier = M.verdict_rows(verdicts)
  local function verdict(v, old)
    local ok = v.result == 'clear'
    local head = (ok and '✓ ' or '✗ ') .. v.verdict .. ' ' .. v.result
    add({ { ' ' .. head, old and 'ClandDim' or (ok and 'ClandGreen' or 'ClandRed') }, { ' · by ' .. (v.by or v.author or '?') .. ' · run ' .. (v.run or '') .. ' · ' .. hhmm(v.at), 'ClandDim' } })
  end
  for _, v in ipairs(latest) do
    verdict(v, false)
  end
  if #earlier > 0 then
    add({ { ' earlier', 'ClandFaint' } })
    for i = #earlier, 1, -1 do
      verdict(earlier[i], true)
    end
  end
  add({})
  local comments = type(d.comments) == 'table' and d.comments or {}
  add({ { ' COMMENTS · ' .. #comments, 'ClandSection' } })
  if #comments == 0 then
    add({ { ' none', 'ClandDim' } })
  end
  for _, cm in ipairs(comments) do
    local head = { { ' ' .. (cm.author or '?'), 'ClandBold' }, { '  ' .. hhmm(cm.at), 'ClandDim' } }
    if type(cm.verdict) == 'table' then
      local ok = cm.verdict.result == 'clear'
      head[#head + 1] = { '  ' .. cm.verdict.verdict .. ' ' .. cm.verdict.result, ok and 'ClandGreen' or 'ClandRed' }
    end
    add(head)
    if vim.trim(cm.text or '') ~= '' then
      text(cm.text, nil, 3)
    end
    add({})
  end
  return L
end

local function field_lines(it, d, width)
  local L = {}
  local lw = 11
  for _, f in ipairs(M.fields(it, d)) do
    local first = true
    for _, l in ipairs(wrap(f.value, math.max(8, width - lw - 1))) do
      L[#L + 1] = { { ' ' .. (first and (f.label .. (' '):rep(lw - #f.label)) or (' '):rep(lw)), 'ClandDim' }, { l, f.group } }
      first = false
    end
  end
  return L
end

local function chunks_width(chunks)
  local w = 0
  for _, c in ipairs(chunks) do
    w = w + sw(c[1])
  end
  return w
end

--- The lines of item `id` for a window `width` wide: {lines, marks}.
function M.compose(id, width)
  local it = state.item(id)
  local rows = {}
  if not it then
    rows = { {}, { { ' ' .. id .. ': no such item in the tracker', 'ClandDim' } } }
  else
    local d = M.detail[id]
    local st = items.status(it)
    local g = items.GLYPH[st]
    local title = { { ' ' }, { g[1], g[2] }, { ' ' .. it.id, 'ClandBold' }, { ' · ' .. it.state .. (st ~= it.state and st ~= 'open' and (' · ' .. items.WORDS[st]) or ''), g[2] }, { ' · ' .. (it.kind or 'task'), 'ClandDim' } }
    rows[#rows + 1] = {}
    rows[#rows + 1] = title
    rows[#rows + 1] = {}
    if width >= 90 then
      local fw = math.min(56, math.floor(width * 0.4))
      local bw = width - fw - 3
      local left, right = body_lines(it, d, bw), field_lines(it, d, fw)
      for i = 1, math.max(#left, #right) do
        local l = vim.deepcopy(left[i] or {})
        local pad = bw - chunks_width(l)
        if right[i] or i <= #right then
          l[#l + 1] = { (' '):rep(math.max(0, pad)) .. ' ' }
          l[#l + 1] = { '│', 'ClandFaint' }
          vim.list_extend(l, right[i] or {})
        end
        rows[#rows + 1] = l
      end
    else
      vim.list_extend(rows, field_lines(it, d, width))
      rows[#rows + 1] = {}
      vim.list_extend(rows, body_lines(it, d, width))
    end
    rows[#rows + 1] = {}
    rows[#rows + 1] = { { ' e edit the file · gt its topic · gs its session · gi on an id opens it · ␣␣ back', 'ClandFaint' } }
  end
  local lines, marks = {}, {}
  for r, chunks in ipairs(rows) do
    local parts, col = {}, 0
    for _, c in ipairs(chunks) do
      parts[#parts + 1] = c[1]
      if c[2] and #c[1] > 0 then
        marks[#marks + 1] = { r - 1, col, { end_col = col + #c[1], hl_group = c[2] } }
      end
      col = col + #c[1]
    end
    lines[r] = table.concat(parts)
  end
  return lines, marks
end

--- `e`: the item's file in a normal buffer in the centre (`:edit`); the hub re-indexes it on save.
function M.edit(id)
  local it = state.item(id)
  if not (it and it.file) then
    return state.say('e: ' .. id .. ' has no file in the index', 'ClandRedBar')
  end
  local root = state.S.root ~= '' and state.S.root or vim.fn.getcwd()
  local path = root .. '/.cland/tasks/' .. it.file
  local win = require('cland.layout').centre()
  api.nvim_set_current_win(win)
  vim.cmd('edit ' .. vim.fn.fnameescape(path))
  vim.wo[win].wrap = true
  state.say(it.id .. ': editing ' .. '.cland/tasks/' .. it.file .. ' (the hub re-indexes it on :w)')
end

--- The buffer of item `id`'s view, made on first use.
function M.buf(id)
  local b = M.bufs[id]
  if b and api.nvim_buf_is_valid(b) then
    return b
  end
  b = api.nvim_create_buf(false, true)
  vim.bo[b].bufhidden = 'hide'
  vim.bo[b].modifiable = false
  pcall(api.nvim_buf_set_name, b, 'cland://item/' .. id)
  vim.b[b].cland_role = 'item'
  vim.b[b].cland_item = id
  M.bufs[id] = b
  vim.keymap.set('n', 'e', function()
    M.edit(id)
  end, { buffer = b, nowait = true, silent = true, desc = 'cland: edit the item file' })
  return b
end

--- Draw item `id`'s view (in whatever window shows it); fetch the whole item when it is missing or stale.
function M.render(id)
  local b = M.buf(id)
  local it = state.item(id)
  local d = M.detail[id]
  if it and (not d or M.stale[id] or d.seen ~= it.updated) then
    M.fetch(id)
  end
  local win = vim.fn.bufwinid(b)
  local width = api.nvim_win_get_width(win ~= -1 and win or require('cland.layout').centre())
  local lines, marks = M.compose(id, width - 1)
  vim.bo[b].modifiable = true
  api.nvim_buf_set_lines(b, 0, -1, false, lines)
  vim.bo[b].modifiable = false
  api.nvim_buf_clear_namespace(b, ns, 0, -1)
  for _, m in ipairs(marks) do
    pcall(api.nvim_buf_set_extmark, b, ns, m[1], m[2], m[3])
  end
  return b
end

return M
