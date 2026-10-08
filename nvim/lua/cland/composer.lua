-- A topic's composer: a prompt buffer. Enter sends what was typed (all its lines); Shift+Enter inserts
-- a newline (native in Neovim 0.12 prompt buffers; Alt+Enter too, for terminals that cannot tell
-- Shift+Enter from Enter). The prompt is free again at once; the text is kept until the hub accepts it,
-- and a message the hub refused (or that could not go out) is put back, ahead of anything typed since.
local api = vim.api

local M = {}
local ns = api.nvim_create_namespace('cland.composer')

M.PROMPT = '› '

local Composer = {}
Composer.__index = Composer

--- opts: topic ({id, title}), send (fn(text, done): calls done(nil) once the hub accepted the message,
--- done(err) when it was refused or could not be sent).
function M.new(opts)
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'prompt'
  vim.bo[buf].bufhidden = 'hide'
  vim.bo[buf].swapfile = false
  pcall(api.nvim_buf_set_name, buf, 'cland://composer/' .. opts.topic.id)
  vim.b[buf].cland_role = 'composer'
  vim.b[buf].cland_topic = opts.topic.id
  local self = setmetatable({ topic = opts.topic, buf = buf, send = opts.send }, Composer)
  vim.fn.prompt_setprompt(buf, M.PROMPT)
  vim.fn.prompt_setcallback(buf, function(text)
    self:_submit(text)
  end)
  vim.keymap.set('i', '<M-CR>', function()
    api.nvim_feedkeys(api.nvim_replace_termcodes('<S-CR>', true, false, true), 'n', false)
  end, { buffer = buf, desc = 'cland: newline in the message' })
  api.nvim_create_autocmd({ 'TextChanged', 'TextChangedI', 'InsertEnter', 'InsertLeave' }, {
    buffer = buf,
    callback = function()
      self:placeholder()
    end,
  })
  self:placeholder()
  return self
end

--- A hint in the empty composer, as virtual text after the prompt.
function Composer:placeholder()
  local buf = self.buf
  if not api.nvim_buf_is_valid(buf) then
    return
  end
  api.nvim_buf_clear_namespace(buf, ns, 0, -1)
  local lines = api.nvim_buf_get_lines(buf, 0, -1, false)
  if #lines ~= 1 or lines[1] ~= M.PROMPT then
    return
  end
  local hint = self.answering and ('Your answer to: ' .. self.answering.question .. '  Enter sends it as the answer')
    or ('Message ' .. self.topic.title .. '…  Enter sends · Shift+Enter newline')
  pcall(api.nvim_buf_set_extmark, buf, ns, 0, #M.PROMPT, { virt_text = { { hint, 'ClandFaint' } }, virt_text_pos = 'inline' })
end

--- Arm the composer for a free answer to ask `ask` (#33): the next Enter sends its text as the answer. nil disarms.
function Composer:answer_to(ask, question)
  self.answering = ask and { ask = ask, question = question or '' } or nil
  self:placeholder()
  require('cland.state').changed()
end

--- The text after the prompt, all lines.
function Composer:text()
  local lines = api.nvim_buf_get_lines(self.buf, 0, -1, false)
  if lines[1] and lines[1]:sub(1, #M.PROMPT) == M.PROMPT then
    lines[1] = lines[1]:sub(#M.PROMPT + 1)
  end
  return table.concat(lines, '\n')
end

--- Put `text` in the composer, cursor at its end (keeps Insert mode: no mode change here).
function Composer:set_text(text)
  local lines = vim.split(text, '\n', { plain = true })
  lines[1] = M.PROMPT .. lines[1]
  api.nvim_buf_set_lines(self.buf, 0, -1, false, lines)
  for _, win in ipairs(vim.fn.win_findbuf(self.buf)) do
    pcall(api.nvim_win_set_cursor, win, { #lines, #lines[#lines] })
  end
  self:placeholder()
end

--- A send failed: the text comes back, followed by whatever was typed since.
function Composer:restore(text)
  if not api.nvim_buf_is_valid(self.buf) then
    return
  end
  local now = self:text()
  self:set_text(vim.trim(now) == '' and text or (text .. '\n' .. now))
end

function Composer:_submit(text)
  -- after the callback the prompt buffer holds the submitted lines and a fresh prompt line: free it now
  vim.schedule(function()
    local buf = self.buf
    if not api.nvim_buf_is_valid(buf) then
      return
    end
    local n = api.nvim_buf_line_count(buf)
    if n > 1 then
      api.nvim_buf_set_lines(buf, 0, n - 1, false, {})
    end
    self:placeholder()
    if text and vim.trim(text) ~= '' then
      self.send(text, function(err)
        if err then
          self:restore(text)
        end
      end)
    end
  end)
end

return M
