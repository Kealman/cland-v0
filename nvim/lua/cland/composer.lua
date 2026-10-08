-- A topic's composer: a prompt buffer. Enter sends what was typed (all its lines); Shift+Enter inserts
-- a newline (native in Neovim 0.12 prompt buffers; Alt+Enter too, for terminals that cannot tell
-- Shift+Enter from Enter). A message that could not be sent is put back for another try.
local api = vim.api

local M = {}
local ns = api.nvim_create_namespace('cland.composer')

M.PROMPT = '› '

local Composer = {}
Composer.__index = Composer

--- opts: topic ({id, title}), send (fn(text) -> true when it went to the hub).
function M.new(opts)
  local buf = api.nvim_create_buf(false, true)
  vim.bo[buf].buftype = 'prompt'
  vim.bo[buf].bufhidden = 'hide'
  vim.bo[buf].swapfile = false
  pcall(api.nvim_buf_set_name, buf, 'cland://composer/' .. opts.topic.id)
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
  local hint = 'Message ' .. self.topic.title .. '…  Enter sends · Shift+Enter newline'
  pcall(api.nvim_buf_set_extmark, buf, ns, 0, #M.PROMPT, { virt_text = { { hint, 'ClandFaint' } }, virt_text_pos = 'inline' })
end

function Composer:_submit(text)
  local sent = true
  if text and vim.trim(text) ~= '' then
    sent = self.send(text)
  end
  -- after the callback the prompt buffer holds the submitted lines and a fresh prompt line
  vim.schedule(function()
    local buf = self.buf
    if not api.nvim_buf_is_valid(buf) then
      return
    end
    if sent then
      local n = api.nvim_buf_line_count(buf)
      if n > 1 then
        api.nvim_buf_set_lines(buf, 0, n - 1, false, {})
      end
    else
      local lines = vim.split(text, '\n', { plain = true })
      lines[1] = M.PROMPT .. lines[1]
      api.nvim_buf_set_lines(buf, 0, -1, false, lines)
      for _, win in ipairs(vim.fn.win_findbuf(buf)) do
        pcall(api.nvim_win_set_cursor, win, { #lines, #lines[#lines] })
      end
    end
    self:placeholder()
  end)
end

return M
